// SPDX-License-Identifier: MIT
pragma solidity >0.8.0;

import {
    ReentrancyGuardUpgradeable,
    Initializable
} from "@openzeppelin/contracts-upgradeable-v5/utils/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable-v5/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable-v5/access/OwnableUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts-v5/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-v5/token/ERC20/utils/SafeERC20.sol";
import { CloneFactory } from "./CloneFactory.sol";
import { HashrateOracle } from "./HashrateOracle.sol";
import { Versionable } from "../util/versionable.sol";
/// @title Implementation
/// @author Oleksandr (Shev) Shevchuk (Lumerin)
/// @notice A smart contract implementation for managing hashrate rental agreements in a decentralized marketplace
/// @dev This contract handles the core logic for hashrate rental contracts, including:
///      - Contract lifecycle management (purchase, execution, early closure)
///      - Payment processing and escrow management, including validator fees
///      - Dynamic pricing based on hashrate oracle
///      - Contract terms management and updates
///      - Historical record keeping

contract Implementation is UUPSUpgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable, Versionable {
    IERC20 public feeToken;
    IERC20 public paymentToken;
    HashrateOracle public hashrateOracle;
    CloneFactory public cloneFactory; // address of the clone factory for access control

    Terms public terms; // the terms of the contract
    Terms public futureTerms; // the terms of the contract to be applied after the current contract is closed
    uint256 public startingBlockTimestamp; // the timestamp of the block when the contract was purchased
    uint256 public validatorFeeRateScaled; // the fee rate for the validator, scaled by VALIDATOR_FEE_MULT, considering decimals
    address public buyer; // buyer of the contract
    address public seller; // seller of the contract
    address public validator; // validator, can close out contract early, if empty - no validator (buyer node)
    bool private isLastValidatorNotPaid; // flag to track if the last validator has been paid
    bool public isDeleted; // used to track if the contract is deleted

    string public pubKey; // encrypted data for pool target info
    string public encrValidatorURL; // if using own validator (buyer-node) this will be the encrypted buyer address. Encrypted with the seller's public key
    string public encrDestURL; // where to redirect the hashrate after validation (for both third-party validator and buyer-node) If empty, then the hashrate will be redirected to the default pool of the buyer node

    HistoryEntry[] public history; // TODO: replace this struct with querying logs from a blockchain node

    uint8 public constant VALIDATOR_FEE_DECIMALS = 18;
    string public constant VERSION = "2.0.2"; // This will be replaced during build time

    using SafeERC20 for IERC20;

    enum ContractState {
        Available,
        Running
    }

    enum CloseReason {
        Unspecified,
        Underdelivery,
        DestinationUnavailable,
        ShareTimeout
    }

    struct Terms {
        uint256 _price; // price of the current running contract at the time of purchase
        uint256 _limit; // Not used anywhere
        uint256 _speed; // th/s of contract
        uint256 _length; // how long the contract will last in seconds
        uint32 _version;
        int8 _profitTarget; // profit target in percentage, 10 means the price will be 10% higher than the mining price
    }

    struct HistoryEntry {
        bool _goodCloseout; // consider dropping and use instead _purchaseTime + _length >= _endTime
        uint256 _purchaseTime;
        uint256 _endTime;
        uint256 _price;
        uint256 _fee;
        uint256 _speed;
        uint256 _length;
        address _buyer;
    }

    event contractPurchased(address indexed _buyer);
    event closedEarly(CloseReason _reason);
    event purchaseInfoUpdated(address indexed _address); // emitted on either terms or futureTerms update
    event destinationUpdated(string newValidatorURL, string newDestURL);
    event fundsClaimed();
    event fundsClaimedValidator(address indexed _validator);

    /// @notice Initializes the contract with basic parameters
    /// @param _cloneFactory Address of the clone factory for access control
    /// @param _hashrateOracle Address of the hashrate oracle for profit calculation
    /// @param _paymentToken Address of the payment token to pay the provider
    /// @param _feeToken Address of the payment token to pay the validator
    /// @param _seller Address of the seller of the contract
    /// @param _pubKey Encrypted data for pool target info
    /// @param _speed Hashrate of the contract
    /// @param _length Length of the contract in seconds
    /// @param _profitTarget Profit target in percentage (e.g., 10 means 10% higher than mining price)
    function initialize(
        address _cloneFactory,
        address _hashrateOracle,
        address _paymentToken,
        address _feeToken,
        address _seller,
        string calldata _pubKey,
        uint256 _speed,
        uint256 _length,
        int8 _profitTarget
    ) external initializer {
        terms = Terms(0, 0, _speed, _length, 0, _profitTarget);
        seller = _seller;
        cloneFactory = CloneFactory(_cloneFactory);
        pubKey = _pubKey;
        feeToken = IERC20(_feeToken);
        paymentToken = IERC20(_paymentToken);
        hashrateOracle = HashrateOracle(_hashrateOracle);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        __Ownable_init(msg.sender);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Only the owner can upgrade the contract
    }

    /// @notice Returns the current state of the contract
    /// @return The current contract state (Available or Running)
    function contractState() public view returns (ContractState) {
        uint256 expirationTime = startingBlockTimestamp + terms._length;
        if (block.timestamp < expirationTime) {
            return ContractState.Running;
        }
        return ContractState.Available;
    }

    /// @notice Returns all public variables of the contract
    /// @return _state Current contract state
    /// @return _terms Current contract terms
    /// @return _startingBlockTimestamp When the contract started
    /// @return _buyer Address of the buyer
    /// @return _seller Address of the seller
    /// @return _encryptedPoolData Encrypted pool data
    /// @return _isDeleted Whether the contract is deleted
    /// @return _balance Current balance of the contract
    /// @return _hasFutureTerms Whether there are future terms set
    function getPublicVariablesV2()
        external
        view
        returns (
            ContractState _state,
            Terms memory _terms,
            uint256 _startingBlockTimestamp,
            address _buyer,
            address _seller,
            string memory _encryptedPoolData,
            bool _isDeleted,
            uint256 _balance,
            bool _hasFutureTerms
        )
    {
        bool hasFutureTerms = futureTerms._length != 0;
        Terms memory __terms = terms;
        __terms._price = price();
        return (
            contractState(),
            __terms,
            startingBlockTimestamp,
            buyer,
            seller,
            encrValidatorURL,
            isDeleted,
            paymentToken.balanceOf(address(this)),
            hasFutureTerms
        );
    }

    /// @notice Returns the contract history entries
    /// @param _offset Starting index for history entries
    /// @param _limit Maximum number of entries to return
    /// @return Array of history entries
    function getHistory(uint256 _offset, uint256 _limit) external view returns (HistoryEntry[] memory) {
        if (_offset > history.length) {
            _offset = history.length;
        }
        if (_offset + _limit > history.length) {
            _limit = history.length - _offset;
        }

        HistoryEntry[] memory values = new HistoryEntry[](_limit);
        for (uint256 i = 0; i < _limit; i++) {
            // return values in reverse historical for displaying purposes
            values[i] = history[history.length - 1 - _offset - i];
        }

        return values;
    }

    /// @notice Returns statistics about successful and failed contracts
    /// @return _successCount Number of successful contracts
    /// @return _failCount Number of failed contracts
    function getStats() external view returns (uint256 _successCount, uint256 _failCount) {
        uint256 successCount = 0;
        uint256 failCount = 0;
        for (uint256 i = 0; i < history.length; i++) {
            if (history[i]._goodCloseout) {
                successCount++;
            } else {
                failCount++;
            }
        }
        return (successCount, failCount);
    }

    /// @dev function that the clone factory calls to purchase the contract
    function setPurchaseContract(
        string calldata _encrValidatorURL,
        string calldata _encrDestURL,
        uint256 _price,
        address _buyer,
        address _validator,
        uint256 _validatorFeeRateScaled
    ) external onlyCloneFactory {
        require(contractState() == ContractState.Available, "contract is not in an available state");

        maybePayLastValidator();
        maybeApplyFutureTerms();

        terms._price = _price;

        history.push(
            HistoryEntry(
                true,
                block.timestamp,
                block.timestamp + terms._length,
                terms._price,
                _validatorFeeRateScaled,
                terms._speed,
                terms._length,
                _buyer
            )
        );

        encrValidatorURL = _encrValidatorURL;
        encrDestURL = _encrDestURL;
        buyer = _buyer;
        validator = _validator;
        startingBlockTimestamp = block.timestamp;
        validatorFeeRateScaled = _validatorFeeRateScaled;

        isLastValidatorNotPaid = _validatorFeeRateScaled > 0 && _validator != address(0);

        emit contractPurchased(msg.sender);
    }

    /// @notice Updates the mining destination during contract execution
    /// @param _encrValidatorURL New encrypted validator URL
    /// @param _encrDestURL New encrypted destination URL
    function setDestination(string calldata _encrValidatorURL, string calldata _encrDestURL) external {
        require(msg.sender == buyer, "this account is not authorized to update the ciphertext information");
        require(contractState() == ContractState.Running, "the contract is not in the running state");
        encrDestURL = _encrDestURL;
        encrValidatorURL = _encrValidatorURL;
        emit destinationUpdated(_encrValidatorURL, _encrDestURL);
    }

    /// @dev function to be called by clonefactory which can edit the cost, length, and hashrate of a given contract
    function setUpdatePurchaseInformation(uint256 _speed, uint256 _length, int8 _profitTarget)
        external
        onlyCloneFactory
    {
        if (contractState() == ContractState.Running) {
            futureTerms = Terms(0, 0, _speed, _length, terms._version + 1, _profitTarget);
        } else {
            terms = Terms(0, 0, _speed, _length, terms._version + 1, _profitTarget);
        }
        emit purchaseInfoUpdated(address(this));
    }

    function maybeApplyFutureTerms() private {
        if (futureTerms._version != 0) {
            terms = Terms(
                futureTerms._price,
                futureTerms._limit,
                futureTerms._speed,
                futureTerms._length,
                futureTerms._version,
                futureTerms._profitTarget
            );
            futureTerms = Terms(0, 0, 0, 0, 0, 0);
            emit purchaseInfoUpdated(address(this));
        }
    }

    function maybePayLastValidator() private returns (bool) {
        if (contractState() == ContractState.Available && validator != address(0) && isLastValidatorNotPaid) {
            feeToken.safeTransfer(validator, getValidatorFee(terms._price));
            isLastValidatorNotPaid = false;
            emit fundsClaimedValidator(msg.sender);
            return true;
        }
        return false;
    }

    function getValidatorFee(uint256 _price) private view returns (uint256) {
        // fee is calculated as percentage of numerical value of contract price, that is why we need to adjust the decimals
        return (_price * getValidatorFeeRateScaled()) / (10 ** VALIDATOR_FEE_DECIMALS);
    }

    function getValidatorFeeRateScaled() private view returns (uint256) {
        // if contract is available, use the validator fee rate from the clone factory
        if (contractState() == ContractState.Available) {
            return cloneFactory.validatorFeeRateScaled();
        }

        // if contract is running, use the validator fee rate from the contract terms, as they are fixed for the duration of the contract
        return validatorFeeRateScaled;
    }

    /// @dev Returns the amount of funds that should be paid for the service from now till the current time
    function getRealizedPayout() private view returns (uint256) {
        uint256 elapsedContractTime = (block.timestamp - startingBlockTimestamp);
        if (elapsedContractTime <= terms._length) {
            return (terms._price * elapsedContractTime) / terms._length;
        }
        return terms._price;
    }

    /// @dev Returns the amount of funds that will be paid for the service from now till the end of the contract
    function getUnrealizedPayout() private view returns (uint256) {
        return terms._price - getRealizedPayout();
    }

    function setContractDeleted(bool _isDeleted) external onlyCloneFactory {
        require(isDeleted != _isDeleted, "contract delete state is already set to this value");
        isDeleted = _isDeleted;
    }

    function claimFunds() external payable {
        require(msg.sender == seller, "this account is not authorized to claim funds");

        uint256 amountToKeepInEscrow = 0;
        if (contractState() == ContractState.Running) {
            // if contract is running we need to keep some funds
            // in the escrow for refund if seller cancels contract
            amountToKeepInEscrow = getUnrealizedPayout();
        }

        emit fundsClaimed();

        maybePayLastValidator();
        uint256 unpaidValidatorFee = isLastValidatorNotPaid ? getValidatorFee(terms._price) : 0;

        maybeApplyFutureTerms();

        withdrawAllFundsSeller(amountToKeepInEscrow + unpaidValidatorFee);
    }

    /// @notice Sends the validator fee to the validator
    /// @dev Can be called from any address, but the validator fee will be sent to the validator
    function claimFundsValidator() external {
        bool paid = maybePayLastValidator();
        require(paid, "no funds to withdraw");
    }

    function closeEarly(CloseReason reason) external {
        require(
            msg.sender == buyer || msg.sender == validator,
            "this account is not authorized to trigger an early closeout"
        );
        require(contractState() == ContractState.Running, "the contract is not in the running state");

        HistoryEntry storage historyEntry = history[history.length - 1];
        historyEntry._goodCloseout = false;
        historyEntry._endTime = block.timestamp;

        // how much to return to buyer (base price)
        uint256 buyerPayout = getUnrealizedPayout();
        uint256 validatorPayout = 0;
        if (validator != address(0)) {
            // how much to pay to validator
            validatorPayout = getValidatorFee(getRealizedPayout());

            // how much validator fee to refund to buyer
            uint256 buyerValidatorFeeRefund = getValidatorFee(buyerPayout);

            // total validator refund
            buyerPayout = buyerPayout + buyerValidatorFeeRefund;
        }

        isLastValidatorNotPaid = false;
        startingBlockTimestamp = 0;
        maybeApplyFutureTerms();
        terms._price = 0;

        emit closedEarly(reason);

        paymentToken.safeTransfer(buyer, buyerPayout);
        if (validatorPayout > 0) {
            feeToken.safeTransfer(validator, validatorPayout);
        }
    }

    function withdrawAllFundsSeller(uint256 remaining) private nonReentrant {
        uint256 balance = feeToken.balanceOf(address(this)) - remaining;
        paymentToken.safeTransfer(seller, balance);
    }

    /// @notice Returns the current price and validator fee for the contract
    /// @return _price The current price of the contract
    /// @return _fee The current validator fee for the contract
    function priceAndFee() external view returns (uint256, uint256) {
        uint256 _price = price();
        uint256 _fee = getValidatorFee(_price);
        return (_price, _fee);
    }

    /// @notice Returns the estimated price of the contract in the payment token
    function price() private view returns (uint256) {
        uint256 hashesForToken = hashrateOracle.getHashesforToken();
        uint256 priceInToken = (terms._length * terms._speed) / hashesForToken;
        int256 priceInTokenWithProfit =
            int256(priceInToken) + (int256(priceInToken) * int256(terms._profitTarget)) / 100;

        return priceInTokenWithProfit < 0 ? 0 : uint256(priceInTokenWithProfit);
    }

    modifier onlyCloneFactory() {
        require(msg.sender == address(cloneFactory), "only clonefactory can call this function");
        _;
    }
}
