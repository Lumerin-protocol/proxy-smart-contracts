// SPDX-License-Identifier: MIT
pragma solidity >0.8.0;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
contract Implementation is Versionable, ContextUpgradeable {
    address private __gap1;
    address private __gap2;
    address private __gap3;
    address private __gap4;

    Terms public terms; // the terms of the contract
    Terms public futureTerms; // the terms of the contract to be applied after the current contract is closed
    uint256 public startingBlockTimestamp; // time of last purchase, is set to 0 when payment is resolved
    uint256 public validatorFeeRateScaled; // the fee rate for the validator, scaled by VALIDATOR_FEE_MULT, considering decimals
    address public buyer; // buyer of the contract
    address public seller; // seller of the contract
    address public validator; // validator, can close out contract early, if empty - no validator (buyer node)
    bool private __gap5; // not used
    bool public isDeleted; // used to track if the contract is deleted

    string public pubKey; // encrypted data for pool target info
    string public encrValidatorURL; // if using own validator (buyer-node) this will be the encrypted buyer address. Encrypted with the seller's public key
    string public encrDestURL; // where to redirect the hashrate after validation (for both third-party validator and buyer-node) If empty, then the hashrate will be redirected to the default pool of the buyer node

    uint256 private __gap6; // not used
    HistoryEntry[] public history; // TODO: replace this struct with querying logs from a blockchain node
    uint32 private successCount;
    uint32 private failCount;

    uint8 public constant VALIDATOR_FEE_DECIMALS = 18;
    string public constant VERSION = "2.0.8";

    // shared between all contract instances, and updated altogether with the implementation
    HashrateOracle public immutable hashrateOracle;
    CloneFactory public immutable cloneFactory;
    IERC20 public immutable feeToken;
    IERC20 public immutable paymentToken;

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
        uint256 _price; // price of the current running contract at the time of purchase, 0 if contract is not running
        uint256 _fee; // fee of the current running contract at the time of purchase
        uint256 _speed; // hashes/second
        uint256 _length; // seconds
        uint32 _version;
        int8 _profitTarget; // profit target in percentage, 10 means the price will be 10% higher than the mining price
    }

    struct HistoryEntry {
        uint256 _purchaseTime;
        uint256 _endTime;
        uint256 _price;
        uint256 _fee;
        uint256 _speed;
        uint256 _length;
        address _buyer;
        address _validator;
    }

    event contractPurchased(address indexed _buyer);
    event closedEarly(CloseReason _reason);
    event purchaseInfoUpdated(address indexed _address); // emitted on either terms or futureTerms update
    event destinationUpdated(string newValidatorURL, string newDestURL);
    event fundsClaimed();

    /// @param _cloneFactory Address of the clone factory for access control
    /// @param _hashrateOracle Address of the hashrate oracle for profit calculation
    /// @param _paymentToken Address of the payment token to pay the provider
    /// @param _feeToken Address of the payment token to pay the validator
    constructor(address _cloneFactory, address _hashrateOracle, address _paymentToken, address _feeToken) {
        _disableInitializers();
        cloneFactory = CloneFactory(_cloneFactory);
        hashrateOracle = HashrateOracle(_hashrateOracle);
        paymentToken = IERC20(_paymentToken);
        feeToken = IERC20(_feeToken);
    }

    /// @notice Initializes the contract with basic parameters
    /// @param _seller Address of the seller of the contract
    /// @param _pubKey Encrypted data for pool target info
    /// @param _speed Hashrate of the contract
    /// @param _length Length of the contract in seconds
    /// @param _profitTarget Profit target in percentage (e.g., 10 means 10% higher than mining price)
    function initialize(address _seller, string calldata _pubKey, uint256 _speed, uint256 _length, int8 _profitTarget)
        external
        initializer
    {
        terms = Terms(0, 0, _speed, _length, 0, _profitTarget);
        seller = _seller;
        pubKey = _pubKey;
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
            // TODO: add this in the next release string memory _encryptedDestURL,
            bool _isDeleted,
            uint256 _balance,
            bool _hasFutureTerms
        )
    {
        bool hasFutureTerms = futureTerms._length != 0;
        Terms memory __terms = terms;
        __terms._price = priceUnchecked();
        __terms._fee = getValidatorFee(__terms._price, getValidatorFeeRateScaled());
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
    function getHistory(uint256 _offset, uint8 _limit) external view returns (HistoryEntry[] memory) {
        if (_offset > history.length) {
            _offset = history.length;
        }
        if (_offset + _limit > history.length) {
            _limit = uint8(history.length - _offset);
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
        return (successCount, failCount);
    }

    /// @dev function that the clone factory calls to purchase the contract
    /// @dev the payment should be transeferred after calling this function
    function setPurchaseContract(
        string calldata _encrValidatorURL,
        string calldata _encrDestURL,
        uint256 _price,
        address _buyer,
        address _validator,
        uint256 _validatorFeeRateScaled
    ) external onlyCloneFactory {
        require(contractState() == ContractState.Available, "contract is not in an available state");

        (uint256 a, uint256 b, uint256 c, uint256 d) = getPayments(false);
        maybeApplyFutureTerms();

        buyer = _buyer;
        terms._price = _price;
        validator = _validator;
        encrDestURL = _encrDestURL;
        encrValidatorURL = _encrValidatorURL;
        startingBlockTimestamp = block.timestamp;
        validatorFeeRateScaled = _validatorFeeRateScaled;

        successCount++;
        history.push(
            HistoryEntry(
                block.timestamp,
                block.timestamp + terms._length,
                terms._price,
                getValidatorFee(_price, _validatorFeeRateScaled),
                terms._speed,
                terms._length,
                _buyer,
                _validator
            )
        );

        sendPayments(a, b, c, d);

        emit contractPurchased(_msgSender());
    }

    /// @notice Updates the mining destination during contract execution
    /// @param _encrValidatorURL New encrypted validator URL
    /// @param _encrDestURL New encrypted destination URL
    function setDestination(string calldata _encrValidatorURL, string calldata _encrDestURL) external {
        require(_msgSender() == buyer, "this account is not authorized to update the ciphertext information");
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

    /// @dev this function is used to calculate the validator fee for the contract
    function getValidatorFee(uint256 _price, uint256 _validatorFeeRateScaled) private pure returns (uint256) {
        // fee is calculated as percentage of numerical value of contract price, that is why we need to adjust the decimals
        return (_price * _validatorFeeRateScaled) / (10 ** VALIDATOR_FEE_DECIMALS);
    }

    function getValidatorFeeRateScaled() private view returns (uint256) {
        // if contract is available, use the validator fee rate from the clone factory
        if (contractState() == ContractState.Available) {
            return cloneFactory.validatorFeeRateScaled();
        }

        // if contract is running, use the validator fee rate from the contract terms, as they are fixed for the duration of the contract
        return validatorFeeRateScaled;
    }

    function setContractDeleted(bool _isDeleted) external onlyCloneFactory {
        isDeleted = _isDeleted;
    }

    /// @notice Resolves the payments for contract/validator that are due.
    /// @notice Can be called during contract execution, then returns funds for elapsed time for current contract
    /// @dev Can be called from any address, but the seller reward will be sent to the seller
    function claimFunds() external payable {
        (uint256 a, uint256 b, uint256 c, uint256 d) = getPayments(false);
        bool paid = sendPayments(a, b, c, d);
        require(paid, "no funds to withdraw");
        emit fundsClaimed();
    }

    /// @notice Resolves the payments for contract/validator that are due.
    /// @dev same as claimFunds, kept for backwards compatibility
    function claimFundsValidator() external {
        (uint256 a, uint256 b, uint256 c, uint256 d) = getPayments(false);
        bool paid = sendPayments(a, b, c, d);
        require(paid, "no funds to withdraw");
        emit fundsClaimed();
    }

    /// @notice Returns the current price and validator fee for the contract
    /// @return _price The current price of the contract
    /// @return _fee The current validator fee for the contract
    function priceAndFee() external view returns (uint256, uint256) {
        uint256 _price = price();
        uint256 _fee = getValidatorFee(_price, getValidatorFeeRateScaled());
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

    function priceUnchecked() private view returns (uint256) {
        uint256 hashesForToken = hashrateOracle.getHashesForTokenUnchecked();
        uint256 priceInToken = (terms._length * terms._speed) / hashesForToken;
        int256 priceInTokenWithProfit =
            int256(priceInToken) + (int256(priceInToken) * int256(terms._profitTarget)) / 100;

        return priceInTokenWithProfit < 0 ? 0 : uint256(priceInTokenWithProfit);
    }

    function maybeApplyFutureTerms() private {
        if (futureTerms._version != 0) {
            terms =
                Terms(0, 0, futureTerms._speed, futureTerms._length, futureTerms._version, futureTerms._profitTarget);
            futureTerms = Terms(0, 0, 0, 0, 0, 0);
            emit purchaseInfoUpdated(address(this));
        }
    }

    /// @notice Allows the buyer or validator to close out the contract early
    /// @param reason The reason for the early closeout
    function closeEarly(CloseReason reason) external {
        require(
            _msgSender() == buyer || _msgSender() == validator,
            "this account is not authorized to trigger an early closeout"
        );
        require(contractState() == ContractState.Running, "the contract is not in the running state");

        HistoryEntry storage historyEntry = history[history.length - 1];
        historyEntry._endTime = block.timestamp;
        successCount--;
        failCount++;

        (uint256 a, uint256 b, uint256 c, uint256 d) = getPayments(true);

        setPaymentResolved();
        maybeApplyFutureTerms();

        emit closedEarly(reason);
        sendPayments(a, b, c, d);
    }

    /// @dev Pays the parties according to the payment struct
    /// @dev Removed the events, cause Transfer events emitted anyway
    /// @dev split into two functions (getPayments and sendPayments) to better fit check-effect-interaction pattern
    function getPayments(bool isCloseout) private view returns (uint256, uint256, uint256, uint256) {
        if (isPaymentResolved()) {
            return (0, 0, 0, 0);
        }

        bool hasValidator = validator != address(0);
        uint256 deliveredPayment = getDeliveredPayment();

        // total undelivered payment and fee for ongoing contract
        uint256 undeliveredPayment = terms._price - deliveredPayment;
        uint256 undeliveredFee = hasValidator ? getValidatorFee(undeliveredPayment, validatorFeeRateScaled) : 0;

        // used to correctly calculate claim when contract is ongoing
        // total balance of the contract is what seller/validator should have received
        // we need to subtract the undelivered payment and fee so the buyer could be paid
        // if they decide to close out the contract early
        uint256 unpaidDeliveredPayment = paymentToken.balanceOf(address(this)) - undeliveredPayment;
        uint256 unpaidDeliveredFee = feeToken.balanceOf(address(this)) - undeliveredFee;

        if (isCloseout) {
            // refund the buyer for the undelivered payment and fee
            return (unpaidDeliveredPayment, unpaidDeliveredFee, undeliveredPayment, undeliveredFee);
        } else {
            return (unpaidDeliveredPayment, unpaidDeliveredFee, 0, 0);
        }
    }

    function sendPayments(
        uint256 sellerPayment,
        uint256 validatorFee,
        uint256 buyerRefundPayment,
        uint256 buyerRefundFee
    ) private returns (bool) {
        bool isPaid = false;

        if (sellerPayment > 0) {
            isPaid = true;
            paymentToken.safeTransfer(seller, sellerPayment);
        }
        if (validatorFee > 0) {
            isPaid = true;
            feeToken.safeTransfer(validator, validatorFee);
        }
        if (buyerRefundPayment > 0) {
            isPaid = true;
            paymentToken.safeTransfer(buyer, buyerRefundPayment);
        }
        if (buyerRefundFee > 0) {
            isPaid = true;
            feeToken.safeTransfer(buyer, buyerRefundFee);
        }

        return isPaid;
    }

    /// @dev Amount of payment token that should be paid seller from the start of the contract till the current time
    function getDeliveredPayment() private view returns (uint256) {
        uint256 elapsedContractTime = (block.timestamp - startingBlockTimestamp);
        if (elapsedContractTime <= terms._length) {
            return (terms._price * elapsedContractTime) / terms._length;
        }
        return terms._price;
    }

    /// @dev Returns true if the payment is due. That happens if the contract ran till completion
    /// @dev but payment was not claimed.
    function isPaymentResolved() private view returns (bool) {
        return startingBlockTimestamp == 0;
    }

    /// @dev Indicates that the payment for the last contract run is resolved
    function setPaymentResolved() private {
        startingBlockTimestamp = 0;
        terms._price = 0;
    }

    modifier onlyCloneFactory() {
        require(_msgSender() == address(cloneFactory), "only clonefactory can call this function");
        _;
    }
}
