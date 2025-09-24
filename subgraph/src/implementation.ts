import {
  contractClosedEarly,
  contractPurchased,
  contractTermsUpdated,
  destinationUpdated,
  fundsClaimed,
} from "../generated/templates/Implementation/Implementation";
import {
  Buyer,
  CloneFactory,
  EventCloseout,
  EventDestinationUpdated,
  EventFundsClaimed,
  EventPurchased,
  EventTermsUpdated,
  Implementation,
  Purchase,
  ResellTerms,
  Seller,
  Terms,
} from "../generated/schema";
import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { blockNumberLogIndex, blockNumberLogIndexAddress } from "./event";

export function handlecontractPurchased(event: contractPurchased): void {
  const implementation = Implementation.load(event.address);
  if (!implementation) {
    throw new Error("Implementation not found");
  }

  const isResellable = event.params._resellFlags.isResellable;
  const isResellToDefaultBuyer = event.params._resellFlags.isResellToDefaultBuyer;

  const resellTerms = new ResellTerms(blockNumberLogIndex(event.block.number, event.logIndex));
  resellTerms._account = event.params._buyer;
  resellTerms._seller = event.params._seller;
  resellTerms._validator = event.params._validator;
  resellTerms._price = event.params._price;
  resellTerms._fee = event.params._fee;
  resellTerms._startTime = event.block.timestamp;
  resellTerms._lastSettlementTime = event.block.timestamp;
  resellTerms._resellProfitTarget = 0;
  resellTerms._resellPrice = event.params._resellPrice;
  resellTerms._isResellable = isResellable;
  resellTerms._isResellToDefaultBuyer = isResellToDefaultBuyer;
  resellTerms.save();

  const historyEvent = new EventPurchased(blockNumberLogIndex(event.block.number, event.logIndex));
  historyEvent.timestamp = event.block.timestamp;
  historyEvent.blockNumber = event.block.number;
  historyEvent.transactionHash = event.transaction.hash;
  historyEvent.contractAddress = event.address;
  historyEvent._buyer = event.params._buyer;
  historyEvent._validator = event.params._validator;
  historyEvent._seller = event.params._seller;
  historyEvent._price = event.params._price;
  historyEvent._fee = event.params._fee;
  historyEvent._isResell = implementation.resellChain.length > 1;
  historyEvent._isResellToDefaultBuyer = isResellToDefaultBuyer;
  historyEvent._isResellable = isResellable;
  historyEvent._resellProfitTarget = 0;
  historyEvent._resellPrice = event.params._resellPrice;
  historyEvent.save();

  const terms = Terms.load(implementation._terms);
  if (!terms) {
    throw new Error("Terms not found");
  }
  implementation.endTime = event.block.timestamp.plus(terms._length);
  implementation.resellChain = implementation.resellChain.concat([resellTerms.id]);
  implementation.history = implementation.history.concat([historyEvent.id]);
  implementation.isResellable = isResellable;
  implementation.purchasesCount++;
  implementation.save();

  const cf = CloneFactory.load(0);
  if (!cf) {
    throw new Error("CloneFactory not found");
  }

  let buyer = Buyer.load(event.params._buyer);
  if (!buyer) {
    buyer = new Buyer(event.params._buyer);
    buyer.address = event.params._buyer;
    buyer.purchases = [];
    buyer.purchaseCount = 0;
    buyer.resellCount = 0;
    buyer.earlyCloseoutCount = 0;
    buyer.hashratePurchased = new BigInt(0);
    buyer.hashrateResold = new BigInt(0);
    buyer.hashesPurchased = new BigInt(0);
    buyer.hashesResold = new BigInt(0);
    cf.buyerCount++;
  }

  const purchase = new Purchase(
    blockNumberLogIndexAddress(event.block.number, event.logIndex, event.address)
  );
  purchase.seller = event.params._seller;
  purchase.buyer = event.params._buyer;
  purchase.validator = event.params._validator;
  purchase.price = event.params._price;
  purchase.fee = event.params._fee;
  purchase.resellProfitTarget = 0;
  purchase.resellPrice = event.params._resellPrice;
  purchase.isResell = implementation.resellChain.length > 1;
  purchase.startTime = event.block.timestamp;
  purchase.save();

  buyer.purchaseCount++;
  buyer.hashratePurchased = buyer.hashratePurchased.plus(terms._speed);
  buyer.hashesPurchased = buyer.hashesPurchased.plus(terms._speed.times(terms._length));
  buyer.purchases = buyer.purchases.concat([purchase.id]);
  buyer.save();

  const seller = Seller.load(event.params._seller);
  if (!seller) {
    throw new Error("Seller not found");
  }
  seller.saleCount++;
  seller.hashrateRunning = seller.hashrateRunning.plus(terms._speed);
  seller.hashrateTotal = seller.hashrateTotal.plus(terms._speed);
  seller.save();

  cf.purchaseCount++;
  cf.contractRunningCount++;
  cf.hashesSold = cf.hashesSold.plus(terms._speed.times(terms._length));
  cf.hashrateRunning = cf.hashrateRunning.plus(terms._speed);
  cf.hashrateTotal = cf.hashrateTotal.plus(terms._speed);
  cf.save();
}

export function handlecontractClosedEarly(event: contractClosedEarly): void {
  const cf = CloneFactory.load(0);
  if (!cf) {
    throw new Error("CloneFactory not found");
  }

  const implementation = Implementation.load(event.address);
  if (!implementation) {
    throw new Error("Implementation not found");
  }
  const terms = Terms.load(implementation._terms);
  if (!terms) {
    throw new Error("Terms not found");
  }

  cf.contractRunningCount--;
  cf.closeoutCount++;
  cf.hashrateRunning = cf.hashrateRunning.minus(terms._speed);
  cf.hashrateTotal = cf.hashrateTotal.minus(terms._speed);
  implementation.earlyCloseoutsCount++;
  cf.save();

  const historyEvent = new EventCloseout(blockNumberLogIndex(event.block.number, event.logIndex));
  historyEvent.timestamp = event.block.timestamp;
  historyEvent.blockNumber = event.block.number;
  historyEvent.transactionHash = event.transaction.hash;
  historyEvent.contractAddress = event.address;
  historyEvent._buyer = event.params._buyer;
  historyEvent._validator = event.params._validator;
  historyEvent._seller = event.params._seller;
  historyEvent._reason = event.params._reason;
  historyEvent.save();

  log.warning("resellChain before {}", [
    implementation.resellChain.map<string>((r) => r.toHexString()).join(", "),
  ]);
  implementation.resellChain = implementation.resellChain.slice(0, -1);
  log.warning("resellChain after {}", [
    implementation.resellChain.map<string>((r) => r.toHexString()).join(", "),
  ]);

  const lastResell = ResellTerms.load(
    implementation.resellChain[implementation.resellChain.length - 1]
  );
  if (!lastResell) {
    throw new Error("Last resell not found");
  }
  implementation.isResellable = lastResell._isResellable;
  implementation.history = implementation.history.concat([historyEvent.id]);
  implementation.save();
}

export function handlecontractTermsUpdated(event: contractTermsUpdated): void {
  const implementation = Implementation.load(event.address);
  if (!implementation) {
    throw new Error("Implementation not found");
  }

  const terms = new Terms(event.transaction.hash.concatI32(event.params._version.toI32()));
  terms._speed = event.params._speed;
  terms._length = event.params._length;
  terms._version = event.params._version;
  terms._contractAddress = event.address;
  terms._updatedTimestamp = event.block.timestamp;
  terms._updatedBlockNumber = event.block.number;
  terms.save();

  const historyEvent = new EventTermsUpdated(
    blockNumberLogIndex(event.block.number, event.logIndex)
  );
  historyEvent.timestamp = event.block.timestamp;
  historyEvent.blockNumber = event.block.number;
  historyEvent.transactionHash = event.transaction.hash;
  historyEvent.contractAddress = event.address;
  historyEvent._speed = event.params._speed;
  historyEvent._length = event.params._length;
  historyEvent._version = event.params._version;
  historyEvent.save();

  implementation.history = implementation.history.concat([historyEvent.id]);
  implementation._terms = terms.id;
  implementation.save();
}

export function handledestinationUpdated(event: destinationUpdated): void {
  const implementation = Implementation.load(event.address);
  if (!implementation) {
    throw new Error("Implementation not found");
  }

  const historyEvent = new EventDestinationUpdated(
    blockNumberLogIndex(event.block.number, event.logIndex)
  );
  historyEvent.timestamp = event.block.timestamp;
  historyEvent.blockNumber = event.block.number;
  historyEvent.transactionHash = event.transaction.hash;
  historyEvent.contractAddress = event.address;
  historyEvent._validatorURL = event.params.newValidatorURL;
  historyEvent._destURL = event.params.newDestURL;
  historyEvent.save();

  implementation.history = implementation.history.concat([historyEvent.id]);
  implementation.save();
}

export function handlefundsClaimed(event: fundsClaimed): void {
  const implementation = Implementation.load(event.address);
  if (!implementation) {
    throw new Error("Implementation not found");
  }

  // TODO: implement unsettled calculation
  // and resell chain update

  const historyEvent = new EventFundsClaimed(
    blockNumberLogIndex(event.block.number, event.logIndex)
  );
  historyEvent.timestamp = event.block.timestamp;
  historyEvent.blockNumber = event.block.number;
  historyEvent.transactionHash = event.transaction.hash;
  historyEvent.contractAddress = event.address;
  historyEvent.save();

  implementation.history = implementation.history.concat([historyEvent.id]);
  implementation.save();
}
