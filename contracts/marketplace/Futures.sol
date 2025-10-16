//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { HashrateOracle } from "./HashrateOracle.sol";
// import { console } from "hardhat/console.sol";

// TODO:
// 1. Fix margin calculation before creating order/positions (use getCollateralDeficit)
// 3. Write tests for offseting order/positions
// 4. Add fees
// 6. Do we need to batch same price and delivery date orders/positions so it is a single entry?

contract Futures is UUPSUpgradeable, OwnableUpgradeable, ERC20Upgradeable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    uint8 public constant BREACH_PENALTY_DECIMALS = 18;
    uint32 private constant SECONDS_PER_DAY = 3600 * 24;
    uint256 private constant MAX_BREACH_PENALTY_RATE_PER_DAY = 5 * 10 ** (BREACH_PENALTY_DECIMALS - 2); // 5%
    uint8 public constant MAX_ORDERS_PER_PARTICIPANT = 50;

    uint8 public sellerLiquidationMarginPercent;
    uint8 public buyerLiquidationMarginPercent;

    IERC20 public token;
    HashrateOracle public hashrateOracle;
    address public validatorAddress; // address of the validator that can close orders that are not delivered and regularly calls marginCall function
    uint256 public breachPenaltyRatePerDay; // penalty for breaching the contract either by seller or buyer

    EnumerableSet.UintSet private deliveryDates; // delivery dates for the futures
    uint256 public speedHps; // speed of the one unit of futures in hashes/second, constant for all positions
    uint32 public deliveryDurationSeconds; // 30 days, constant for all orders
    uint256 public priceLadderStep;

    uint256 private nonce = 0;
    uint8 private _decimals;

    struct Order {
        address participant; // address of seller or buyer
        uint256 price; // price of the position
        uint256 deliveryDate; // date of delivery, when contract delivery is started
        bool isBuy; // true if long/buy position, false if short/sell position
        uint256 timestamp; // when position is opened
    }

    struct Position {
        address seller;
        address buyer;
        uint256 price;
        uint256 startTime;
        uint256 timestamp;
    }

    mapping(bytes32 => Order) private orders;
    mapping(bytes32 => Position) private positions;

    EnumerableSet.Bytes32Set private orderIds;
    EnumerableSet.Bytes32Set private positionIds;

    mapping(uint256 => mapping(uint256 => EnumerableSet.Bytes32Set)) private deliveryDatePriceOrdersLongIdIndex; // index of long positions by delivery date and price
    mapping(uint256 => mapping(uint256 => EnumerableSet.Bytes32Set)) private deliveryDatePriceOrdersShortIdIndex; // index of short positions by delivery date and price
    mapping(address => EnumerableSet.Bytes32Set) private participantPositionIdsIndex; // index of  positions by participant
    mapping(address => EnumerableSet.Bytes32Set) private participantOrderIdsIndex; // index of orders by participant
    mapping(address => mapping(uint256 => EnumerableSet.Bytes32Set)) private participantDeliveryDatePositionIdsIndex; // index of positions by participant and delivery date

    event DeliveryDateAdded(uint256 deliveryDate);
    event OrderCreated(
        bytes32 indexed orderId, address indexed participant, uint256 price, uint256 deliveryDate, bool isBuy
    );
    event OrderClosed(bytes32 indexed orderId, address indexed participant);
    event PositionCreated(
        bytes32 indexed positionId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 startTime,
        bytes32 orderId
    );
    event PositionClosed(bytes32 indexed positionId);
    event PositionDeliveryClosed(bytes32 indexed positionId, address indexed closedBy);

    error InvalidPrice();
    error DeliveryDateShouldBeInTheFuture();
    error DeliveryDateNotAvailable();
    error OrderNotBelongToSender();
    error InsufficientMarginBalance();
    error OnlyValidator(); // when the function is called by a non-validator address
    error OnlyPositionSellerOrBuyer();
    error OnlyValidatorOrPositionParticipant();
    error PositionNotExists();
    error PositionDeliveryNotStartedYet();
    error PositionDeliveryExpired();
    error MaxOrdersPerParticipantReached();
    error ValueOutOfRange(int256 min, int256 max);

    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20Metadata _token,
        HashrateOracle _hashrateOracle,
        address _validatorAddress,
        uint8 _sellerLiquidationMarginPercent,
        uint8 _buyerLiquidationMarginPercent,
        uint256 _speedHps,
        uint32 _deliveryDurationSeconds,
        uint256 _priceLadderStep
    ) public initializer {
        __Ownable_init(_msgSender());
        __UUPSUpgradeable_init();
        __ERC20_init(string.concat("Lumerin Futures ", _token.symbol()), string.concat("w", _token.symbol()));
        _decimals = _token.decimals();
        token = _token;
        hashrateOracle = _hashrateOracle;
        validatorAddress = _validatorAddress;
        sellerLiquidationMarginPercent = _sellerLiquidationMarginPercent;
        buyerLiquidationMarginPercent = _buyerLiquidationMarginPercent;
        speedHps = _speedHps;
        deliveryDurationSeconds = _deliveryDurationSeconds; // 30 days
        breachPenaltyRatePerDay = 1 * 10 ** (BREACH_PENALTY_DECIMALS - 2); // 1%
        priceLadderStep = _priceLadderStep;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Only the owner can upgrade the contract
    }

    function addDeliveryDate(uint256 _deliveryDate) public onlyOwner {
        if (_deliveryDate < block.timestamp) {
            revert DeliveryDateShouldBeInTheFuture();
        }
        deliveryDates.add(_deliveryDate);
        emit DeliveryDateAdded(_deliveryDate);
    }

    function deliveryDatesLength() public view returns (uint256) {
        return deliveryDates.length();
    }

    function deliveryDateByIndex(uint256 _index) public view returns (uint256) {
        return deliveryDates.at(_index);
    }

    function createOrder(uint256 _price, uint256 _deliveryDate, uint8 _qty, bool _isBuy) public {
        _createOrMatchOrder(_price, _deliveryDate, _qty, _isBuy, _msgSender());
    }

    function _createOrMatchOrder(uint256 _price, uint256 _deliveryDate, uint8 _qty, bool _isBuy, address _participant)
        private
    {
        validatePrice(_price);
        validateDeliveryDate(_deliveryDate);

        uint256 marginNeeded = calculateRequiredMargin(_qty, _isBuy);
        int256 collateralDeficit = getCollateralDeficit(_participant);
        if (-collateralDeficit < int256(marginNeeded)) {
            revert InsufficientMarginBalance();
        }

        // check if there is a different order with same price and delivery date
        EnumerableSet.Bytes32Set storage oppositeOrderIndexId;
        EnumerableSet.Bytes32Set storage orderIndexId;

        if (_isBuy) {
            oppositeOrderIndexId = deliveryDatePriceOrdersShortIdIndex[_deliveryDate][_price];
            orderIndexId = deliveryDatePriceOrdersLongIdIndex[_deliveryDate][_price];
        } else {
            oppositeOrderIndexId = deliveryDatePriceOrdersLongIdIndex[_deliveryDate][_price];
            orderIndexId = deliveryDatePriceOrdersShortIdIndex[_deliveryDate][_price];
        }
        for (uint8 i = 0; i < _qty; i++) {
            _createOrMatchSingleOrder(orderIndexId, oppositeOrderIndexId, _participant, _price, _deliveryDate, _isBuy);
        }
    }

    function _createOrMatchSingleOrder(
        EnumerableSet.Bytes32Set storage orderIndexId,
        EnumerableSet.Bytes32Set storage oppositeOrderIndexId,
        address _participant,
        uint256 _price,
        uint256 _deliveryDate,
        bool _isBuy
    ) private {
        //
        // No matching order found
        //
        if (oppositeOrderIndexId.length() == 0) {
            EnumerableSet.Bytes32Set storage participantOrders = participantOrderIdsIndex[_participant];
            if (participantOrders.length() >= MAX_ORDERS_PER_PARTICIPANT) {
                revert MaxOrdersPerParticipantReached();
            }
            bytes32 _orderId = _createOrder(_participant, _price, _deliveryDate, _isBuy);
            orderIndexId.add(_orderId);
            participantOrders.add(_orderId);
            return;
        }

        //
        // found matching order
        //
        bytes32 oppositeOrderId = oppositeOrderIndexId.at(0);
        Order memory oppositeOrder = orders[oppositeOrderId];

        // delete matching order
        _closeOrder(oppositeOrderId, oppositeOrder);

        // create new position
        _createPosition(oppositeOrderId, oppositeOrder, _participant);
    }

    function _createOrder(address _participant, uint256 _price, uint256 _deliveryDate, bool _isBuy)
        private
        returns (bytes32)
    {
        bytes32 orderId = keccak256(abi.encode(_participant, _price, _deliveryDate, _isBuy, block.timestamp, nonce++));
        orders[orderId] = Order({
            participant: _participant,
            price: _price,
            deliveryDate: _deliveryDate,
            isBuy: _isBuy,
            timestamp: block.timestamp
        });
        orderIds.add(orderId);

        emit OrderCreated(orderId, _participant, _price, _deliveryDate, _isBuy);
        return orderId;
    }

    function _createPosition(bytes32 orderId, Order memory order, address _otherParticipant) private {
        if (order.participant == _otherParticipant) {
            // TODO: check if this correct for buying your own order
            // if the order is already created by the participant, then do not create a position
            // but this will happen only if the participant order is the oldest
            // otherwise it will create an position with the one who has the oldest order
            // keeping participant order still active

            // not sure how to display this to the user
            return;
        }

        // create position
        address seller;
        address buyer;
        if (order.isBuy) {
            buyer = order.participant;
            seller = _otherParticipant;
        } else {
            buyer = _otherParticipant;
            seller = order.participant;
        }

        EnumerableSet.Bytes32Set storage participantDeliveryDatePositionIds =
            participantDeliveryDatePositionIdsIndex[order.participant][order.deliveryDate];
        if (participantDeliveryDatePositionIds.length() > 0) {
            bytes32 existingPositionId = participantDeliveryDatePositionIds.at(0);
            Position memory existingPosition = positions[existingPositionId];

            if (existingPosition.buyer == order.participant && !order.isBuy) {
                seller = existingPosition.seller;
                buyer = _otherParticipant;
                _removePosition(existingPositionId, existingPosition.seller, existingPosition.buyer);
                emit PositionClosed(existingPositionId);
                participantDeliveryDatePositionIds.remove(existingPositionId);
            } else if (existingPosition.seller == order.participant && order.isBuy) {
                seller = _otherParticipant;
                buyer = existingPosition.buyer;
                _removePosition(existingPositionId, existingPosition.seller, existingPosition.buyer);
                emit PositionClosed(existingPositionId);
                participantDeliveryDatePositionIds.remove(existingPositionId);
            }
        }

        bytes32 positionId = keccak256(abi.encode(seller, buyer, order.price, order.deliveryDate, block.timestamp));
        positions[positionId] = Position({
            seller: seller,
            buyer: buyer,
            price: order.price,
            startTime: order.deliveryDate,
            timestamp: block.timestamp
        });
        positionIds.add(positionId);
        participantPositionIdsIndex[seller].add(positionId);
        participantPositionIdsIndex[buyer].add(positionId);
        participantDeliveryDatePositionIdsIndex[seller][order.deliveryDate].add(positionId);
        participantDeliveryDatePositionIdsIndex[buyer][order.deliveryDate].add(positionId);
        emit PositionCreated(positionId, seller, buyer, order.price, order.deliveryDate, orderId);
    }

    function closeOrder(bytes32 _orderId) public {
        Order memory order = orders[_orderId];
        if (order.participant != _msgSender()) {
            revert OrderNotBelongToSender();
        }
        _closeOrder(_orderId, order);
    }

    function _closeOrder(bytes32 orderId, Order memory order) private {
        EnumerableSet.Bytes32Set storage orderIndexId;
        if (order.isBuy) {
            orderIndexId = deliveryDatePriceOrdersLongIdIndex[order.deliveryDate][order.price];
        } else {
            orderIndexId = deliveryDatePriceOrdersShortIdIndex[order.deliveryDate][order.price];
        }

        orderIndexId.remove(orderId);
        orderIds.remove(orderId);

        participantOrderIdsIndex[order.participant].remove(orderId);
        delete orders[orderId];
        emit OrderClosed(orderId, order.participant);
    }

    function addMargin(uint256 _amount) public {
        token.safeTransferFrom(_msgSender(), address(this), _amount);
        _mint(_msgSender(), _amount);
    }

    function removeMargin(uint256 _amount) public enoughMarginBalance(_msgSender(), _amount) {
        _burn(_msgSender(), _amount);
        token.safeTransfer(_msgSender(), _amount);
    }

    /**
     * @notice Gets the minimum margin required to keep the participant's positions and orders open
     * @param _participant The participant to get the minimum margin for
     * @return The minimum margin required to keep the participant's positions and orders open
     */
    function getMarginShortfall(address _participant) public view returns (int256) {
        uint256 sellQ = 0;
        uint256 buyQ = 0;
        int256 marginShortfall = 0;

        // calculate orders
        EnumerableSet.Bytes32Set storage _orders = participantOrderIdsIndex[_participant];
        for (uint256 i = 0; i < _orders.length(); i++) {
            bytes32 orderId = _orders.at(i);
            Order memory order = orders[orderId];
            if (order.isBuy) {
                buyQ++;
            } else {
                sellQ++;
            }
        }

        //TODO: check if ok to use market price for orders, or should we use price of the order
        marginShortfall += int256(calculateRequiredMargin(sellQ, false));
        marginShortfall += int256(calculateRequiredMargin(buyQ, true));

        // calculate positions
        int256 positionMarginBalance = 0;
        buyQ = 0;
        sellQ = 0;
        EnumerableSet.Bytes32Set storage _positions = participantPositionIdsIndex[_participant];
        for (uint256 i = 0; i < _positions.length(); i++) {
            bytes32 positionId = _positions.at(i);
            Position memory position = positions[positionId];
            bool isBuy = position.buyer == _participant;
            positionMarginBalance += getMarginBalance(position, isBuy);
            if (isBuy) {
                buyQ++;
            } else {
                sellQ++;
            }
        }

        uint256 maintenanceMargin = getMaintenanceMargin(sellQ, false) + getMaintenanceMargin(buyQ, true);
        int256 positionsMarginShortfall = int256(maintenanceMargin) - positionMarginBalance;

        return marginShortfall + positionsMarginShortfall;
    }

    function getMarginShortfallForPosition(Position memory position, bool _isBuy) public view returns (int256) {
        int256 marginBalance = getMarginBalance(position, _isBuy);
        return int256(getMaintenanceMargin(1, _isBuy)) - marginBalance;
    }

    // function calculateRequiredMargin(uint256 _sellHps, uint256 _buyHps) public view returns (uint256) {
    //     // getHashesforToken is never returning 0;
    //     uint256 hashesForToken = hashrateOracle.getHashesforToken();
    //     uint256 requiredMargin = (_sellHps * getMarginPercent(false) + _buyHps * getMarginPercent(true))
    //         * deliveryDurationSeconds / hashesForToken / 100;
    //     return requiredMargin;
    // }

    // function calculateRequiredMarginV2(uint256 _hps, bool _isBuy) public view returns (uint256) {
    //     return _hps * getMarginPercent(_isBuy) * deliveryDurationSeconds / 100 / hashrateOracle.getHashesforToken();
    // }

    function calculateRequiredMargin(uint256 _quantity, bool _isBuy) public view returns (uint256) {
        return _quantity * speedHps * deliveryDurationSeconds * getMarginPercent(_isBuy) / 100
            / hashrateOracle.getHashesforToken();
    }

    /**
     * @notice Gets the virtual margin balance (initial margin + unrealized PnL) of a position
     * @param position The position to get the margin balance of
     * @param _isBuy Whether the position is a buy position
     */
    function getMarginBalance(Position memory position, bool _isBuy) private view returns (int256) {
        uint256 initialMargin = calculateRequiredMargin(1, _isBuy);
        int256 unrealizedPnL = int256(position.price) - int256(_getMarketPrice(hashrateOracle.getHashesforToken()));
        return int256(initialMargin) + unrealizedPnL;
    }

    /**
     * @notice Gets the maintenance margin - minimal margin balance required to keep the position open
     * @param _quantity The quantity of the position
     * @param _isBuy Whether the position is a buy position
     */
    function getMaintenanceMargin(uint256 _quantity, bool _isBuy) private view returns (uint256) {
        return _quantity * _getMarketPrice(hashrateOracle.getHashesforToken()) * getMarginPercent(_isBuy) / 100;
    }

    // TODO: calculate related to remaining delivery time
    function getMarginPercent(bool _isBuy) public view returns (uint8) {
        uint8 breachPenaltyMarginPercent =
            uint8(breachPenaltyRatePerDay * deliveryDurationSeconds / 10 ** (BREACH_PENALTY_DECIMALS - 2));
        if (_isBuy) {
            return buyerLiquidationMarginPercent + breachPenaltyMarginPercent;
        } else {
            return sellerLiquidationMarginPercent + breachPenaltyMarginPercent;
        }
    }

    function marginCall(address _participant) external onlyValidator {
        int256 marginShortfall = getMarginShortfall(_participant);
        uint256 userCollateral = balanceOf(_participant);
        if (int256(userCollateral) > marginShortfall) {
            return;
        }

        int256 reclaimedMargin; // amount of margin that will be reclaimed by closing positions/orders

        // closing orders
        EnumerableSet.Bytes32Set storage _orders = participantOrderIdsIndex[_participant];
        for (; _orders.length() > 0;) {
            bytes32 orderId = _orders.at(0);
            Order memory order = orders[orderId];
            _closeOrder(orderId, order);
            if (order.isBuy) {
                reclaimedMargin += int256(getMaintenanceMargin(1, true));
            } else {
                reclaimedMargin += int256(getMaintenanceMargin(1, false));
            }
            if (reclaimedMargin >= marginShortfall) {
                return;
            }
        }

        // closing positions
        EnumerableSet.Bytes32Set storage _positions = participantPositionIdsIndex[_participant];
        for (; _positions.length() > 0;) {
            bytes32 positionId = _positions.at(0);
            Position storage position = positions[positionId];

            int256 marginBalance = getMarginBalance(position, position.seller == _participant);
            _closeAndCashSettleDeliveryAndPenalize(positionId, position, position.seller == _participant);
            reclaimedMargin += marginBalance;
            // TODO: update margin deficit since order closed and settled
            if (reclaimedMargin >= marginShortfall) {
                return;
            }
        }
    }

    /**
     * @notice Cash settles the remaining delivery and pays the breach penalty
     * @dev Buyer, seller or validator can call this function
     * @dev Validator chooses the blame party
     * @param _positionId The id of the position to close the delivery of
     * @param _blameSeller Whether the seller is blamed, ignored if called by buyer or seller
     */
    function closeDelivery(bytes32 _positionId, bool _blameSeller) public {
        // if validator closes the position then it is not delivered
        Position storage position = positions[_positionId];
        if (position.seller == address(0)) {
            revert PositionNotExists();
        }

        if (_msgSender() == position.seller) {
            _blameSeller = true;
        } else if (_msgSender() == position.buyer) {
            _blameSeller = false;
        } else if (_msgSender() != validatorAddress) {
            revert OnlyValidatorOrPositionParticipant();
        }

        if (block.timestamp < position.startTime) {
            revert PositionDeliveryNotStartedYet();
        }
        if (block.timestamp > position.startTime + deliveryDurationSeconds) {
            revert PositionDeliveryExpired();
        }

        _closeAndCashSettleDeliveryAndPenalize(_positionId, position, _blameSeller);
    }

    /**
     * @notice Cash settles the remaining delivery and pays the breach penalty
     * @param _positionId The id of the position to close the delivery of
     * @param position The position to close the delivery of
     * @param _blameSeller Whether the seller is blamed, ignored if called by buyer or seller
     */
    function _closeAndCashSettleDeliveryAndPenalize(bytes32 _positionId, Position storage position, bool _blameSeller)
        private
    {
        // calculate and pay breach penalty
        uint256 breachPenalty =
            _calculateBreachPenalty(position.price, position.startTime + deliveryDurationSeconds - block.timestamp);
        if (_blameSeller) {
            _transfer(position.seller, position.buyer, breachPenalty);
        } else {
            _transfer(position.buyer, position.seller, breachPenalty);
        }
        _closeAndCashSettleDelivery(_positionId, position);
        emit PositionDeliveryClosed(_positionId, _msgSender());
    }

    /**
     * @notice Settles position or remaining delivery in cash
     * @param _positionId The id of the position to close and settle
     * @param position The position to close and settle
     */
    function _closeAndCashSettleDelivery(bytes32 _positionId, Position storage position) private {
        uint256 positionElapsedTime = 0;
        uint256 positionRemainingTime = 0;
        if (block.timestamp > position.startTime) {
            positionElapsedTime = block.timestamp - position.startTime;
            positionRemainingTime = position.startTime + deliveryDurationSeconds - block.timestamp;
        }

        uint256 hashesForToken = hashrateOracle.getHashesforToken();

        // if the position is not started yet, then use the current price
        uint256 currentPrice = _getMarketPrice(hashesForToken);

        uint256 deliveredPayment = position.price * positionElapsedTime / deliveryDurationSeconds;
        _transfer(position.buyer, position.seller, deliveredPayment);

        int256 priceDifference = int256(currentPrice) - int256(position.price);
        uint256 pnl = abs(priceDifference) * positionRemainingTime / deliveryDurationSeconds;
        if (priceDifference > 0) {
            _transfer(position.seller, position.buyer, pnl);
        } else {
            _transfer(position.buyer, position.seller, pnl);
        }

        // remove position
        _removePosition(_positionId, position.seller, position.buyer);
    }

    function _calculateBreachPenalty(uint256 _price, uint256 remainingTime) private view returns (uint256) {
        return _price * breachPenaltyRatePerDay * remainingTime / SECONDS_PER_DAY / 10 ** BREACH_PENALTY_DECIMALS;
    }

    function _removePosition(bytes32 _positionId, address _seller, address _buyer) private {
        delete positions[_positionId];
        participantPositionIdsIndex[_seller].remove(_positionId);
        participantPositionIdsIndex[_buyer].remove(_positionId);
        positionIds.remove(_positionId);
    }

    function _getMarketPrice(uint256 _hashesForToken) private view returns (uint256) {
        return deliveryDurationSeconds * speedHps / _hashesForToken;
    }

    function getMarketPrice() public view returns (uint256) {
        return _getMarketPrice(hashrateOracle.getHashesforToken());
    }

    function getOrderById(bytes32 _orderId) public view returns (Order memory) {
        return orders[_orderId];
    }

    function getPositionById(bytes32 _positionId) public view returns (Position memory) {
        return positions[_positionId];
    }

    function setBreachPenaltyRatePerDay(uint256 _breachPenaltyRatePerDay) public onlyOwner {
        if (_breachPenaltyRatePerDay > MAX_BREACH_PENALTY_RATE_PER_DAY) {
            revert ValueOutOfRange(0, int256(MAX_BREACH_PENALTY_RATE_PER_DAY));
        }
        breachPenaltyRatePerDay = _breachPenaltyRatePerDay;
    }

    function getMinMargin(address _participant) public view returns (uint256) {
        return clamp(getMarginShortfall(_participant));
    }

    /**
     * @notice Returns how much participant needs to add to their collateral to cover the margin shortfall
     */
    function getCollateralDeficit(address _participant) public view returns (int256) {
        return getMarginShortfall(_participant) - int256(balanceOf(_participant));
    }

    function clamp(int256 _value) public pure returns (uint256) {
        if (_value > 0) {
            return uint256(_value);
        } else {
            return 0;
        }
    }

    function abs(int256 _value) public pure returns (uint256) {
        if (_value > 0) {
            return uint256(_value);
        } else {
            return uint256(-_value);
        }
    }

    function validatePrice(uint256 _price) private view {
        if (_price == 0) {
            revert InvalidPrice();
        }
        if (_price % priceLadderStep != 0) {
            revert InvalidPrice();
        }
    }

    function validateDeliveryDate(uint256 _deliveryDate) private view {
        if (_deliveryDate <= block.timestamp) {
            revert DeliveryDateShouldBeInTheFuture();
        }

        if (!deliveryDates.contains(_deliveryDate)) {
            revert DeliveryDateNotAvailable();
        }
    }

    // ERC20

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function transfer(address _to, uint256 _amount)
        public
        override
        enoughMarginBalance(_msgSender(), _amount)
        returns (bool)
    {
        return super.transfer(_to, _amount);
    }

    function transferFrom(address _from, address _to, uint256 _amount)
        public
        override
        enoughMarginBalance(_from, _amount)
        returns (bool)
    {
        return super.transferFrom(_from, _to, _amount);
    }

    modifier enoughMarginBalance(address _from, uint256 _amount) {
        uint256 balance = balanceOf(_from);
        if (balance < _amount) {
            revert ERC20InsufficientBalance(_from, balance, _amount);
        }

        if (int256(_amount) > int256(balance) - getMarginShortfall(_from)) {
            revert InsufficientMarginBalance();
        }
        _;
    }

    modifier onlyValidator() {
        if (_msgSender() != validatorAddress) {
            revert OnlyValidator();
        }
        _;
    }
}
