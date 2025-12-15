// SPDX-License-Identifier: MIT
pragma solidity >0.8.0;

import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ContextUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { CloneFactoryV2 } from "./CloneFactory.sol";
import { HashrateOracle } from "../marketplace/HashrateOracle.sol";
import { Versionable } from "../util/versionable.sol";
import { ResellFlags } from "./lib.sol";
// import { console } from "hardhat/console.sol";

/// @title Implementation
/// @author Oleksandr (Shev) Shevchuk (Lumerin)
/// @notice A smart contract implementation for managing hashrate rental agreements in a decentralized marketplace
/// @dev This contract handles the core logic for hashrate rental contracts, including:
///      - Contract lifecycle management (purchase, execution, early closure)
///      - Payment processing and escrow management, including validator fees
///      - Dynamic pricing based on hashrate oracle
///      - Contract terms management and updates
///      - Historical record keeping
contract ImplementationV2 is Versionable, ContextUpgradeable {
    Terms public terms; // the terms of the contract
    Terms public futureTerms; // the terms of the contract to be applied after the current contract is closed
    bool public isDeleted; // used to track if the contract is deleted

    string public pubKey; // public key of the seller used to encrypt the destination URL

    uint32 public successCount;
    uint32 public failCount;

    ResellTerms[] public resellChain; // terms keep the tip of the resell chain

    uint8 public constant VALIDATOR_FEE_DECIMALS = 18;
    string public constant VERSION = "3.0.3"; // This will be replaced during build time

    // shared between all contract instances, and updated altogether with the implementation
    HashrateOracle public immutable hashrateOracle;
    CloneFactoryV2 public immutable cloneFactory;
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

    // ResellTerms is a struct that stores the terms of the each resell of the contract
    // Each entry has one part - purchase terms (buyer,price,fee,destination,validator)
    // and another part - resell terms (profitTarget)
    struct ResellTerms {
        // purchase terms
        address _buyer;
        address _validator;
        uint256 _price;
        uint256 _fee;
        uint256 _startTime;
        string _encrDestURL;
        string _encrValidatorURL;
        uint256 _lastSettlementTime; // timestamp when the contract was settled last time
        // resell terms
        address _seller; // seller of the contract !== account when there is a default buyer
        uint256 _resellPrice; // fixed price of the resell, has priority over profit target
        int8 _resellProfitTarget; // if resellPrice is not set then use profit target
        bool _isResellable;
        bool _isResellToDefaultBuyer; // indicates that this resell is to the default buyer, so if anyone buys the contract, they buy it from the reseller
    }

    /// @dev terms of the contract that are fixed between resells
    /// @param _speed hashrate of the contract in hashes/second
    /// @param _length duration of the contract in seconds
    /// @param _version to prevent frontrunning terms update when purchase tx is discovered
    struct Terms {
        uint256 _speed;
        uint256 _length;
        uint32 _version;
    }

    // event meant to replace querying contract history
    event contractPurchased(
        address indexed _buyer,
        address indexed _validator,
        address indexed _seller,
        uint256 _price,
        uint256 _fee,
        uint256 _resellPrice,
        ResellFlags _resellFlags
    );

    event contractClosedEarly(
        address indexed _buyer,
        address indexed _validator,
        address indexed _seller,
        CloseReason _reason,
        ResellFlags _resellFlags
    );
    event destinationUpdated(string newValidatorURL, string newDestURL);
    event contractTermsUpdated(uint256 _speed, uint256 _length, uint32 _version);
    event fundsClaimed();

    /// @param _cloneFactory Address of the clone factory for access control
    /// @param _hashrateOracle Address of the hashrate oracle for profit calculation
    /// @param _paymentToken Address of the payment token to pay the provider
    /// @param _feeToken Address of the payment token to pay the validator
    constructor(address _cloneFactory, address _hashrateOracle, address _paymentToken, address _feeToken) {
        _disableInitializers();
        cloneFactory = CloneFactoryV2(_cloneFactory);
        hashrateOracle = HashrateOracle(_hashrateOracle);
        paymentToken = IERC20(_paymentToken);
        feeToken = IERC20(_feeToken);
    }

    /// @notice Initializes the contract with basic parameters
    /// @param _seller Address of the seller of the contract
    /// @param _pubKey Encrypted data for pool target info
    /// @param _speed Hashrate of the contract, hashes/second
    /// @param _length Length of the contract in seconds
    /// @param _profitTarget Profit target in percentage (e.g., 10 means 10% higher than mining price)
    function initialize(address _seller, string calldata _pubKey, uint256 _speed, uint256 _length, int8 _profitTarget)
        external
        initializer
    {
        pubKey = _pubKey;
        terms = Terms(_speed, _length, 0);
        // seller = _seller;
        resellChain.push(
            ResellTerms({
                _buyer: _seller,
                // buy terms
                _validator: address(0),
                _price: 0,
                _fee: 0,
                _startTime: 0,
                _encrDestURL: "",
                _encrValidatorURL: "",
                _lastSettlementTime: 0,
                // resell terms
                _isResellable: true,
                _seller: _seller,
                _resellPrice: 0,
                _resellProfitTarget: _profitTarget,
                _isResellToDefaultBuyer: false
            })
        );
    }

    /// @dev function that the clone factory calls to purchase the contract
    /// @dev the payment should be transeferred after calling this function
    /// @param _buyer buyer of the contract
    /// @param _seller reseller of the contract, if default buyer is used, it will be the original reseller
    function setPurchaseContract(
        string calldata _encrValidatorURL,
        string calldata _encrDestURL,
        uint256 _price,
        uint256 _fee,
        address _buyer,
        address _seller,
        address _validator,
        ResellFlags calldata _resellFlags,
        uint256 _resellPrice
    ) external onlyCloneFactory {
        require(contractState() == ContractState.Available, "contract is not in an available state");

        resellChain.push(
            ResellTerms({
                _buyer: _buyer,
                // buy terms
                _validator: _validator,
                _price: _price,
                _fee: _fee,
                _startTime: block.timestamp,
                _encrDestURL: _encrDestURL,
                _encrValidatorURL: _encrValidatorURL,
                _lastSettlementTime: block.timestamp,
                // resell terms
                _isResellable: _resellFlags.isResellable,
                _seller: _seller,
                _resellPrice: _resellPrice,
                _resellProfitTarget: 0,
                _isResellToDefaultBuyer: _resellFlags.isResellToDefaultBuyer
            })
        );
        // console.log("\n\nadded to resellChain", resellChain.length);
        // console.log("resellChain[0]._account", _buyer);
        // console.log("resellChain[0]._seller", _seller);
        // console.log("resellChain[0]._validator", _validator);
        // console.log("resellChain[0]._price", _price);
        // console.log("resellChain[0]._fee", _fee);
        // console.log("resellChain[0]._startTime", block.timestamp);
        // console.log("resellChain[0]._lastSettlementTime", block.timestamp);
        // console.log("resellChain[0]._isResellable", _resellFlags.isResellable);
        // console.log("resellChain[0]._isResellToDefaultBuyer", _resellFlags.isResellToDefaultBuyer);

        successCount++;

        emit contractPurchased(_buyer, _validator, _seller, _price, _fee, _resellPrice, _resellFlags);
    }

    /// @notice Updates the mining destination during contract execution
    /// @param _encrValidatorURL New encrypted validator URL
    /// @param _encrDestURL New encrypted destination URL
    function setDestination(string calldata _encrValidatorURL, string calldata _encrDestURL) external {
        ResellTerms storage latestResell = _getLatestResell();
        require(_msgSender() == latestResell._buyer, "not authorized");
        require(contractState() == ContractState.Running, "not running");
        latestResell._encrValidatorURL = _encrValidatorURL;
        latestResell._encrDestURL = _encrDestURL;
        emit destinationUpdated(_encrValidatorURL, _encrDestURL);
    }

    /// @dev function to be called by clonefactory which can edit the cost, length, and hashrate of a given contract
    function setTerms(uint256 _speed, uint256 _length) external onlyCloneFactory {
        if (contractState() == ContractState.Running) {
            futureTerms = Terms(_speed, _length, terms._version + 1);
        } else {
            terms = Terms(_speed, _length, terms._version + 1);
        }
        emit contractTermsUpdated(_speed, _length, terms._version + 1);
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

        uint256 endTime = getEndTime();

        for (uint256 i = resellChain.length; i > 1; i--) {
            ResellTerms storage resell = resellChain[i - 1];

            bool isDefaultBuyer = resell._seller != resell._buyer;
            // console.log("\n\n");
            // console.log("now", block.timestamp);
            // console.log("i", i);
            // console.log("resellChain.length", resellChain.length);
            // console.log("resell._buyer", resell._buyer);
            // console.log("resell._seller", resell._seller);
            // console.log("resell._validator", resell._validator);
            // console.log("resell._price", resell._price);
            // console.log("resell._fee", resell._fee);
            // console.log("resell._startTime", resell._startTime);
            // console.log("resell._lastSettlementTime", resell._lastSettlementTime);
            // console.log("resell._isResellable", resell._isResellable);
            // console.log("resell._isResellToDefaultBuyer", resell._isResellToDefaultBuyer);
            // console.log("resell._resellProfitTarget");
            // console.logInt(resell._resellProfitTarget);
            // console.log("endTime", getEndTime());
            // console.log("isDefaultBuyer", isDefaultBuyer);
            // console.log();

            if (resell._buyer == address(0)) {
                break;
            }
            ResellTerms memory _seller = resellChain[i - 2];

            (uint256 a, uint256 b, uint256 c, uint256 d) = getPayments(isDefaultBuyer, resell);
            // if it is a resell to default buyer, then it will be settled fully when the real buyer purchases the contract
            resell._lastSettlementTime = isDefaultBuyer ? endTime : block.timestamp;
            if (sendPayments(a, b, c, d, _seller._seller, resell._validator, resell._buyer)) {
                paid = true;
            }
        }

        if (endTime > 0 && block.timestamp >= endTime) {
            // console.log("===End of contract,removing history");
            for (; resellChain.length > 1;) {
                resellChain.pop();
            }
        }

        if (paid) {
            emit fundsClaimed();
        }

        maybeApplyFutureTerms();
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
        if (_getLatestResell()._resellPrice > 0) {
            return _getLatestResell()._resellPrice;
        }
        return priceV2(_getLatestResell()._resellProfitTarget);
    }

    // terms with length of the contract run
    function priceV2(int8 _profitTarget) public view returns (uint256) {
        uint256 hashesForToken = hashrateOracle.getHashesforToken();
        uint256 endTime = getEndTime();
        uint256 remainingTime;
        if (endTime < block.timestamp) {
            remainingTime = terms._length;
        } else {
            remainingTime = endTime - block.timestamp;
        }

        uint256 priceInToken = (remainingTime * terms._speed) / hashesForToken;
        int256 priceInTokenWithProfit = int256(priceInToken) + (int256(priceInToken) * int256(_profitTarget)) / 100;

        return priceInTokenWithProfit < 0 ? 0 : uint256(priceInTokenWithProfit);
    }

    function priceUnchecked() private view returns (uint256) {
        ResellTerms storage latestPurchase = _getLatestResell();

        uint256 hashesForToken = hashrateOracle.getHashesForTokenUnchecked();
        uint256 priceInToken = (terms._length * terms._speed) / hashesForToken;
        int256 priceInTokenWithProfit =
            int256(priceInToken) + (int256(priceInToken) * int256(latestPurchase._resellProfitTarget)) / 100;

        return priceInTokenWithProfit < 0 ? 0 : uint256(priceInTokenWithProfit);
    }

    function maybeApplyFutureTerms() private {
        if (!isReselling() && futureTerms._version != 0) {
            terms = Terms(futureTerms._speed, futureTerms._length, futureTerms._version);
            futureTerms = Terms(0, 0, 0);
            emit contractTermsUpdated(futureTerms._speed, futureTerms._length, futureTerms._version);
        }
    }

    //TODO: add maybeApplyFutureProfitTarget that should work for every reseller
    // fucntion maybeApplyFutureProfitTarget()

    /// @notice Allows the buyer or validator to close out the contract early
    /// @param reason The reason for the early closeout
    function closeEarly(CloseReason reason) external {
        ResellTerms memory latestPurchase = _getLatestResell();
        // console.log("latestBuyer", latestPurchase._buyer);

        require(
            _msgSender() == latestPurchase._buyer || _msgSender() == latestPurchase._validator,
            "this account is not authorized to trigger an early closeout"
        );
        require(block.timestamp < getEndTime(), "the contract is not in the running state");

        successCount--;
        failCount++;

        (uint256 a, uint256 b, uint256 c, uint256 d) = getPayments(true, latestPurchase);

        maybeApplyFutureTerms();

        resellChain.pop();

        ResellTerms storage _latestResell = _getLatestResell();
        // console.log("updated seller", _latestResell._buyer);
        emit contractClosedEarly(
            latestPurchase._buyer,
            latestPurchase._validator,
            _latestResell._buyer,
            reason,
            ResellFlags({
                isResellable: _latestResell._isResellable,
                isResellToDefaultBuyer: _latestResell._isResellToDefaultBuyer
            })
        );
        sendPayments(a, b, c, d, _latestResell._buyer, latestPurchase._validator, latestPurchase._buyer);
        if (_latestResell._isResellToDefaultBuyer) {
            _latestResell._lastSettlementTime = block.timestamp;
        }
        claimFunds();
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

        uint256 totalPurchaseDuration = getEndTime() - p._startTime;

        // avoiding error when _lastSettlementTime is in the future
        uint256 unpaidDuration = 0;
        if (p._lastSettlementTime <= block.timestamp) {
            unpaidDuration = min(block.timestamp, getEndTime()) - p._lastSettlementTime;
        }

        uint256 unpaidDeliveredPayment = p._price * unpaidDuration / totalPurchaseDuration;
        uint256 unpaidDeliveredFee = p._fee * unpaidDuration / totalPurchaseDuration;

        if (isCloseout) {
            // refund the buyer for the undelivered payment and fee
            return (unpaidDeliveredPayment, unpaidDeliveredFee, undeliveredPayment, undeliveredFee);
        } else {
            return (unpaidDeliveredPayment, unpaidDeliveredFee, 0, 0);
        }
    }

    function _getLatestResell() private view returns (ResellTerms storage) {
        return resellChain[resellChain.length - 1];
    }

    function getLatestResell() external view returns (ResellTerms memory) {
        return resellChain[resellChain.length - 1];
    }

    function getStartTime() private view returns (uint256) {
        if (resellChain.length <= 1) {
            return 0;
        }
        return resellChain[1]._startTime;
    }

    /// @notice Returns the current state of the contract
    /// @return ContractState Current contract state (Available or Running)
    function contractState() public view returns (ContractState) {
        ResellTerms memory latestResell = _getLatestResell();

        if (latestResell._isResellable) {
            return ContractState.Available;
        }
        if (latestResell._isResellToDefaultBuyer) {
            return ContractState.Available;
        }
        if (latestResell._buyer == address(0)) {
            return ContractState.Available;
        }
        if (resellChain.length == 1) {
            return ContractState.Available;
        }
        if (block.timestamp >= latestResell._startTime + terms._length) {
            return ContractState.Available;
        }
        return ContractState.Running;
    }

    function sendPayments(
        uint256 sellerPayment,
        uint256 validatorFee,
        uint256 buyerRefundPayment,
        uint256 buyerRefundFee,
        address _seller,
        address _validator,
        address _buyer
    ) private returns (bool) {
        bool isPaid = false;

        if (sellerPayment > 0) {
            isPaid = true;
            // console.log("===Sending seller payment", sellerPayment, _seller);
            paymentToken.safeTransfer(_seller, sellerPayment);
        }
        if (validatorFee > 0 && _validator != address(0)) {
            isPaid = true;
            // console.log("===Sending validator fee", validatorFee, _validator);
            feeToken.safeTransfer(_validator, validatorFee);
        }
        if (buyerRefundPayment > 0) {
            isPaid = true;
            // console.log("===Sending buyer refund payment", buyerRefundPayment, _buyer);
            paymentToken.safeTransfer(_buyer, buyerRefundPayment);
        }
        if (buyerRefundFee > 0) {
            isPaid = true;
            // console.log("===Sending buyer refund fee", buyerRefundFee, _buyer);
            feeToken.safeTransfer(_buyer, buyerRefundFee);
        }

        return isPaid;
    }

    /// @dev Amount of payment token that should be paid seller from the start of the contract till the current time
    // TODO: inline getDeliveredPayment and getDeliveredFee
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
        uint256 startTime = getStartTime();
        if (startTime == 0) {
            return 0;
        }
        return startTime + terms._length;
    }

    function seller() public view returns (address) {
        return _getLatestResell()._seller;
    }

    /// @notice Returns true if the contract is reselling
    /// @dev It means that the contract resell chain has at least one reseller
    function isReselling() public view returns (bool) {
        return resellChain.length > 1;
    }

    function owner() public view returns (address) {
        return resellChain[0]._buyer;
    }

    function min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    modifier onlyCloneFactory() {
        require(_msgSender() == address(cloneFactory), "only clonefactory can call this function");
        _;
    }
}
