//SPDX-License-Identifier: MIT
pragma solidity >0.8.10;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {Implementation} from "./Implementation.sol";
import {Lumerin} from "./LumerinToken.sol";
import {FeeRecipient} from "./Shared.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title CloneFactory
/// @author Josh Kean (Lumerin)
/// @notice Variables passed into contract initializer are subject to change based on the design of the hashrate contract

//CloneFactory now responsible for minting, purchasing, and tracking contracts
contract CloneFactory is Initializable {
    IERC20 public paymentToken;
    IERC20 public feeToken;
    address public baseImplementation; // This is now the beacon address
    address public owner;
    address public hashrateOracle;
    bool public noMoreWhitelist;
    address[] public rentalContracts; //dynamically allocated list of rental contracts
    mapping(address => bool) rentalContractsMap; //mapping of rental contracts to verify cheaply if implementation was created by this clonefactory

    mapping(address => bool) public whitelist; //whitelisting of seller addresses //temp public for testing
    mapping(address => bool) public isContractDead; // keeps track of contracts that are no longer valid

    /// @notice The fee rate paid to a validator, expressed as a fraction of the total amount.
    /// @dev Stored as an integer scaled by VALIDATOR_FEE_DECIMALS to represent a float ratio.
    /// @dev This value should consider the decimals of the tokens.
    /// @dev For example, for USDC(6 decimals) and LMR(8 decimals) and VALIDATOR_FEE_DECIMALS=18:
    /// @dev  Price: 100 USDC, Fee: 10 LMR
    /// @dev  validatorFeeRateScaled = priceWithDecimals / feeWithDecimals * 10**VALIDATOR_FEE_DECIMALS
    /// @dev  validatorFeeRateScaled = 10 00000000 / 100 000000 * 10**18 = 10 * 10**18
    uint256 public validatorFeeRateScaled;
    uint8 public constant VALIDATOR_FEE_DECIMALS = 18;

    using SafeERC20 for IERC20;

    event contractCreated(address indexed _address, string _pubkey); //emitted whenever a contract is created
    event clonefactoryContractPurchased(address indexed _address, address indexed _validator); //emitted whenever a contract is purchased
    event contractDeleteUpdated(address _address, bool _isDeleted); //emitted whenever a contract is deleted/restored
    event purchaseInfoUpdated(address indexed _address);

    modifier onlyOwner() {
        require(msg.sender == owner, "you are not authorized");
        _;
    }

    modifier onlyInWhitelist() {
        require(whitelist[msg.sender] || noMoreWhitelist, "you are not an approved seller on this marketplace");
        _;
    }

    function initialize(
        address _baseImplementation, // This should be the beacon address
        address _hashrateOracle,
        address _paymentToken,
        address _feeToken,
        uint256 _validatorFeeRateScaled
    ) public initializer {
        paymentToken = IERC20(_paymentToken);
        feeToken = IERC20(_feeToken);
        hashrateOracle = _hashrateOracle;
        baseImplementation = _baseImplementation; // Store the beacon address
        owner = msg.sender;
        validatorFeeRateScaled = _validatorFeeRateScaled;
    }

    function setCreateNewRentalContractV2(
        uint256,
        uint256,
        uint256 _speed,
        uint256 _length,
        int8 _profitTarget,
        address,
        string calldata _pubKey
    ) public payable onlyInWhitelist returns (address) {
        return createContract(_speed, _length, _profitTarget, address(0), _pubKey);
    }

    function createContract(
        uint256 _speed,
        uint256 _length,
        int8 _profitTarget,
        address, // unused
        string calldata _pubKey
    ) internal returns (address) {
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
    ) internal {
        // TODO: add a test case so any third-party implementations will be discarded
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

    function getContractList() external view returns (address[] memory) {
        return rentalContracts;
    }

    //adds an address to the whitelist
    function setAddToWhitelist(address _address) external onlyOwner {
        whitelist[_address] = true;
    }

    //remove an address from the whitelist
    function setRemoveFromWhitelist(address _address) external onlyOwner {
        whitelist[_address] = false;
    }

    function checkWhitelist(address _address) external view returns (bool) {
        if (noMoreWhitelist) {
            return true;
        }
        return whitelist[_address];
    }

    function setDisableWhitelist() external onlyOwner {
        noMoreWhitelist = true;
    }

    /// @notice Set the fee rate paid to a validator
    /// @param _validatorFeeRateScaled fraction multiplied by VALIDATOR_FEE_MULT
    function setValidatorFeeRate(uint256 _validatorFeeRateScaled) external onlyOwner {
        validatorFeeRateScaled = _validatorFeeRateScaled;
    }

    function setContractDeleted(address _contractAddress, bool _isDeleted) public {
        require(rentalContractsMap[_contractAddress], "unknown contract address");
        Implementation _contract = Implementation(_contractAddress);
        require(msg.sender == _contract.seller() || msg.sender == owner, "you are not authorized");
        Implementation(_contractAddress).setContractDeleted(_isDeleted);
        emit contractDeleteUpdated(_contractAddress, _isDeleted);
    }

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
