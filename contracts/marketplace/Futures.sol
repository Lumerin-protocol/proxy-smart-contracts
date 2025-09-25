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
import { console } from "hardhat/console.sol";

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

    event DeliveryDateAdded(uint256 deliveryDate);
    event OrderCreated(
        bytes32 indexed orderId, address indexed participant, uint256 price, uint256 deliveryDate, bool isBuy
    );
    event OrderClosed(bytes32 indexed orderId, address indexed participant);
    event PositionCreated(
        bytes32 indexed positionId, address indexed seller, address indexed buyer, uint256 price, uint256 startTime
    );
    event PositionClosed(bytes32 indexed positionId, address indexed closedBy);

    error PriceCannotBeZero();
    error DeliveryDateShouldBeInTheFuture();
    error DeliveryDateNotAvailable();
    error OrderNotBelongToSender();
    error InsufficientMarginBalance();
    error CannotStartDeliveryBeforeStartTime(); // when delivery start is triggered before the start time
    error OnlyValidator(); // when the function is called by a non-validator address
    error OnlyPositionSeller();
    error OnlyPositionBuyer();
    error PositionNotExists();
    error ValidatorCannotClosePositionBeforeStartTime();
    error PositionExpired();
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
        uint32 _deliveryDurationSeconds
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

    function createOrder(uint256 _price, uint256 _deliveryDate, bool _isBuy) public {
        _createOrMatchOrder(_price, _deliveryDate, _isBuy, _msgSender());
    }

    function _createOrMatchOrder(uint256 _price, uint256 _deliveryDate, bool _isBuy, address _participant) private {
        if (_price == 0) {
            revert PriceCannotBeZero();
        }
        if (_deliveryDate <= block.timestamp) {
            revert DeliveryDateShouldBeInTheFuture();
        }

        if (!deliveryDates.contains(_deliveryDate)) {
            revert DeliveryDateNotAvailable();
        }

        uint256 minMargin = calculateRequiredMarginV2(speedHps, _isBuy);
        if (minMargin > balanceOf(_participant)) {
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
        bytes32 orderId = oppositeOrderIndexId.at(0);
        Order memory order = orders[orderId];

        // delete order
        oppositeOrderIndexId.remove(orderId);
        participantOrderIdsIndex[order.participant].remove(orderId);
        orderIds.remove(orderId);
        delete orders[orderId];

        _createPosition(order, _participant);
    }

    function _createOrder(address _participant, uint256 _price, uint256 _deliveryDate, bool _isBuy)
        private
        returns (bytes32)
    {
        bytes32 orderId =
            keccak256(abi.encode(_participant, _price, _deliveryDate, _isBuy, block.timestamp, nonce++));
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

    function _createPosition(Order memory order, address _otherParticipant) private {
        if (order.participant == _otherParticipant) {
            // TODO: check if this correct for reselling order
            // if the order is already created by the participant, then do not create a position
            // but this will happen only if the participant order is the oldest
            // otherwise it will create an position with the one who has the oldest order
            // keeping participant order still active

            // not sure how to display this to the user
            return;
        }
        // create order
        address seller;
        address buyer;
        if (order.isBuy) {
            buyer = order.participant;
            seller = _otherParticipant;
        } else {
            buyer = _otherParticipant;
            seller = order.participant;
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
        emit PositionCreated(positionId, seller, buyer, order.price, order.deliveryDate);
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

    function getMinMargin(address _participant) public view returns (uint256) {
        uint256 sellHps = 0;
        uint256 buyHps = 0;

        // calculate orders
        EnumerableSet.Bytes32Set storage _orders = participantOrderIdsIndex[_participant];
        for (uint256 i = 0; i < _orders.length(); i++) {
            bytes32 orderId = _orders.at(i);
            Order memory order = orders[orderId];
            if (order.isBuy) {
                buyHps += speedHps;
            } else {
                sellHps += speedHps;
            }
        }

        // calculate positions
        EnumerableSet.Bytes32Set storage _positions = participantPositionIdsIndex[_participant];
        for (uint256 i = 0; i < _positions.length(); i++) {
            bytes32 positionId = _positions.at(i);
            Position memory position = positions[positionId];
            if (position.seller == _participant) {
                sellHps += speedHps;
            } else {
                buyHps += speedHps;
            }
        }

        // calculate required margin
        uint256 requiredMargin = calculateRequiredMargin(sellHps, buyHps);

        return requiredMargin;
    }

    function calculateRequiredMargin(uint256 _sellHps, uint256 _buyHps) public view returns (uint256) {
        // getHashesforToken is never returning 0;
        uint256 hashesForToken = hashrateOracle.getHashesforToken();
        uint256 requiredMargin = (_sellHps * getMarginPercent(false) + _buyHps * getMarginPercent(true))
            * deliveryDurationSeconds / hashesForToken / 100;
        return requiredMargin;
    }

    function calculateRequiredMarginV2(uint256 _hps, bool _isBuy) public view returns (uint256) {
        return _hps * getMarginPercent(_isBuy) * deliveryDurationSeconds / 100 / hashrateOracle.getHashesforToken();
    }

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
        uint256 requiredMargin = getMinMargin(_participant);
        uint256 currentMargin = balanceOf(_participant);
        if (currentMargin >= requiredMargin) {
            return;
        }
        uint256 marginDeficit = requiredMargin - currentMargin;

        uint256 reclaimedMargin; // amount of margin that will be reclaimed by closing positions/orders

        // closing orders
        EnumerableSet.Bytes32Set storage _orders = participantOrderIdsIndex[_participant];
        for (; _orders.length() > 0;) {
            bytes32 orderId = _orders.at(0);
            Order memory order = orders[orderId];
            _closeOrder(orderId, order);
            uint256 sellHps = 0;
            uint256 buyHps = 0;
            if (order.isBuy) {
                buyHps = speedHps;
            } else {
                sellHps = speedHps;
            }
            reclaimedMargin += calculateRequiredMargin(sellHps, buyHps);
            if (reclaimedMargin >= marginDeficit) {
                return;
            }
        }

        // closing positions
        EnumerableSet.Bytes32Set storage _positions = participantPositionIdsIndex[_participant];
        for (; _positions.length() > 0;) {
            bytes32 positionId = _positions.at(0);
            Position storage position = positions[positionId];
            _closeSettlePositionAndPenalize(positionId, position, position.seller == _participant);
            uint256 sellHps = 0;
            uint256 buyHps = 0;
            if (position.seller == _participant) {
                sellHps = speedHps;
            } else {
                buyHps = speedHps;
            }
            // TODO: update margin deficit since order closed and settled
            reclaimedMargin += calculateRequiredMargin(sellHps, buyHps);
            if (reclaimedMargin >= marginDeficit) {
                return;
            }
        }
    }

    function _calculateBreachPenalty(uint256 _price, uint256 remainingTime) private view returns (uint256) {
        return _price * breachPenaltyRatePerDay * remainingTime / SECONDS_PER_DAY / 10 ** BREACH_PENALTY_DECIMALS;
    }

    // TODO: rename to closePositionAsValidator
    function closePositionAsValidator(bytes32 _positionId, bool _blameSeller) public onlyValidator {
        // if validator closes the position then it is not delivered
        Position storage position = positions[_positionId];
        if (position.seller == address(0)) {
            revert PositionNotExists();
        }

        if (block.timestamp < position.startTime) {
            revert ValidatorCannotClosePositionBeforeStartTime();
        }
        if (block.timestamp > position.startTime + deliveryDurationSeconds) {
            revert PositionExpired();
        }

        _closeSettlePositionAndPenalize(_positionId, position, _blameSeller);
    }

    function _closeSettlePositionAndPenalize(bytes32 _positionId, Position storage position, bool _blameSeller) private {
        // calculate and pay breach penalty
        uint256 breachPenalty =
            _calculateBreachPenalty(position.price, position.startTime + deliveryDurationSeconds - block.timestamp);
        if (_blameSeller) {
            _transfer(position.seller, position.buyer, breachPenalty);
        } else {
            _transfer(position.buyer, position.seller, breachPenalty);
        }
        _closeAndSettlePosition(_positionId, position);
        emit PositionClosed(_positionId, _msgSender());
    }

    // TODO: rename to closePositionAsBuyer
    function closePositionAsBuyer(bytes32 _positionId) external {
        Position storage position = positions[_positionId];
        if (position.buyer == address(0)) {
            revert PositionNotExists();
        }
        if (position.buyer != _msgSender()) {
            revert OnlyPositionBuyer();
        }
        if (block.timestamp > position.startTime + deliveryDurationSeconds) {
            revert PositionExpired();
        }

        uint256 remainingTime;
        if (block.timestamp < position.startTime) {
            remainingTime = deliveryDurationSeconds;
            _createOrMatchOrder(position.price, position.startTime, false, position.buyer);
        } else {
            remainingTime = position.startTime + deliveryDurationSeconds - block.timestamp;
        }
        // calculate and pay breach penalty
        uint256 breachPenalty = _calculateBreachPenalty(position.price, remainingTime);
        _transfer(position.buyer, position.seller, breachPenalty);

        _closeAndSettlePosition(_positionId, position);

        emit PositionClosed(_positionId, _msgSender());
    }

    // TODO: rename to closePositionAsSeller
    function closePositionAsSeller(bytes32 _positionId) external {
        Position storage position = positions[_positionId];
        if (position.seller == address(0)) {
            revert PositionNotExists();
        }
        if (position.seller != _msgSender()) {
            revert OnlyPositionSeller();
        }
        if (block.timestamp > position.startTime + deliveryDurationSeconds) {
            revert PositionExpired();
        }
        uint256 remainingTime;
        if (block.timestamp < position.startTime) {
            remainingTime = deliveryDurationSeconds;
            _createOrMatchOrder(position.price, position.startTime, false, position.buyer);
        } else {
            remainingTime = position.startTime + deliveryDurationSeconds - block.timestamp;
        }
        // calculate and pay breach penalty
        uint256 breachPenalty = _calculateBreachPenalty(position.price, remainingTime);
        _transfer(position.seller, position.buyer, breachPenalty);

        _closeAndSettlePosition(_positionId, position);

        emit PositionClosed(_positionId, _msgSender());
    }

    function _closeAndSettlePosition(bytes32 _positionId, Position storage position) private {
        uint256 positionElapsedTime = 0;
        uint256 positionRemainingTime = 0;
        if (block.timestamp > position.startTime) {
            positionElapsedTime = block.timestamp - position.startTime;
            positionRemainingTime = position.startTime + deliveryDurationSeconds - block.timestamp;
        }

        uint256 hashesForToken = hashrateOracle.getHashesforToken();

        // if the position is not started yet, then use the current price
        uint256 currentPrice = getMarketPrice(hashesForToken);

        uint256 deliveredPayment = position.price * positionElapsedTime / deliveryDurationSeconds;
        uint256 undeliveredPayment = currentPrice * positionRemainingTime / deliveryDurationSeconds;

        _transfer(position.buyer, position.seller, deliveredPayment);
        _transfer(position.seller, position.buyer, undeliveredPayment);

        // remove position
        delete positions[_positionId];

        // remove position from indexes
        participantPositionIdsIndex[position.seller].remove(_positionId);
        participantPositionIdsIndex[position.buyer].remove(_positionId);
        positionIds.remove(_positionId);
    }

    function getMarketPrice(uint256 _hashesForToken) private view returns (uint256) {
        return deliveryDurationSeconds * speedHps / _hashesForToken;
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
        if (balance - _amount < getMinMargin(_from)) {
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
