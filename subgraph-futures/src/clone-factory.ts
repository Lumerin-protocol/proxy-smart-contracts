import { Address, BigInt } from "@graphprotocol/graph-ts/common/numbers";
import {
  contractCreatedV2,
  contractDeleteUpdated,
  contractHardDeleted,
  Initialized,
  minSellerStakeUpdated,
  sellerDeregistered,
  sellerRegisteredUpdated,
} from "../generated/CloneFactory/CloneFactory";
import {
  Implementation,
  Terms,
  CloneFactory,
  Seller,
  ResellTerms,
  EventCreated,
  EventArchived,
  EventUnarchived,
  EventHardDeleted,
} from "../generated/schema";
import { Implementation as ImplementationTemplate } from "../generated/templates";
import { Bytes, log, store } from "@graphprotocol/graph-ts";
import { blockNumberLogIndex } from "./event";

export function handleInitialized(event: Initialized): void {
  let cf = CloneFactory.load(0);
  if (cf) {
    log.warning("CloneFactory already initialized", [event.params.version.toU64().toString()]);
    return;
  }

  cf = new CloneFactory(0);
  cf.initializedBlockNumber = event.block.number;
  cf.initializeTimestamp = event.block.timestamp;

  cf.minSellerStake = new BigInt(0);

  cf.contractCount = 0;
  cf.contractActiveCount = 0;
  cf.contractAvailableCount = 0;
  cf.contractAvailableResellableCount = 0;
  cf.contractRunningCount = 0;
  cf.contractArchivedCount = 0;

  cf.sellerCount = 0;
  cf.buyerCount = 0;
  cf.validatorCount = 0;

  cf.purchaseCount = 0;
  cf.resellCount = 0;
  cf.closeoutCount = 0;

  cf.hashesSold = new BigInt(0);
  cf.hashrateAvailable = new BigInt(0);
  cf.hashrateRunning = new BigInt(0);
  cf.hashrateTotal = new BigInt(0);

  cf.transactionValueUSDC = new BigInt(0);
  cf.transactionValueLMR = new BigInt(0);

  cf.save();
}

export function handlesellerRegisteredUpdated(event: sellerRegisteredUpdated): void {
  log.info("seller registered updated {} {}", [
    event.params._seller.toHexString(),
    event.params._stake.toHexString(),
  ]);
  const cf = CloneFactory.load(0);
  if (!cf) {
    throw new Error("CloneFactory not found");
  }

  let seller = Seller.load(event.params._seller);
  const existed = !!seller;

  if (!seller) {
    seller = new Seller(event.params._seller);
    seller.address = event.params._seller;
    seller.registeredTimestamp = event.block.timestamp;
    seller.registeredBlockNumber = event.block.number;
    seller.stake = new BigInt(0);
    seller.contracts = [];

    seller.contractCount = 0;
    seller.contractActiveCount = 0;
    seller.contractAvailableCount = 0;
    seller.contractRunningCount = 0;
    seller.contractArchivedCount = 0;

    seller.earningsUSDC = new BigInt(0);

    seller.hashesSold = new BigInt(0);
    seller.hashrateAvailable = new BigInt(0);
    seller.hashrateRunning = new BigInt(0);
    seller.hashrateTotal = new BigInt(0);

    seller.saleCount = 0;
    seller.resaleCount = 0;
    seller.earlyCloseoutCount = 0;
  }
  seller.stake = event.params._stake;
  seller.save();

  if (!existed) {
    cf.sellerCount++;
  }

  cf.save();
}

export function handlesellerDeregistered(event: sellerDeregistered): void {
  const cf = CloneFactory.load(0);
  if (!cf) {
    throw new Error("CloneFactory not found");
  }

  const seller = Seller.load(event.params._seller);
  if (!seller) {
    throw new Error("Seller not found");
  }

  cf.sellerCount--;

  store.remove("Seller", event.params._seller.toHexString());
  cf.save();
}

export function handlemminSellerStakeUpdated(event: minSellerStakeUpdated): void {
  const cf = CloneFactory.load(0);
  if (!cf) {
    throw new Error("CloneFactory not found");
  }

  cf.minSellerStake = event.params._minSellerStake;
  cf.save();
}

export function handlecontractCreatedV2(event: contractCreatedV2): void {
  ImplementationTemplate.create(event.params._address);

  const termsVersion = 0;
  const terms = new Terms(event.params._address.concatI32(termsVersion));
  terms._speed = event.params.speed;
  terms._length = event.params.length;
  terms._version = new BigInt(termsVersion);
  terms._contractAddress = event.params._address;
  terms._updatedTimestamp = event.block.timestamp;
  terms._updatedBlockNumber = event.block.number;
  terms.save();

  const resellTerms = new ResellTerms(blockNumberLogIndex(new BigInt(0), new BigInt(0)));
  resellTerms._account = event.params._seller;
  resellTerms._validator = Address.zero();
  resellTerms._price = new BigInt(0);
  resellTerms._fee = new BigInt(0);
  resellTerms._startTime = event.block.timestamp;
  resellTerms._lastSettlementTime = event.block.timestamp;
  resellTerms._seller = event.params._seller;
  resellTerms._resellProfitTarget = event.params.profitTarget;
  resellTerms._isResellable = true;
  resellTerms._isResellToDefaultBuyer = false;
  resellTerms.save();

  const eventCreated = new EventCreated(blockNumberLogIndex(event.block.number, event.logIndex));
  eventCreated.timestamp = event.block.timestamp;
  eventCreated.blockNumber = event.block.number;
  eventCreated.transactionHash = event.transaction.hash;
  eventCreated._seller = event.params._seller;
  eventCreated._profitTarget = event.params.profitTarget;
  eventCreated._speed = event.params.speed;
  eventCreated._length = event.params.length;
  eventCreated._version = new BigInt(termsVersion);
  eventCreated.contractAddress = event.params._address;
  eventCreated.save();

  const implementation = new Implementation(event.params._address);
  implementation._address = event.params._address;
  implementation.blockNumber = event.block.number;
  implementation.blockTimestamp = event.block.timestamp;
  implementation.isDeleted = false;
  implementation._terms = terms.id;
  implementation.owner = event.params._seller;
  implementation.resellChain = [resellTerms.id];
  implementation.history = [eventCreated.id];
  implementation.endTime = new BigInt(0);
  implementation.purchasesCount = 0;
  implementation.resellsCount = 0;
  implementation.earlyCloseoutsCount = 0;
  implementation.isResellable = true;
  implementation.save();

  const cf = CloneFactory.load(0);
  if (!cf) {
    throw new Error("CloneFactory not found");
  }
  cf.contractCount++;
  cf.contractActiveCount++;
  cf.contractAvailableCount++;
  cf.save();

  const seller = Seller.load(event.params._seller);
  if (!seller) {
    throw new Error("Seller not found");
  }
  seller.contractCount++;
  seller.contractActiveCount++;
  seller.contractAvailableCount++;
  seller.contracts = seller.contracts.concat([implementation.id]);
  seller.save();
}

export function handlecontractDeleteUpdated(event: contractDeleteUpdated): void {
  const implementation = Implementation.load(event.params._address);
  if (!implementation) {
    throw new Error("Implementation not found");
  }

  const cf = CloneFactory.load(0);
  if (!cf) {
    throw new Error("CloneFactory not found");
  }

  const seller = Seller.load(implementation.owner);
  if (!seller) {
    throw new Error("Seller not found");
  }

  if (implementation.isDeleted !== event.params._isDeleted) {
    if (event.params._isDeleted) {
      cf.contractActiveCount--;
      cf.contractArchivedCount++;

      seller.contractActiveCount--;
      seller.contractArchivedCount++;

      const eventArchived = new EventArchived(
        blockNumberLogIndex(event.block.number, event.logIndex)
      );
      eventArchived.timestamp = event.block.timestamp;
      eventArchived.blockNumber = event.block.number;
      eventArchived.transactionHash = event.transaction.hash;
      eventArchived.contractAddress = event.params._address;
      eventArchived._seller = implementation.owner;
      eventArchived.save();
      implementation.history = implementation.history.concat([eventArchived.id]);
      // cf.availableContracts--; # update available status on auto or manual closeout
    } else {
      cf.contractArchivedCount--;
      cf.contractActiveCount++;

      seller.contractArchivedCount--;
      seller.contractActiveCount++;

      const eventUnarchived = new EventUnarchived(
        blockNumberLogIndex(event.block.number, event.logIndex)
      );
      eventUnarchived.timestamp = event.block.timestamp;
      eventUnarchived.blockNumber = event.block.number;
      eventUnarchived.transactionHash = event.transaction.hash;
      eventUnarchived.contractAddress = event.params._address;
      eventUnarchived._seller = implementation.owner;
      eventUnarchived.save();
      implementation.history = implementation.history.concat([eventUnarchived.id]);
      // cf.availableContracts++; # update available status on auto or manual closeout
    }
  }
  seller.save();
  cf.save();

  implementation.isDeleted = event.params._isDeleted;
  implementation.save();
}

export function handlecontractHardDeleted(event: contractHardDeleted): void {
  const implementation = Implementation.load(event.params._address);
  if (!implementation) {
    log.warning("Implementation not found", [event.params._address.toHexString()]);
    return;
  }
  store.remove("Implementation", implementation.id.toHexString());

  const cf = CloneFactory.load(0);
  if (!cf) {
    throw new Error("CloneFactory not found");
  }
  const seller = Seller.load(implementation.owner);
  if (!seller) {
    throw new Error("Seller not found");
  }

  cf.contractCount--;
  seller.contractCount--;
  if (implementation.isDeleted) {
    cf.contractArchivedCount--;
    seller.contractArchivedCount--;
  } else {
    cf.contractActiveCount--;
    seller.contractActiveCount++;
  }

  const eventHardDeleted = new EventHardDeleted(
    blockNumberLogIndex(event.block.number, event.logIndex)
  );
  eventHardDeleted.timestamp = event.block.timestamp;
  eventHardDeleted.blockNumber = event.block.number;
  eventHardDeleted.transactionHash = event.transaction.hash;
  eventHardDeleted.contractAddress = event.params._address;
  eventHardDeleted._seller = implementation.owner;
  eventHardDeleted.save();

  implementation.history = implementation.history.concat([eventHardDeleted.id]);
  implementation.save();
  seller.save();
  cf.save();
}
