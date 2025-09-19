import { BigInt } from "@graphprotocol/graph-ts/common/numbers";
import {
  Initialized,
  PositionCreated,
  PositionClosed,
  OrderCreated,
  OrderClosed,
  DeliveryDateAdded,
  Transfer,
} from "../generated/Futures/Futures";
import { Futures, Participant, Position, Order, DeliveryDate } from "../generated/schema";
import { log, Bytes, Address } from "@graphprotocol/graph-ts";

// Helper function to get or create a participant with balance tracking
function getOrCreateParticipant(address: Address): Participant {
  let participant = Participant.load(address);
  if (!participant) {
    participant = new Participant(address);
    participant.address = address;
    participant.positions = [];
    participant.orders = [];
    participant.positionCount = 0;
    participant.orderCount = 0;
    participant.totalVolume = new BigInt(0);
    participant.balance = new BigInt(0);
    participant.totalDeposited = new BigInt(0);
    participant.totalWithdrawn = new BigInt(0);
    participant.lastBalanceUpdate = new BigInt(0);
  }
  return participant;
}

// Helper function to update participant balance
function updateParticipantBalance(
  participant: Participant,
  amount: BigInt,
  isDeposit: boolean,
  timestamp: BigInt
): void {
  if (isDeposit) {
    participant.balance = participant.balance.plus(amount);
    participant.totalDeposited = participant.totalDeposited.plus(amount);
  } else {
    participant.balance = participant.balance.minus(amount);
    participant.totalWithdrawn = participant.totalWithdrawn.plus(amount);
  }
  participant.lastBalanceUpdate = timestamp;
  participant.save();
}

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
  let participant = getOrCreateParticipant(event.params.participant);

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
  let seller = getOrCreateParticipant(event.params.seller);

  // Load or create Buyer
  let buyer = getOrCreateParticipant(event.params.buyer);

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

export function handleTransfer(event: Transfer): void {
  log.info("Transfer event: {} from {} to {}", [
    event.params.value.toString(),
    event.params.from.toHexString(),
    event.params.to.toHexString(),
  ]);

  const amount = event.params.value;
  const from = event.params.from;
  const to = event.params.to;
  const timestamp = event.block.timestamp;

  // Handle minting (from zero address) - this represents adding margin
  if (from.equals(Address.zero())) {
    const participant = getOrCreateParticipant(to);
    updateParticipantBalance(participant, amount, true, timestamp);
    log.info("Minted {} tokens to participant {}", [amount.toString(), to.toHexString()]);
    return;
  }

  // Handle burning (to zero address) - this represents removing margin
  if (to.equals(Address.zero())) {
    const participant = getOrCreateParticipant(from);
    updateParticipantBalance(participant, amount, false, timestamp);
    log.info("Burned {} tokens from participant {}", [amount.toString(), from.toHexString()]);
    return;
  }

  // Handle regular transfers between participants
  const fromParticipant = getOrCreateParticipant(from);
  const toParticipant = getOrCreateParticipant(to);

  updateParticipantBalance(fromParticipant, amount, false, timestamp);
  updateParticipantBalance(toParticipant, amount, true, timestamp);

  log.info("Transferred {} tokens from {} to {}", [
    amount.toString(),
    from.toHexString(),
    to.toHexString(),
  ]);
}
