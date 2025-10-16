import { BigInt } from "@graphprotocol/graph-ts/common/numbers";
import {
  Initialized,
  PositionCreated,
  PositionClosed,
  OrderCreated,
  OrderClosed,
  DeliveryDateAdded,
  Transfer,
  Futures as FuturesContract,
  PositionDeliveryClosed,
} from "../generated/Futures/Futures";
import { Futures, Participant, Position, Order, DeliveryDate } from "../generated/schema";
import { log, Bytes, Address, dataSource } from "@graphprotocol/graph-ts";

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

function getOrCreateFutures(event: Initialized | null = null): Futures {
  let futures = Futures.load(0);
  if (!futures) {
    futures = new Futures(0);
  }

  futures.initializedBlockNumber = event ? event.block.number : BigInt.zero();
  futures.initializeTimestamp = event ? event.block.timestamp : BigInt.zero();
  futures.minSellerStake = new BigInt(0);
  futures.contractCount = 0;
  futures.contractActiveCount = 0;
  futures.purchaseCount = 0;
  futures.closeoutCount = 0;

  const address = dataSource.address();
  log.info("Futures Address {}", [address.toHexString()]);
  const futuresContract = FuturesContract.bind(address);

  futures.priceLadderStep = futuresContract.priceLadderStep();
  futures.sellerLiquidationMarginPercent = futuresContract.sellerLiquidationMarginPercent();
  futures.buyerLiquidationMarginPercent = futuresContract.buyerLiquidationMarginPercent();
  futures.speedHps = futuresContract.speedHps();
  futures.deliveryDurationSeconds = futuresContract.deliveryDurationSeconds();
  futures.breachPenaltyRatePerDay = futuresContract.breachPenaltyRatePerDay();
  futures.validatorAddress = futuresContract.validatorAddress();
  futures.hashrateOracleAddress = futuresContract.hashrateOracle();
  futures.tokenAddress = futuresContract.token();
  return futures;
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
  const futures = getOrCreateFutures(event);
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

export function handleOrderCreated(event: OrderCreated): void {
  log.info("Order created: {} by {}", [
    event.params.orderId.toHexString(),
    event.params.participant.toHexString(),
  ]);

  // Load Futures entity (should exist from Initialized event)
  let futures = getOrCreateFutures();

  // Load or create Participant
  let participant = getOrCreateParticipant(event.params.participant);

  // Create Position
  const order = new Order(event.params.orderId);
  order.id = event.params.orderId;
  order.participant = participant.id;
  order.price = event.params.price;
  order.deliveryDate = event.params.deliveryDate;
  order.isBuy = event.params.isBuy;
  order.timestamp = event.block.timestamp;
  order.blockNumber = event.block.number;
  order.transactionHash = event.transaction.hash;
  order.isActive = true;
  order.save();

  // Update Participant
  participant.orders = participant.orders.concat([order.id]);
  participant.orderCount++;
  participant.totalVolume = participant.totalVolume.plus(event.params.price);
  participant.save();

  // Update Futures stats
  futures.contractCount++;
  futures.contractActiveCount++;
  futures.save();
}

export function handleOrderClosed(event: OrderClosed): void {
  log.info("Order closed: {} by {}", [
    event.params.orderId.toHexString(),
    event.params.participant.toHexString(),
  ]);

  const order = Order.load(event.params.orderId);
  if (!order) {
    log.warning("Order not found: {}", [event.params.orderId.toHexString()]);
    return;
  }

  // Update position status
  order.isActive = false;
  order.closedAt = event.block.timestamp;
  order.closedBy = event.params.participant;
  order.save();

  // Update participant
  const participant = Participant.load(order.participant);
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

export function handlePositionCreated(event: PositionCreated): void {
  log.info("Position created: {} by seller {} and buyer {}", [
    event.params.positionId.toHexString(),
    event.params.seller.toHexString(),
    event.params.buyer.toHexString(),
  ]);

  // Load Futures entity (should exist from Initialized event)
  let futures = getOrCreateFutures();

  // Load or create Seller
  let seller = getOrCreateParticipant(event.params.seller);

  // Load or create Buyer
  let buyer = getOrCreateParticipant(event.params.buyer);

  // Create Position
  const position = new Position(event.params.positionId);
  position.id = event.params.positionId;
  position.seller = seller.id;
  position.buyer = buyer.id;
  position.price = event.params.price;
  position.startTime = event.params.startTime;
  position.timestamp = event.block.timestamp;
  position.blockNumber = event.block.number;
  position.transactionHash = event.transaction.hash;
  position.isActive = true;
  position.orderId = event.params.orderId;
  position.save();

  // Update Seller
  seller.orders = seller.orders.concat([position.id]);
  seller.orderCount++;
  seller.totalVolume = seller.totalVolume.plus(event.params.price);
  seller.save();

  // Update Buyer
  buyer.orders = buyer.orders.concat([position.id]);
  buyer.orderCount++;
  buyer.totalVolume = buyer.totalVolume.plus(event.params.price);
  buyer.save();

  // Update Futures stats
  futures.contractCount++;
  futures.contractActiveCount++;
  futures.purchaseCount++;
  futures.save();
}

export function handlePositionClosed(event: PositionClosed): void {
  log.info("Position closed: {} by {}", [event.params.positionId.toHexString()]);

  const position = Position.load(event.params.positionId);
  if (!position) {
    log.warning("Order not found: {}", [event.params.positionId.toHexString()]);
    return;
  }

  // Update order status
  position.isActive = false;
  position.closedAt = event.block.timestamp;
  position.save();

  // Update participants
  const seller = Participant.load(position.seller);
  if (seller) {
    seller.orderCount--;
    seller.save();
  }

  const buyer = Participant.load(position.buyer);
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

export function handlePositionDeliveryClosed(event: PositionDeliveryClosed): void {
  log.info("Position delivery closed: {} by {}", [event.params.positionId.toHexString()]);

  const position = Position.load(event.params.positionId);
  if (!position) {
    log.warning("Order not found: {}", [event.params.positionId.toHexString()]);
    return;
  }

  // Update order status
  position.isActive = false;
  position.closedAt = event.block.timestamp;
  position.closedBy = event.params.closedBy;
  position.save();

  // Update participants
  const seller = Participant.load(position.seller);
  if (seller) {
    seller.orderCount--;
    seller.save();
  }

  const buyer = Participant.load(position.buyer);
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
