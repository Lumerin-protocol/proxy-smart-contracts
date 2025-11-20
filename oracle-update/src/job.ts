import { env } from "./env";
import { createClient, createPublicClient, getContract, http, PublicClient } from "viem";
import { getChain } from "./chain";
import { hashrateOracleAbi } from "./abi";
import pino from "pino";
import { privateKeyToAccount } from "viem/accounts";
import { BitcoinClient } from "./bitcoin";
import { RewardCalculator } from "./reward";
import { FileCache } from "./cache";

export async function main() {
  const log = pino({
    level: env.LOG_LEVEL,
  });

  log.info("Starting job");

  const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);
  const transport = http(env.ETHEREUM_RPC_URL);
  const chain = getChain(env.CHAIN_ID);

  const pc = createPublicClient({ transport, chain });

  const oracleContract = getContract({
    address: env.HASHRATE_ORACLE_ADDRESS as `0x${string}`,
    abi: hashrateOracleAbi,
    client: createClient({ transport, chain, account }),
  });

  const SMA_PERIOD = 144;

  const cache = new FileCache(SMA_PERIOD, {
    parameterName: env.CACHE_PARAMETER_NAME,
    useParameterStore: env.CACHE_PARAMETER_NAME !== undefined,
    logger: log,
  });
  const bitcoinClient = new BitcoinClient(env.BITCOIN_RPC_URL);
  const rewardCalculator = new RewardCalculator(bitcoinClient, cache);

  try {
    const index = await rewardCalculator.getIndex();
    log.info("Index: %s BTC/PH/day", index);
    const latest = await rewardCalculator.getLastIndexData(SMA_PERIOD);
    log.info(
      "Latest data: latest block Number: %s, latest subsidy: %s, difficulty: %s, average TX fees: %s, hashes per block: %s, hashes per BTC: %s",
      latest.blockNumber,
      latest.subsidy,
      latest.difficulty,
      latest.averageTxFees,
      latest.hashesPerBlock,
      latest.hashesForBTC
    );
    const oldHashesForBTC = await oracleContract.read.getHashesForBTC();

    log.info("Old hashes for BTC: %s", oldHashesForBTC.value);
    log.info("New hashes for BTC: %s", latest.hashesForBTC);
    if (latest.hashesForBTC !== oldHashesForBTC.value) {
      const hash = await oracleContract.write.setHashesForBTC([latest.hashesForBTC]);
      await pc.waitForTransactionReceipt({ hash });
      log.info("Hashes for BTC updated onchain: %s", hash);
    } else {
      log.info("Hashes for BTC update skipped");
    }

    log.info("Job completed");
  } catch (error) {
    log.error("Job failed: %s", error);
    throw error;
  } finally {
    log.flush();
  }
}
