import { BigInt } from "@graphprotocol/graph-ts/common/numbers";
import {
  Initialized,
  PositionCreated,
  PositionClosed,
  OrderCreated,
  OrderClosed,
  DeliveryDateAdded,
} from "../generated/Futures/Futures";
import { Futures, Participant, Position, Order, DeliveryDate } from "../generated/schema";
import { log, Bytes } from "@graphprotocol/graph-ts";

export function handleInitialized(event: Initialized): void {
  log.info("Futures contract initialized with version: {}", [event.params.version.toString()]);

  // Create Futures entity
  const futures = new Futures(0);
  futures.initializedBlockNumber = event.block.number;
  futures.initializeTimestamp = event.block.timestamp;
  futures.minSellerStake = new BigInt(0);
  futures.contractCount = 0;
  futures.contractActiveCount = 0;
  futures.purchaseCount = 0;
  futures.closeoutCount = 0;
  futures.save();
}

export function handleDeliveryDateAdded(event: DeliveryDateAdded): void {
  log.info("Delivery date added: {}", [event.params.deliveryDate.toString()]);
  const deliveryDate = new DeliveryDate(
    changetype<Bytes>(Bytes.fromBigInt(event.params.deliveryDate))
  );
  deliveryDate.deliveryDate = event.params.deliveryDate;
  deliveryDate.save();
}

export function handlePositionCreated(event: PositionCreated): void {
  log.info("Position created: {} by {}", [
    event.params.positionId.toHexString(),
    event.params.participant.toHexString(),
  ]);

  // Load Futures entity (should exist from Initialized event)
  const futures = Futures.load(0);
  if (!futures) {
    log.error("Futures entity not found - contract may not be initialized", []);
    return;
  }

  // Load or create Participant
  let participant = Participant.load(event.params.participant);
  if (!participant) {
    participant = new Participant(event.params.participant);
    participant.address = event.params.participant;
    participant.positions = [];
    participant.orders = [];
    participant.positionCount = 0;
    participant.orderCount = 0;
    participant.totalVolume = new BigInt(0);
  }

  // Create Position
  const position = new Position(event.params.positionId);
  position.id = event.params.positionId;
  position.participant = participant.id;
  position.price = event.params.price;
  position.deliveryDate = event.params.deliveryDate;
  position.isBuy = event.params.isBuy;
  position.timestamp = event.block.timestamp;
  position.blockNumber = event.block.number;
  position.transactionHash = event.transaction.hash;
  position.isActive = true;
  position.save();

  // Update Participant
  participant.positions = participant.positions.concat([position.id]);
  participant.positionCount++;
  participant.totalVolume = participant.totalVolume.plus(event.params.price);
  participant.save();

  // Update Futures stats
  futures.contractCount++;
  futures.contractActiveCount++;
  futures.save();
}

export function handlePositionClosed(event: PositionClosed): void {
  log.info("Position closed: {} by {}", [
    event.params.positionId.toHexString(),
    event.params.participant.toHexString(),
  ]);

  const position = Position.load(event.params.positionId);
  if (!position) {
    log.warning("Position not found: {}", [event.params.positionId.toHexString()]);
    return;
  }

  // Update position status
  position.isActive = false;
  position.closedAt = event.block.timestamp;
  position.closedBy = event.params.participant;
  position.save();

  // Update participant
  const participant = Participant.load(position.participant);
  if (participant) {
    participant.positionCount--;
    participant.save();
  }

  // Update Futures stats
  const futures = Futures.load(0);
  if (futures) {
    futures.contractActiveCount--;
    futures.closeoutCount++;
    futures.save();
  }
}

export function handleOrderCreated(event: OrderCreated): void {
  log.info("Order created: {} by seller {} and buyer {}", [
    event.params.orderId.toHexString(),
    event.params.seller.toHexString(),
    event.params.buyer.toHexString(),
  ]);

  // Load Futures entity (should exist from Initialized event)
  const futures = Futures.load(0);
  if (!futures) {
    log.error("Futures entity not found - contract may not be initialized", []);
    return;
  }

  // Load or create Seller
  let seller = Participant.load(event.params.seller);
  if (!seller) {
    log.error("Seller not found: {}", [event.params.seller.toHexString()]);
    return;
  }

  // Load or create Buyer
  let buyer = Participant.load(event.params.buyer);
  if (!buyer) {
    log.error("Buyer not found: {}", [event.params.buyer.toHexString()]);
    return;
  }

  // Create Order
  const order = new Order(event.params.orderId);
  order.id = event.params.orderId;
  order.seller = seller.id;
  order.buyer = buyer.id;
  order.price = event.params.price;
  order.startTime = event.params.startTime;
  order.timestamp = event.block.timestamp;
  order.blockNumber = event.block.number;
  order.transactionHash = event.transaction.hash;
  order.isActive = true;
  order.save();

  // Update Seller
  seller.orders = seller.orders.concat([order.id]);
  seller.orderCount++;
  seller.totalVolume = seller.totalVolume.plus(event.params.price);
  seller.save();

  // Update Buyer
  buyer.orders = buyer.orders.concat([order.id]);
  buyer.orderCount++;
  buyer.totalVolume = buyer.totalVolume.plus(event.params.price);
  buyer.save();

  // Update Futures stats
  futures.contractCount++;
  futures.contractActiveCount++;
  futures.purchaseCount++;
  futures.save();
}

export function handleOrderClosed(event: OrderClosed): void {
  log.info("Order closed: {} by {}", [
    event.params.orderId.toHexString(),
    event.params.closedBy.toHexString(),
  ]);

  const order = Order.load(event.params.orderId);
  if (!order) {
    log.warning("Order not found: {}", [event.params.orderId.toHexString()]);
    return;
  }

  // Update order status
  order.isActive = false;
  order.closedAt = event.block.timestamp;
  order.closedBy = event.params.closedBy;
  order.save();

  // Update participants
  const seller = Participant.load(order.seller);
  if (seller) {
    seller.orderCount--;
    seller.save();
  }

  const buyer = Participant.load(order.buyer);
  if (buyer) {
    buyer.orderCount--;
    buyer.save();
  }

  // Update Futures stats
  const futures = Futures.load(0);
  if (futures) {
    futures.contractActiveCount--;
    futures.closeoutCount++;
    futures.save();
  }
}
