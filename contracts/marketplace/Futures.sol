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
    uint8 private constant MAX_POSITIONS_PER_PARTICIPANT = 50;

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

    struct Position {
        address participant; // address of seller or buyer
        uint256 price; // price of the position
        uint256 deliveryDate; // date of delivery, when contract delivery is started
        bool isBuy; // true if long/buy position, false if short/sell position
        uint256 timestamp; // when position is opened
    }

    struct Order {
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

    mapping(uint256 => mapping(uint256 => EnumerableSet.Bytes32Set)) private deliveryDatePricePositionsLongIdIndex; // index of long positions by delivery date and price
    mapping(uint256 => mapping(uint256 => EnumerableSet.Bytes32Set)) private deliveryDatePricePositionsShortIdIndex; // index of short positions by delivery date and price
    mapping(address => EnumerableSet.Bytes32Set) private participantPositionsIdIndex; // index of  positions by participant
    mapping(address => EnumerableSet.Bytes32Set) private participantOrdersIdIndex; // index of orders by participant

    event PositionCreated(
        bytes32 indexed positionId, address indexed participant, uint256 price, uint256 deliveryDate, bool isBuy
    );
    event PositionClosed(bytes32 indexed positionId, address indexed participant);
    event OrderCreated(
        bytes32 indexed orderId, address indexed seller, address indexed buyer, uint256 price, uint256 startTime
    );
    event OrderClosed(bytes32 indexed orderId, address indexed closedBy);

    error PriceCannotBeZero();
    error DeliveryDateShouldBeInTheFuture();
    error DeliveryDateNotAvailable();
    error PositionNotBelongToSender();
    error InsufficientMarginBalance();
    error CannotStartDeliveryBeforeStartTime(); // when delivery start is triggered before the start time
    error OnlyValidator(); // when the function is called by a non-validator address
    error OnlyOrderSeller();
    error OnlyOrderBuyer();
    error OrderNotExists();
    error ValidatorCannotCloseOrderBeforeStartTime();
    error OrderExpired();
    error MaxPositionsPerParticipantReached();

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
    }

    function deliveryDatesLength() public view returns (uint256) {
        return deliveryDates.length();
    }

    function deliveryDateByIndex(uint256 _index) public view returns (uint256) {
        return deliveryDates.at(_index);
    }

    function createPosition(uint256 _price, uint256 _deliveryDate, bool _isBuy) public {
        _createOrMatchPosition(_price, _deliveryDate, _isBuy, _msgSender());
    }

    function _createOrMatchPosition(uint256 _price, uint256 _deliveryDate, bool _isBuy, address _participant) private {
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

        // check if there is a different position with same price and delivery date
        EnumerableSet.Bytes32Set storage oppositePositionIndexId;
        EnumerableSet.Bytes32Set storage positionIndexId;

        if (_isBuy) {
            oppositePositionIndexId = deliveryDatePricePositionsShortIdIndex[_deliveryDate][_price];
            positionIndexId = deliveryDatePricePositionsLongIdIndex[_deliveryDate][_price];
        } else {
            oppositePositionIndexId = deliveryDatePricePositionsLongIdIndex[_deliveryDate][_price];
            positionIndexId = deliveryDatePricePositionsShortIdIndex[_deliveryDate][_price];
        }
        if (oppositePositionIndexId.length() == 0) {
            EnumerableSet.Bytes32Set storage participantPositions = participantPositionsIdIndex[_participant];
            if (participantPositions.length() >= MAX_POSITIONS_PER_PARTICIPANT) {
                revert MaxPositionsPerParticipantReached();
            }
            bytes32 _positionId = _createPosition(_participant, _price, _deliveryDate, _isBuy);
            positionIndexId.add(_positionId);
            participantPositions.add(_positionId);
            return;
        }
        //
        // found matching position
        //
        bytes32 positionId = oppositePositionIndexId.at(0);
        Position memory position = positions[positionId];
        // update positions by price and delivery date index
        oppositePositionIndexId.remove(positionId);

        participantPositionsIdIndex[position.participant].remove(positionId);
        // update global position index
        positionIds.remove(positionId);
        // delete position
        delete positions[positionId];

        _createOrder(position, _participant);
    }

    function _createPosition(address _participant, uint256 _price, uint256 _deliveryDate, bool _isBuy)
        private
        returns (bytes32)
    {
        bytes32 positionId =
            keccak256(abi.encode(_participant, _price, _deliveryDate, _isBuy, block.timestamp, nonce++));
        positions[positionId] = Position({
            participant: _participant,
            price: _price,
            deliveryDate: _deliveryDate,
            isBuy: _isBuy,
            timestamp: block.timestamp
        });
        positionIds.add(positionId);

        emit PositionCreated(positionId, _participant, _price, _deliveryDate, _isBuy);
        return positionId;
    }

    function _createOrder(Position memory position, address _otherParticipant) private {
        if (position.participant == _otherParticipant) {
            // if the position is already created by the participant, then do not create an order
            // but this will happen only if the participant position is the oldest
            // otherwise it will create an order with the one who has the oldest position
            // keeping participant position still active

            // not sure how to display this to the user
            return;
        }
        // create order
        address seller;
        address buyer;
        if (position.isBuy) {
            buyer = position.participant;
            seller = _otherParticipant;
        } else {
            buyer = _otherParticipant;
            seller = position.participant;
        }
        bytes32 orderId = keccak256(abi.encode(seller, buyer, position.price, position.deliveryDate, block.timestamp));
        orders[orderId] = Order({
            seller: seller,
            buyer: buyer,
            price: position.price,
            startTime: position.deliveryDate,
            timestamp: block.timestamp
        });
        orderIds.add(orderId);
        participantOrdersIdIndex[seller].add(orderId);
        participantOrdersIdIndex[buyer].add(orderId);
        emit OrderCreated(orderId, seller, buyer, position.price, position.deliveryDate);
    }

    function closePosition(bytes32 _positionId) public {
        Position memory position = positions[_positionId];
        if (position.participant != _msgSender()) {
            revert PositionNotBelongToSender();
        }
        _closePosition(_positionId, position);
    }

    function _closePosition(bytes32 positionId, Position memory position) private {
        EnumerableSet.Bytes32Set storage positionIndexId;
        if (position.isBuy) {
            positionIndexId = deliveryDatePricePositionsLongIdIndex[position.deliveryDate][position.price];
        } else {
            positionIndexId = deliveryDatePricePositionsShortIdIndex[position.deliveryDate][position.price];
        }

        positionIndexId.remove(positionId);
        positionIds.remove(positionId);

        participantPositionsIdIndex[position.participant].remove(positionId);
        delete positions[positionId];
        emit PositionClosed(positionId, position.participant);
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

        // calculate positions
        EnumerableSet.Bytes32Set storage _positions = participantPositionsIdIndex[_participant];
        for (uint256 i = 0; i < _positions.length(); i++) {
            bytes32 positionId = _positions.at(i);
            Position memory position = positions[positionId];
            if (position.isBuy) {
                buyHps += speedHps;
            } else {
                sellHps += speedHps;
            }
        }

        // calculate orders
        EnumerableSet.Bytes32Set storage _orders = participantOrdersIdIndex[_participant];
        for (uint256 i = 0; i < _orders.length(); i++) {
            bytes32 orderId = _orders.at(i);
            Order memory order = orders[orderId];
            if (order.seller == _participant) {
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
        if (_isBuy) {
            return buyerLiquidationMarginPercent;
        } else {
            return sellerLiquidationMarginPercent;
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

        // closing positions
        EnumerableSet.Bytes32Set storage _positions = participantPositionsIdIndex[_participant];
        for (; _positions.length() > 0;) {
            bytes32 positionId = _positions.at(0);
            Position memory position = positions[positionId];
            _closePosition(positionId, position);
            uint256 sellHps = 0;
            uint256 buyHps = 0;
            if (position.isBuy) {
                buyHps = speedHps;
            } else {
                sellHps = speedHps;
            }
            reclaimedMargin += calculateRequiredMargin(sellHps, buyHps);
            if (reclaimedMargin >= marginDeficit) {
                return;
            }
        }

        // closing orders
        EnumerableSet.Bytes32Set storage _orders = participantOrdersIdIndex[_participant];
        for (; _orders.length() > 0;) {
            bytes32 orderId = _orders.at(0);
            Order storage order = orders[orderId];
            _closeSettleOrderAndPenalize(orderId, order, order.seller == _participant);
            uint256 sellHps = 0;
            uint256 buyHps = 0;
            if (order.seller == _participant) {
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

    function closeAsValidator(bytes32 _orderId, bool _blameSeller) public onlyValidator {
        // if validator closes the order then it is not delivered
        Order storage order = orders[_orderId];
        if (order.seller == address(0)) {
            revert OrderNotExists();
        }

        if (block.timestamp < order.startTime) {
            revert ValidatorCannotCloseOrderBeforeStartTime();
        }
        if (block.timestamp > order.startTime + deliveryDurationSeconds) {
            revert OrderExpired();
        }

        _closeSettleOrderAndPenalize(_orderId, order, _blameSeller);
    }

    function _closeSettleOrderAndPenalize(bytes32 _orderId, Order storage order, bool _blameSeller) private {
        // calculate and pay breach penalty
        uint256 breachPenalty =
            _calculateBreachPenalty(order.price, order.startTime + deliveryDurationSeconds - block.timestamp);
        if (_blameSeller) {
            _transfer(order.seller, order.buyer, breachPenalty);
        } else {
            _transfer(order.buyer, order.seller, breachPenalty);
        }
        _closeAndSettleOrder(_orderId, order);
        emit OrderClosed(_orderId, _msgSender());
    }

    function closeAsBuyer(bytes32 _orderId) external {
        Order storage order = orders[_orderId];
        if (order.buyer == address(0)) {
            revert OrderNotExists();
        }
        if (order.buyer != _msgSender()) {
            revert OnlyOrderBuyer();
        }
        if (block.timestamp > order.startTime + deliveryDurationSeconds) {
            revert OrderExpired();
        }

        uint256 remainingTime;
        if (block.timestamp < order.startTime) {
            remainingTime = deliveryDurationSeconds;
            _createOrMatchPosition(order.price, order.startTime, false, order.buyer);
        } else {
            remainingTime = order.startTime + deliveryDurationSeconds - block.timestamp;
        }
        // calculate and pay breach penalty
        uint256 breachPenalty = _calculateBreachPenalty(order.price, remainingTime);
        _transfer(order.buyer, order.seller, breachPenalty);

        _closeAndSettleOrder(_orderId, order);

        emit OrderClosed(_orderId, _msgSender());
    }

    function closeAsSeller(bytes32 _orderId) external {
        Order storage order = orders[_orderId];
        if (order.seller == address(0)) {
            revert OrderNotExists();
        }
        if (order.seller != _msgSender()) {
            revert OnlyOrderSeller();
        }
        if (block.timestamp > order.startTime + deliveryDurationSeconds) {
            revert OrderExpired();
        }
        uint256 remainingTime;
        if (block.timestamp < order.startTime) {
            remainingTime = deliveryDurationSeconds;
            _createOrMatchPosition(order.price, order.startTime, false, order.buyer);
        } else {
            remainingTime = order.startTime + deliveryDurationSeconds - block.timestamp;
        }
        // calculate and pay breach penalty
        uint256 breachPenalty = _calculateBreachPenalty(order.price, remainingTime);
        _transfer(order.seller, order.buyer, breachPenalty);

        _closeAndSettleOrder(_orderId, order);

        emit OrderClosed(_orderId, _msgSender());
    }

    function _closeAndSettleOrder(bytes32 _orderId, Order storage order) private {
        uint256 orderElapsedTime = 0;
        uint256 orderRemainingTime = 0;
        if (block.timestamp > order.startTime) {
            orderElapsedTime = block.timestamp - order.startTime;
            orderRemainingTime = order.startTime + deliveryDurationSeconds - block.timestamp;
        }

        uint256 hashesForToken = hashrateOracle.getHashesforToken();

        // if the order is not started yet, then use the current price
        uint256 currentPrice = getOrderPrice(hashesForToken);

        uint256 deliveredPayment = order.price * orderElapsedTime / deliveryDurationSeconds;
        uint256 undeliveredPayment = currentPrice * orderRemainingTime / deliveryDurationSeconds;

        _transfer(order.buyer, order.seller, deliveredPayment);
        _transfer(order.seller, order.buyer, undeliveredPayment);

        // remove order
        delete orders[_orderId];

        // remove order from indexes
        participantOrdersIdIndex[order.seller].remove(_orderId);
        participantOrdersIdIndex[order.buyer].remove(_orderId);
        orderIds.remove(_orderId);
    }

    function getOrderPrice(uint256 _hashesForToken) private view returns (uint256) {
        return deliveryDurationSeconds * speedHps / _hashesForToken;
    }

    function getPositionById(bytes32 _positionId) public view returns (Position memory) {
        return positions[_positionId];
    }

    function getOrderById(bytes32 _orderId) public view returns (Order memory) {
        return orders[_orderId];
    }

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

// TODO: when order is created the seller is credited immediately
// so the seller can withdraw extra funds
// so the margin should be enough to cover the case of nondelivery

// TODO: include breach penalty in the minMargin calculation

// TODO: _createOrMatchPosition(order.price, order.startTime, false, order.buyer);
// Impact: When closing orders before start time, new positions are created without checking if the buyer has sufficient margin.
