//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import { Implementation } from "./Implementation.sol";
import { Versionable } from "../util/versionable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { Paginator } from "@solarity/solidity-lib/libs/arrays/Paginator.sol";

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
    uint256 private __gap; // gap for upgrade compatibility

    /// @notice The fee rate paid to a validator, expressed as a fraction of the total amount.
    /// @dev Stored as an integer scaled by VALIDATOR_FEE_DECIMALS to represent a float ratio.
    /// @dev This value should consider the decimals of the tokens.
    /// @dev For example, for USDC(6 decimals) and LMR(8 decimals) and VALIDATOR_FEE_DECIMALS=18:
    /// @dev  Price: 100 USDC, Fee: 10 LMR
    /// @dev  validatorFeeRateScaled = priceWithDecimals / feeWithDecimals * 10**VALIDATOR_FEE_DECIMALS
    /// @dev  validatorFeeRateScaled = 10 * 10**8 / 100 * 10**6 * 10**18 = 10 * 10**18
    uint256 public validatorFeeRateScaled;
    uint8 public constant VALIDATOR_FEE_DECIMALS = 18;
    string public constant VERSION = "2.0.8";
    uint32 private minContractDuration;
    uint32 private maxContractDuration;

    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using Paginator for EnumerableSet.AddressSet;

    event contractCreated(address indexed _address, string _pubkey);
    event clonefactoryContractPurchased(address indexed _address, address indexed _validator);
    event contractDeleteUpdated(address _address, bool _isDeleted); // emitted whenever a contract is deleted/restored
    event purchaseInfoUpdated(address indexed _address); // emitted whenever contract data updated
    event validatorFeeRateUpdated(uint256 _validatorFeeRateScaled);
    event contractHardDeleted(address indexed _address);

    modifier _onlyOwner() {
        require(_msgSender() == owner(), "you are not authorized");
        _;
    }

    struct Seller {
        uint256 stake;
    }

    mapping(address => Seller) private sellers;
    mapping(address => EnumerableSet.AddressSet) private sellerContracts;
    EnumerableSet.AddressSet private sellerAddresses;

    uint256 public minSellerStake;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _baseImplementation, // This should be the beacon address
        address _hashrateOracle,
        address _paymentToken,
        address _feeToken,
        uint256 _validatorFeeRateScaled,
        uint256 _minSellerStake,
        uint32 _minContractDuration,
        uint32 _maxContractDuration
    ) external initializer {
        __Ownable_init(_msgSender());
        __UUPSUpgradeable_init();
        paymentToken = IERC20(_paymentToken);
        feeToken = IERC20(_feeToken);
        hashrateOracle = _hashrateOracle;
        baseImplementation = _baseImplementation; // Store the beacon address
        validatorFeeRateScaled = _validatorFeeRateScaled;
        minSellerStake = _minSellerStake;
        minContractDuration = _minContractDuration;
        maxContractDuration = _maxContractDuration;
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
        ensureActiveSeller(_msgSender());
        enforceContractDuration(_length);

        bytes memory data = abi.encodeWithSelector(
            Implementation(address(0)).initialize.selector, _msgSender(), _pubKey, _speed, _length, _profitTarget
        );

        BeaconProxy beaconProxy = new BeaconProxy(baseImplementation, data);
        address newContractAddr = address(beaconProxy);
        emit contractCreated(newContractAddr, _pubKey);
        rentalContracts.push(newContractAddr);
        rentalContractsMap[newContractAddr] = true;
        addSellerContract(_msgSender(), newContractAddr);
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
        // Validation block - variables scoped to reduce stack depth
        {
            Implementation targetContract = Implementation(_contractAddress);
            require(rentalContractsMap[_contractAddress], "unknown contract address");
            require(!targetContract.isDeleted(), "cannot purchase deleted contract");
            require(targetContract.seller() != _msgSender(), "cannot purchase your own contract");
            ensureActiveSeller(targetContract.seller());

            uint32 _version;
            (,,,, _version,) = targetContract.futureTerms();
            if (_version == 0) {
                (,,,, _version,) = targetContract.terms();
            }
            require(_version == termsVersion, "cannot purchase, contract terms were updated");
        }

        emit clonefactoryContractPurchased(_contractAddress, _validatorAddress);

        // Payment handling block - get price and fee directly in transfers
        (uint256 _price, uint256 _fee) = Implementation(_contractAddress).priceAndFee();

        Implementation(_contractAddress).setPurchaseContract(
            _encrValidatorURL, _encrDestURL, _price, _msgSender(), _validatorAddress, validatorFeeRateScaled
        );

        paymentToken.safeTransferFrom(_msgSender(), _contractAddress, _price);
        if (_validatorAddress != address(0) && _fee > 0) {
            feeToken.safeTransferFrom(_msgSender(), _contractAddress, _fee);
        }
    }

    /// @notice Returns the list of all rental contracts
    /// @return An array of contract addresses
    function getContractList() external view returns (address[] memory) {
        return rentalContracts;
    }

    /// @notice Set the fee rate paid to a validator
    /// @param _validatorFeeRateScaled fraction with VALIDATOR_FEE_MULT decimals
    function setValidatorFeeRate(uint256 _validatorFeeRateScaled) external _onlyOwner {
        if (validatorFeeRateScaled != _validatorFeeRateScaled) {
            validatorFeeRateScaled = _validatorFeeRateScaled;
            emit validatorFeeRateUpdated(_validatorFeeRateScaled);
        }
    }

    /// @notice Delete or restore a contract
    /// @param _contractAddresses The addresses of the hashrate contracts to delete or restore
    /// @param _isDeleted true if delete, false if restore the contract
    function setContractsDeleted(address[] calldata _contractAddresses, bool _isDeleted) external {
        for (uint256 i = 0; i < _contractAddresses.length; i++) {
            address _contractAddress = _contractAddresses[i];
            require(rentalContractsMap[_contractAddress], "unknown contract address");

            Implementation _contract = Implementation(_contractAddress);
            require(_msgSender() == _contract.seller() || _msgSender() == owner(), "you are not authorized");

            emit contractDeleteUpdated(_contractAddress, _isDeleted);
            if (_isDeleted) {
                removeSellerContract(_msgSender(), _contractAddress);
            } else {
                addSellerContract(_msgSender(), _contractAddress);
            }
            _contract.setContractDeleted(_isDeleted);
        }
    }

    /// @notice Hard delete a contract
    /// @param _index The index of the contract to delete
    function contractHardDelete(uint256 _index, address _address) external {
        require(_index < rentalContracts.length, "index out of bounds");

        address _contractAddress = rentalContracts[_index];
        require(_contractAddress == _address, "contract address mismatch");

        Implementation _contract = Implementation(_contractAddress);
        address _seller = _contract.seller();
        require(_msgSender() == _seller || _msgSender() == owner(), "you are not authorized");

        removeSellerContract(_seller, _contractAddress);
        delete rentalContractsMap[_contractAddress];

        rentalContracts[_index] = rentalContracts[rentalContracts.length - 1];
        rentalContracts.pop();

        emit contractHardDeleted(_contractAddress);
        _contract.setContractDeleted(true);
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
        ensureRegisteredSeller(_msgSender());
        enforceContractDuration(_length);

        require(rentalContractsMap[_contractAddress], "unknown contract address");
        Implementation _contract = Implementation(_contractAddress);
        require(_msgSender() == _contract.seller(), "you are not authorized");

        emit purchaseInfoUpdated(_contractAddress);
        Implementation(_contractAddress).setUpdatePurchaseInformation(_speed, _length, _profitTarget);
    }

    function sellerByAddress(address _seller)
        public
        view
        returns (Seller memory seller, bool isActive, bool isRegistered)
    {
        return (sellers[_seller], sellers[_seller].stake >= minSellerStake, sellerAddresses.contains(_seller));
    }

    function sellerRegister(uint256 _stake) external {
        address _seller = _msgSender();
        sellers[_seller].stake += _stake;
        if (sellers[_seller].stake < minSellerStake) {
            revert("stake is less than required minimum");
        }

        sellerAddresses.add(_seller);
        feeToken.safeTransferFrom(_seller, address(this), _stake);
    }

    function sellerDeregister() external {
        address _seller = _msgSender();
        ensureRegisteredSeller(_seller);
        if (sellerContracts[_seller].length() > 0) {
            revert("seller has contracts");
        }
        uint256 stakeToReturn = sellers[_seller].stake;
        sellers[_seller].stake = 0;
        sellerAddresses.remove(_seller);
        feeToken.safeTransfer(_seller, stakeToReturn);
    }

    function addSellerContract(address _seller, address _contract) private {
        ensureActiveSeller(_seller);
        sellerContracts[_seller].add(_contract);
    }

    function removeSellerContract(address _seller, address _contract) private {
        ensureRegisteredSeller(_seller);
        sellerContracts[_seller].remove(_contract);
    }

    function ensureRegisteredSeller(address _seller) private view {
        (,, bool isRegistered) = sellerByAddress(_seller);
        if (!isRegistered) {
            revert("seller is not registered");
        }
    }

    function ensureActiveSeller(address _seller) private view {
        (, bool isActive, bool isRegistered) = sellerByAddress(_seller);
        if (!isRegistered) {
            revert("seller is not registered");
        }
        if (!isActive) {
            revert("seller is not active");
        }
    }

    function setMinSellerStake(uint256 _minSellerStake) external _onlyOwner {
        minSellerStake = _minSellerStake;
    }

    // function getSellerContracts(address _seller, uint256 _offset, uint8 _limit)
    //     external
    //     view
    //     returns (address[] memory)
    // {
    //     return sellerContracts[_seller].part(_offset, _limit);
    // }

    function getSellers(uint256 _offset, uint8 _limit) external view returns (address[] memory) {
        return sellerAddresses.part(_offset, _limit);
    }

    function setContractDurationInterval(uint32 _min, uint32 _max) external _onlyOwner {
        minContractDuration = _min;
        maxContractDuration = _max;
    }

    function setHashrateOracle(address _hashrateOracle) external _onlyOwner {
        hashrateOracle = _hashrateOracle;
    }

    /// @notice Get the allowed contract duration interval in seconds inclusive
    function getContractDurationInterval() external view returns (uint32, uint32) {
        return (minContractDuration, maxContractDuration);
    }

    /// @dev Throws if the contract duration is not within the allowed interval
    function enforceContractDuration(uint256 _duration) private view {
        if (!isContractDurationValid(_duration)) {
            revert("contract duration is not within the allowed interval");
        }
    }

    function isContractDurationValid(uint256 _duration) private view returns (bool) {
        return _duration >= minContractDuration && _duration <= maxContractDuration;
    }
}
