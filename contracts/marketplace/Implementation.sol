// SPDX-License-Identifier: MIT
pragma solidity >0.8.0;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { CloneFactory, BuyerInfo } from "./CloneFactory.sol";
import { HashrateOracle } from "./HashrateOracle.sol";
import { Versionable } from "../util/versionable.sol";
import { console } from "hardhat/console.sol";

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
    // address private __gap1;
    // address private __gap2;
    // address private __gap3;
    // address private __gap4;

    Terms public terms; // the terms of the contract
    Terms public futureTerms; // the terms of the contract to be applied after the current contract is closed
    // uint256 public startingBlockTimestamp; // time of last purchase, is set to 0 when payment is resolved
    // uint256 public validatorFeeRateScaled; // the fee rate for the validator, scaled by VALIDATOR_FEE_MULT, considering decimals
    // address public buyer; // buyer of the contract
    // address public seller; // seller of the contract
    // address public validator; // validator, can close out contract early, if empty - no validator (buyer node)
    // bool private __gap5; // not used
    bool public isDeleted; // used to track if the contract is deleted

    string public pubKey; // public key of the seller used to encrypt the destination URL
    // string public encrValidatorURL; // if using own validator (buyer-node) this will be the encrypted buyer address. Encrypted with the seller's public key
    // string public encrDestURL; // where to redirect the hashrate after validation (for both third-party validator and buyer-node) If empty, then the hashrate will be redirected to the default pool of the buyer node

    // uint256 private __gap6; // not used
    uint32 public successCount;
    uint32 public failCount;

    bool public isResellable; // if true, the contract will be listed for resell. Stores the state for the latest resell, not the entire resell chain. Updated during closeout
    ResellTerms[] public resellChain; // terms keep the tip of the resell chain

    uint8 public constant VALIDATOR_FEE_DECIMALS = 18;
    string public constant VERSION = "3.0.0"; // This will be replaced during build time

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

    struct ResellTerms {
        // offered by seller
        address _seller;
        int8 _profitTarget;
        // purchased by buyer
        address _buyer;
        address _validator;
        uint256 _price;
        uint256 _fee;
        uint256 _startTime;
        string _encrDestURL;
        string _encrValidatorURL;
        uint256 _deliveredPayment; // TODO: replace to paid checkpoint (how much time elapsed since purchase)
        uint256 _deliveredFee; // TODO: replace to paid checkpoint
    }

    struct Terms {
        // uint256 _price; // price of the current running contract at the time of purchase, 0 if contract is not running
        // uint256 _fee; // fee of the current running contract at the time of purchase
        uint256 _speed; // hashes/second
        uint256 _length; // seconds
        uint32 _version;
    }
    // int8 _profitTarget; // profit target in percentage, 10 means the price will be 10% higher than the mining price

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

    event contractPurchased(
        address indexed _buyer, address indexed _validator, address indexed _seller, uint256 _price, uint256 _fee
    );

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
        pubKey = _pubKey;
        terms = Terms(_speed, _length, 0);
        // seller = _seller;
        resellChain.push(ResellTerms(_seller, _profitTarget, address(0), address(0), 0, 0, 0, "", "", 0, 0));
    }

    function getLatestResell() private view returns (ResellTerms storage) {
        return resellChain[resellChain.length - 1];
    }

    function getFirstResell() private view returns (ResellTerms storage) {
        return resellChain[0];
    }

    function getLatestPurchase() private view returns (ResellTerms storage, bool) {
        uint256 len = resellChain.length;
        if (resellChain[len - 1]._buyer != address(0)) {
            return (resellChain[len - 1], true);
        }
        if (len == 1) {
            return (resellChain[0], false);
        }
        return (resellChain[len - 2], true);
    }

    /// @notice Returns the current state of the contract
    /// @return The current contract state (Available or Running)
    function contractState() public view returns (ContractState) {
        if (isResellable) {
            return ContractState.Available;
        }
        if (block.timestamp >= getLatestResell()._startTime + terms._length) {
            return ContractState.Available;
        }
        return ContractState.Running;
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
    // function getPublicVariablesV2()
    //     external
    //     view
    //     returns (
    //         ContractState _state,
    //         Terms memory _terms,
    //         uint256 _startingBlockTimestamp,
    //         address _buyer,
    //         address _seller,
    //         string memory _encryptedPoolData,
    //         // TODO: add this in the next release string memory _encryptedDestURL,
    //         bool _isDeleted,
    //         uint256 _balance,
    //         bool _hasFutureTerms
    //     )
    // {
    //     bool hasFutureTerms = futureTerms._length != 0;
    //     Terms memory __terms = terms;
    //     __terms._price = priceUnchecked();
    //     __terms._fee = getValidatorFee(__terms._price, getValidatorFeeRateScaled());
    //     return (
    //         contractState(),
    //         __terms,
    //         startingBlockTimestamp,
    //         buyer,
    //         seller,
    //         encrValidatorURL,
    //         isDeleted,
    //         paymentToken.balanceOf(address(this)),
    //         hasFutureTerms
    //     );
    // }

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

    /// @dev function that the clone factory calls to purchase the contract
    /// @dev the payment should be transeferred after calling this function
    function setPurchaseContract(
        string calldata _encrValidatorURL,
        string calldata _encrDestURL,
        uint256 _price,
        address _buyer,
        address _validator,
        uint256 _validatorFeeRateScaled,
        bool _isResellable,
        bool _resellToDefaultBuyer, // if true, the contract will be immediately resold to the default buyer
        int8 _resellProfitTarget
    ) external onlyCloneFactory {
        require(contractState() == ContractState.Available, "contract is not in an available state");

        claimFunds();

        maybeApplyFutureTerms();
        uint256 fee = getValidatorFee(_price, _validatorFeeRateScaled);

        ResellTerms storage latestResell = getLatestResell();
        console.log("===Contract purchased");
        console.log("===Seller", latestResell._seller);
        console.log("===Buyer", _buyer);
        console.log("");

        latestResell._buyer = _buyer;
        latestResell._validator = _validator;
        latestResell._price = _price;
        latestResell._fee = fee;
        latestResell._startTime = block.timestamp;
        latestResell._encrDestURL = _encrDestURL;
        latestResell._encrValidatorURL = _encrValidatorURL;

        // TODO: set reseller as validator to be able to close contract without destination

        if (_isResellable) {
            isResellable = true;
            if (_resellToDefaultBuyer) {
                (BuyerInfo memory defaultBuyer, int8 defaultBuyerProfitTarget) = cloneFactory.getDefaultBuyer();
                uint256 resellPrice = priceV2(getEndTime() - block.timestamp, defaultBuyerProfitTarget);
                resellChain.push(
                    ResellTerms(
                        _buyer,
                        defaultBuyerProfitTarget,
                        defaultBuyer.addr,
                        defaultBuyer.addr,
                        resellPrice,
                        getValidatorFee(_price, _validatorFeeRateScaled),
                        block.timestamp,
                        defaultBuyer.encrDestURL,
                        defaultBuyer.encrValidatorURL,
                        0,
                        0
                    )
                );
            } else {
                resellChain.push(
                    ResellTerms(_buyer, _resellProfitTarget, address(0), address(0), 0, 0, 0, "", "", 0, 0)
                );
            }
        }

        successCount++;
        history.push(
            HistoryEntry(
                block.timestamp,
                block.timestamp + terms._length,
                _price,
                fee,
                terms._speed,
                terms._length,
                _buyer,
                _validator
            )
        );

        emit contractPurchased(_msgSender());
    }

    /// @notice Updates the mining destination during contract execution
    /// @param _encrValidatorURL New encrypted validator URL
    /// @param _encrDestURL New encrypted destination URL
    function setDestination(string calldata _encrValidatorURL, string calldata _encrDestURL) external {
        // require(_msgSender() == buyer, "this account is not authorized to update the ciphertext information");
        // require(contractState() == ContractState.Running, "the contract is not in the running state");
        // encrDestURL = _encrDestURL;
        // encrValidatorURL = _encrValidatorURL;
        // emit destinationUpdated(_encrValidatorURL, _encrDestURL);
    }

    /// @dev function to be called by clonefactory which can edit the cost, length, and hashrate of a given contract
    function setUpdatePurchaseInformation(uint256 _speed, uint256 _length, int8 _profitTarget)
        external
        onlyCloneFactory
    {
        // if (contractState() == ContractState.Running) {
        //     futureTerms = Terms(0, 0, _speed, _length, terms._version + 1, _profitTarget);
        // } else {
        //     terms = Terms(0, 0, _speed, _length, terms._version + 1, _profitTarget);
        // }
        // emit purchaseInfoUpdated(address(this));
    }

    /// @dev this function is used to calculate the validator fee for the contract
    function getValidatorFee(uint256 _price, uint256 _validatorFeeRateScaled) private pure returns (uint256) {
        // fee is calculated as percentage of numerical value of contract price, that is why we need to adjust the decimals
        return (_price * _validatorFeeRateScaled) / (10 ** VALIDATOR_FEE_DECIMALS);
    }

    function getValidatorFeeRateScaled() private view returns (uint256) {
        return cloneFactory.validatorFeeRateScaled();
    }

    function setContractDeleted(bool _isDeleted) external onlyCloneFactory {
        isDeleted = _isDeleted;
    }

    /// @notice Resolves the payments for contract/validator that are due.
    /// @notice Can be called during contract execution, then returns funds for elapsed time for current contract
    /// @dev Can be called from any address, but the seller reward will be sent to the seller
    function claimFunds() public payable {
        bool paid = false;

        console.log("\n===Claiming Funds");

        for (uint256 i = resellChain.length; i > 0; i--) {
            ResellTerms storage resell = resellChain[i - 1];
            console.log("\n===Resell ", i - 1);
            console.log("===Delivered Payment", resell._deliveredPayment);
            console.log("===Delivered Fee", resell._deliveredFee);
            console.log("===Price", resell._price);
            console.log("===Fee", resell._fee);
            console.log("===StartTime", resell._startTime);
            console.log("===Buyer", resell._buyer);
            console.log("===Validator", resell._validator);
            console.log("===Seller", resell._seller);
            console.log("===Buyer", resell._buyer);
            console.log("===Profit Target");
            console.logInt(resell._profitTarget);
            console.log("");
            if (resell._buyer == address(0)) {
                continue;
            }
            (uint256 a, uint256 b, uint256 c, uint256 d) = getPayments(false, resell);
            resell._deliveredPayment += a;
            resell._deliveredFee += b;
            if (sendPayments(a, b, c, d, resell)) {
                paid = true;
            }
        }

        if (block.timestamp >= getEndTime()) {
            for (; resellChain.length > 1;) {
                resellChain.pop();
                console.log("===Popped resell", resellChain.length);
            }
        }

        if (paid) {
            emit fundsClaimed();
        }
    }

    /// @notice Resolves the payments for contract/validator that are due.
    /// @dev same as claimFunds, kept for backwards compatibility
    function claimFundsValidator() external { }

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
        ResellTerms storage latestPurchase = getLatestResell();
        uint256 hashesForToken = hashrateOracle.getHashesforToken();
        uint256 endTime = getEndTime();
        uint256 remainingTime;
        if (endTime == 0) {
            remainingTime = terms._length;
        } else {
            remainingTime = endTime - block.timestamp;
        }
        uint256 priceInToken = (remainingTime * terms._speed) / hashesForToken;
        int256 priceInTokenWithProfit =
            int256(priceInToken) + (int256(priceInToken) * int256(latestPurchase._profitTarget)) / 100;

        return priceInTokenWithProfit < 0 ? 0 : uint256(priceInTokenWithProfit);
    }

    function priceUnchecked() private view returns (uint256) {
        ResellTerms storage latestPurchase = getLatestResell();

        uint256 hashesForToken = hashrateOracle.getHashesForTokenUnchecked();
        uint256 priceInToken = (terms._length * terms._speed) / hashesForToken;
        int256 priceInTokenWithProfit =
            int256(priceInToken) + (int256(priceInToken) * int256(latestPurchase._profitTarget)) / 100;

        return priceInTokenWithProfit < 0 ? 0 : uint256(priceInTokenWithProfit);
    }

    // terms with length of the contract run
    function priceV2(uint256 _length, int8 _profitTarget) private view returns (uint256) {
        uint256 hashesForToken = hashrateOracle.getHashesforToken();
        uint256 priceInToken = (_length * terms._speed) / hashesForToken;
        int256 priceInTokenWithProfit = int256(priceInToken) + (int256(priceInToken) * int256(_profitTarget)) / 100;

        return priceInTokenWithProfit < 0 ? 0 : uint256(priceInTokenWithProfit);
    }

    function maybeApplyFutureTerms() private {
        if (!isReselling() && futureTerms._version != 0) {
            terms = Terms(futureTerms._speed, futureTerms._length, futureTerms._version);
            futureTerms = Terms(0, 0, 0);
            emit purchaseInfoUpdated(address(this));
        }
    }

    //TODO: add maybeApplyFutureProfitTarget that should work for every reseller
    // fucntion maybeApplyFutureProfitTarget()

    /// @notice Allows the buyer or validator to close out the contract early
    /// @param reason The reason for the early closeout
    function closeEarly(CloseReason reason) external {
        (ResellTerms storage latestPurchase, bool ok) = getLatestPurchase();
        ResellTerms memory latestPurchaseMemory = latestPurchase;

        require(
            _msgSender() == latestPurchase._buyer || _msgSender() == latestPurchase._validator,
            "this account is not authorized to trigger an early closeout"
        );
        require(block.timestamp < getEndTime(), "the contract is not in the running state");

        HistoryEntry storage historyEntry = history[history.length - 1];
        historyEntry._endTime = block.timestamp;
        successCount--;
        failCount++;

        (uint256 a, uint256 b, uint256 c, uint256 d) = getPayments(true, latestPurchase);

        maybeApplyFutureTerms();

        ResellTerms storage latestResell = getLatestResell();
        if (latestResell._buyer == address(0)) {
            resellChain.pop();
        }
        latestPurchase._buyer = address(0);
        latestPurchase._validator = address(0);
        latestPurchase._price = 0;
        latestPurchase._fee = 0;
        latestPurchase._startTime = 0;
        latestPurchase._encrDestURL = "";
        latestPurchase._encrValidatorURL = "";

        emit closedEarly(reason);
        sendPayments(a, b, c, d, latestPurchaseMemory);
    }

    /// @dev Pays the parties according to the payment struct
    /// @dev split into two functions (getPayments and sendPayments) to better fit check-effect-interaction pattern
    function getPayments(bool isCloseout, ResellTerms memory p)
        private
        view
        returns (uint256, uint256, uint256, uint256)
    {
        bool hasValidator = p._validator != address(0);
        uint256 deliveredPayment = getDeliveredPayment(p);
        uint256 deliveredFee = hasValidator ? getDeliveredFee(p) : 0;

        // total undelivered payment and fee for ongoing contract
        uint256 undeliveredPayment = p._price - deliveredPayment;
        uint256 undeliveredFee = hasValidator ? p._fee - deliveredFee : 0;

        // used to correctly calculate claim when contract is ongoing
        // total balance of the contract is what seller/validator should have received
        // we need to subtract the undelivered payment and fee so the buyer could be paid
        // if they decide to close out the contract early
        uint256 unpaidDeliveredPayment = deliveredPayment - p._deliveredPayment;
        uint256 unpaidDeliveredFee = deliveredFee - p._deliveredFee;

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
        uint256 buyerRefundFee,
        ResellTerms memory p
    ) private returns (bool) {
        bool isPaid = false;

        if (sellerPayment > 0) {
            isPaid = true;
            console.log("===Sending seller payment", sellerPayment, p._seller);
            console.log("===Balance before", paymentToken.balanceOf(address(this)));
            paymentToken.safeTransfer(p._seller, sellerPayment);
        }
        if (validatorFee > 0) {
            isPaid = true;
            console.log("===Sending validator fee", validatorFee, p._validator);
            feeToken.safeTransfer(p._validator, validatorFee);
        }
        if (buyerRefundPayment > 0) {
            isPaid = true;
            console.log("===Sending buyer refund payment", buyerRefundPayment, p._buyer);
            paymentToken.safeTransfer(p._buyer, buyerRefundPayment);
        }
        if (buyerRefundFee > 0) {
            isPaid = true;
            console.log("===Sending buyer refund fee", buyerRefundFee, p._buyer);
            feeToken.safeTransfer(p._buyer, buyerRefundFee);
        }

        return isPaid;
    }

    /// @dev Amount of payment token that should be paid seller from the start of the contract till the current time
    function getDeliveredPayment(ResellTerms memory p) private view returns (uint256) {
        uint256 elapsedContractTime = (block.timestamp - p._startTime);
        uint256 resellLength = getEndTime() - p._startTime;
        if (block.timestamp >= getEndTime()) {
            return p._price;
        }
        return p._price * elapsedContractTime / resellLength;
    }

    function getDeliveredFee(ResellTerms memory p) private view returns (uint256) {
        uint256 elapsedContractTime = (block.timestamp - p._startTime);
        uint256 resellLength = getEndTime() - p._startTime;
        if (block.timestamp >= getEndTime()) {
            return p._fee;
        }
        return p._fee * elapsedContractTime / resellLength;
    }

    function getEndTime() private view returns (uint256) {
        uint256 startTime = getFirstResell()._startTime;
        if (startTime == 0) {
            return 0;
        }
        return startTime + terms._length;
    }

    function seller() public view returns (address) {
        return getLatestResell()._seller;
    }

    /// @notice Returns true if the contract is reselling
    /// @dev It means that the contract resell chain has at least one reseller
    function isReselling() public view returns (bool) {
        return resellChain.length > 1;
    }

    modifier onlyCloneFactory() {
        require(_msgSender() == address(cloneFactory), "only clonefactory can call this function");
        _;
    }
}
