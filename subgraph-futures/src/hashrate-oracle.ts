import { log, ethereum, dataSource } from "@graphprotocol/graph-ts";
import { HashrateOracle } from "../generated/HashrateOracle/HashrateOracle";
import { HashrateIndex, HashrateOracle as HashrateOracleEntity } from "../generated/schema";

export function handleInitialized(event: ethereum.Event): void {
  log.info("Initialized {}", [event.address.toHexString()]);
  const hashrateOracle = new HashrateOracleEntity(0);
  hashrateOracle.initializedBlockNumber = event.block.number;
  hashrateOracle.initializeTimestamp = event.block.timestamp;
  hashrateOracle.save();
}

// Block handler to collect hashrate data on each block
export function handleBlock(block: ethereum.Block): void {
  log.info("Block {}", [block.number.toString()]);

  const hashrateOracle = HashrateOracleEntity.load(0);
  if (!hashrateOracle || block.number.le(hashrateOracle.initializedBlockNumber)) {
    log.info("HashrateOracle not yet initialized", []);
    return;
  }

  // Access data source information from subgraph.yaml
  const address = dataSource.address();
  log.info("Oracle Address {}", [address.toHexString()]);
  const ho = HashrateOracle.bind(address);
  const hashesForBTC = ho.getHashesForBTC();
  log.info("Hashes for BTC {}", [hashesForBTC.value.toString()]);
  const hashesForToken = ho.getHashesforToken();
  log.info("Hashes for Token {}", [hashesForToken.toString()]);

  const hashrateIndexEntry = new HashrateIndex(block.number.toI32());
  hashrateIndexEntry.hashesForBTC = hashesForBTC.value;
  hashrateIndexEntry.hashesForToken = hashesForToken;
  hashrateIndexEntry.updatedAt = block.timestamp;
  hashrateIndexEntry.blockNumber = block.number;
  hashrateIndexEntry.save();
}
