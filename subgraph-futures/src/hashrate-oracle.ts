import { log, ethereum, dataSource, BigInt } from "@graphprotocol/graph-ts";
import { HashrateOracle } from "../generated/HashrateOracle/HashrateOracle";
import { HashrateIndex, HashrateOracle as HashrateOracleEntity } from "../generated/schema";
import { bigIntToBytes } from "./lib";

export function handleInitialized(event: ethereum.Event): void {
  log.info("Oracle Initialized {}", [event.address.toHexString()]);
  const hashrateOracle = new HashrateOracleEntity(0);
  hashrateOracle.initializedBlockNumber = event.block.number;
  hashrateOracle.initializeTimestamp = event.block.timestamp;
  hashrateOracle.save();
}

// Block handler to collect hashrate data on each block
export function handleBlock(block: ethereum.Block): void {
  log.info("Handling block {}", [block.number.toString()]);

  let hashrateOracle = HashrateOracleEntity.load(0);
  if (!hashrateOracle) {
    hashrateOracle = new HashrateOracleEntity(0);
    hashrateOracle.initializedBlockNumber = block.number;
    hashrateOracle.initializeTimestamp = block.timestamp;
    hashrateOracle.save();
  }

  // Access data source information from subgraph.yaml
  const address = dataSource.address();
  log.info("Oracle Address {}", [address.toHexString()]);

  const ho = HashrateOracle.bind(address);
  const hashesForBTC = ho.try_getHashesForBTC();
  if (hashesForBTC.reverted) {
    log.info("Hashes for BTC reverted", []);
  } else {
    log.info("Hashes for BTC {}", [hashesForBTC.value.value.toString()]);
  }

  const hashesForToken = ho.try_getHashesforToken();
  if (hashesForToken.reverted) {
    log.info("Hashes for Token reverted", []);
  } else {
    log.info("Hashes for Token {}", [hashesForToken.value.toString()]);
  }

  const hashrateIndexEntry = new HashrateIndex(bigIntToBytes(block.number));
  hashrateIndexEntry.hashesForBTC = hashesForBTC.reverted
    ? BigInt.zero()
    : hashesForBTC.value.value;
  hashrateIndexEntry.hashesForToken = hashesForToken.reverted
    ? BigInt.zero()
    : hashesForToken.value;
  hashrateIndexEntry.updatedAt = block.timestamp;
  hashrateIndexEntry.blockNumber = block.number;
  log.info("HashrateIndexEntry saved {} {}", [block.number.toString(), block.timestamp.toString()]);
  hashrateIndexEntry.save();
}
