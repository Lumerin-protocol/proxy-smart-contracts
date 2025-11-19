import { env } from "./env";
import { createClient, createPublicClient, getContract, http, PublicClient } from "viem";
import { getChain } from "./chain";
import { hashrateOracleAbi } from "./abi";
import pino from "pino";
import { privateKeyToAccount } from "viem/accounts";
import { BitcoinClient } from "./bitcoin";
import { RewardCalculator } from "./reward";

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

  const bitcoinClient = new BitcoinClient(env.BITCOIN_RPC_URL);
  const rewardCalculator = new RewardCalculator(bitcoinClient);

  try {
    const latest = await rewardCalculator.getLastBlockData();
    log.info(
      "Latest data: blockHash: %s, blockNumber: %s, reward: %s, difficulty: %s, hashesForBTC: %s",
      latest.blockHash,
      latest.blockNumber,
      latest.reward.toString(),
      latest.difficulty.toString(),
      latest.hashesForBTC.toString()
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
