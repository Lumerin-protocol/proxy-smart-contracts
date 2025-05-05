//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable-v5/access/OwnableUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts-v5/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-v5/token/ERC20/utils/SafeERC20.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable-v5/proxy/utils/UUPSUpgradeable.sol";
import { BeaconProxy } from "@openzeppelin/contracts-v5/proxy/beacon/BeaconProxy.sol";
import { Implementation } from "./Implementation.sol";
import { Versionable } from "../util/versionable.sol";

/// @title CloneFactory
/// @author Josh Kean (Lumerin), Oleksandr (Shev) Shevchuk
/// @notice A factory contract that creates and manages hashrate rental contracts using a beacon proxy pattern.
/// @dev This contract serves:
///      - Central entry point for creating, tracking, managing all hashrate rental contracts
///      - Whitelisting of approved sellers
///      - Handling contract purchases and payments
/// @dev The contract uses UUPS upgradeable pattern and is owned by a designated address.
/// @dev All rental contracts are created as beacon proxies pointing to a common implementation.
contract CloneFactory is UUPSUpgradeable, OwnableUpgradeable, Versionable {
    IERC20 public paymentToken;
    IERC20 public feeToken;
    address public baseImplementation; // This is now the beacon address
    address public hashrateOracle;
    address[] public rentalContracts; //dynamically allocated list of rental contracts
    mapping(address => bool) rentalContractsMap; //mapping of rental contracts to verify cheaply if implementation was created by this clonefactory
    mapping(address => bool) public isContractDead; // keeps track of contracts that are no longer valid

    /// @notice The fee rate paid to a validator, expressed as a fraction of the total amount.
    /// @dev Stored as an integer scaled by VALIDATOR_FEE_DECIMALS to represent a float ratio.
    /// @dev This value should consider the decimals of the tokens.
    /// @dev For example, for USDC(6 decimals) and LMR(8 decimals) and VALIDATOR_FEE_DECIMALS=18:
    /// @dev  Price: 100 USDC, Fee: 10 LMR
    /// @dev  validatorFeeRateScaled = priceWithDecimals / feeWithDecimals * 10**VALIDATOR_FEE_DECIMALS
    /// @dev  validatorFeeRateScaled = 10 * 10**8 / 100 * 10**6 * 10**18 = 10 * 10**18
    uint256 public validatorFeeRateScaled;
    uint8 public constant VALIDATOR_FEE_DECIMALS = 18;
    string public constant VERSION = "2.0.2"; // This will be replaced during build time

    using SafeERC20 for IERC20;

    event contractCreated(address indexed _address, string _pubkey);
    event clonefactoryContractPurchased(address indexed _address, address indexed _validator);
    event contractDeleteUpdated(address _address, bool _isDeleted); // emitted whenever a contract is deleted/restored
    event purchaseInfoUpdated(address indexed _address); // emitted whenever contract data updated

    modifier _onlyOwner() {
        require(msg.sender == owner(), "you are not authorized");
        _;
    }

    function initialize(
        address _baseImplementation, // This should be the beacon address
        address _hashrateOracle,
        address _paymentToken,
        address _feeToken,
        uint256 _validatorFeeRateScaled
    ) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        paymentToken = IERC20(_paymentToken);
        feeToken = IERC20(_feeToken);
        hashrateOracle = _hashrateOracle;
        baseImplementation = _baseImplementation; // Store the beacon address
        validatorFeeRateScaled = _validatorFeeRateScaled;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Only the owner can upgrade the contract
    }

    /// @notice Create a new rental contract
    /// @param _speed The speed of the contract in hashes per second
    /// @param _length The length of the contract in seconds
    /// @param _profitTarget The profit target of the contract in percent
    /// @param _pubKey The public key of the contract
    /// @return address The address of the new contract
    function setCreateNewRentalContractV2(
        uint256,
        uint256,
        uint256 _speed,
        uint256 _length,
        int8 _profitTarget,
        address,
        string calldata _pubKey
    ) external payable returns (address) {
        return createContract(_speed, _length, _profitTarget, _pubKey);
    }

    function createContract(uint256 _speed, uint256 _length, int8 _profitTarget, string calldata _pubKey)
        private
        returns (address)
    {
        bytes memory data = abi.encodeWithSelector(
            Implementation(address(0)).initialize.selector,
            address(this),
            hashrateOracle,
            address(paymentToken),
            address(feeToken),
            msg.sender,
            _pubKey,
            _speed,
            _length,
            _profitTarget
        );

        BeaconProxy beaconProxy = new BeaconProxy(baseImplementation, data);
        address newContractAddr = address(beaconProxy);
        rentalContracts.push(newContractAddr);
        rentalContractsMap[newContractAddr] = true;
        emit contractCreated(newContractAddr, _pubKey);
        return newContractAddr;
    }

    /// @notice purchase a hashrate contract
    /// @param _contractAddress the address of the contract to purchase
    /// @param _validatorAddress set to the address of the external validator, or address(0) for self-hosted validator
    /// @param _encrValidatorURL the publicly available URL of the external validator, or the self-hosted validator (encrypted with the seller's pubkey)
    /// @param _encrDestURL the URL of the destination pool (encrypted with the validator pubkey or buyer pubkey if self-hosted validator is used)
    function setPurchaseRentalContractV2(
        address _contractAddress,
        address _validatorAddress,
        string calldata _encrValidatorURL,
        string calldata _encrDestURL,
        uint32 termsVersion
    ) external payable {
        purchaseContract(_contractAddress, _validatorAddress, _encrValidatorURL, _encrDestURL, termsVersion);
    }

    function purchaseContract(
        address _contractAddress,
        address _validatorAddress,
        string memory _encrValidatorURL,
        string memory _encrDestURL,
        uint32 termsVersion
    ) private {
        require(rentalContractsMap[_contractAddress], "unknown contract address");
        Implementation targetContract = Implementation(_contractAddress);
        require(!targetContract.isDeleted(), "cannot purchase deleted contract");
        require(targetContract.seller() != msg.sender, "cannot purchase your own contract");

        uint32 _version;

        (,,,, _version,) = targetContract.futureTerms();
        if (_version == 0) {
            (,,,, _version,) = targetContract.terms();
        }
        require(_version == termsVersion, "cannot purchase, contract terms were updated");

        (uint256 _price, uint256 _fee) = targetContract.priceAndFee();

        paymentToken.safeTransferFrom(msg.sender, _contractAddress, _price);
        if (_validatorAddress != address(0)) {
            feeToken.safeTransferFrom(msg.sender, _contractAddress, _fee);
        }

        targetContract.setPurchaseContract(
            _encrValidatorURL, _encrDestURL, _price, msg.sender, _validatorAddress, validatorFeeRateScaled
        );

        emit clonefactoryContractPurchased(_contractAddress, _validatorAddress);
    }

    /// @notice Returns the list of all rental contracts
    /// @return An array of contract addresses
    function getContractList() external view returns (address[] memory) {
        return rentalContracts;
    }

    /// @notice Set the fee rate paid to a validator
    /// @param _validatorFeeRateScaled fraction with VALIDATOR_FEE_MULT decimals
    function setValidatorFeeRate(uint256 _validatorFeeRateScaled) external _onlyOwner {
        validatorFeeRateScaled = _validatorFeeRateScaled;
    }

    /// @notice Delete or restore a contract
    /// @param _contractAddress The address of the hashrate contract to delete or restore
    /// @param _isDeleted true if delete, false if restore the contract
    function setContractDeleted(address _contractAddress, bool _isDeleted) external {
        require(rentalContractsMap[_contractAddress], "unknown contract address");
        Implementation _contract = Implementation(_contractAddress);
        require(msg.sender == _contract.seller() || msg.sender == owner(), "you are not authorized");
        Implementation(_contractAddress).setContractDeleted(_isDeleted);
        emit contractDeleteUpdated(_contractAddress, _isDeleted);
    }

    /// @notice Updates the contract information for a rental contract
    /// @param _contractAddress The address of the contract to update
    /// @param _speed The new speed value
    /// @param _length The new length value
    /// @param _profitTarget The new profit target value
    function setUpdateContractInformationV2(
        address _contractAddress,
        uint256,
        uint256,
        uint256 _speed,
        uint256 _length,
        int8 _profitTarget
    ) external {
        updateContract(_contractAddress, _speed, _length, _profitTarget);
    }

    function updateContract(address _contractAddress, uint256 _speed, uint256 _length, int8 _profitTarget) internal {
        require(rentalContractsMap[_contractAddress], "unknown contract address");
        Implementation _contract = Implementation(_contractAddress);
        require(msg.sender == _contract.seller(), "you are not authorized");

        Implementation(_contractAddress).setUpdatePurchaseInformation(_speed, _length, _profitTarget);
        emit purchaseInfoUpdated(address(this));
    }
}
