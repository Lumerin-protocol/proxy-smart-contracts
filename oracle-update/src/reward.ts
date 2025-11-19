import { parseUnits } from "viem/utils";
import { BitcoinClient } from "./bitcoin";

const DIFFICULTY_TO_HASHRATE_FACTOR = 2n ** 32n;

export class RewardCalculator {
  private readonly bitcoinClient: BitcoinClient;

  constructor(bitcoinClient: BitcoinClient) {
    this.bitcoinClient = bitcoinClient;
  }

  async getLastBlockData(): Promise<BlockData> {
    const blockchainInfo = await this.bitcoinClient.getBlockchainInfo();
    const block = await this.bitcoinClient.getBlock(blockchainInfo.bestblockhash);
    // const networkHPS = //call current network hashrate;
    const coinbaseTx = block.tx[0];
    const coinbaseTxData = await this.bitcoinClient.getRawTransaction(coinbaseTx);
    let totalReward = 0n;
    for (const vout of coinbaseTxData.vout) {
      // convert js float to bigint to avoid precision loss
      totalReward += parseUnits(vout.value.toString(), 8);
    }

    const hashesPerBlock = await this.calculateAvgHashesPerBlock(144);
    const hashesForBTC = hashesPerBlock / totalReward;

    return {
      blockNumber: blockchainInfo.blocks,
      blockHash: blockchainInfo.bestblockhash,
      reward: totalReward,
      difficulty: BigInt(Math.round(blockchainInfo.difficulty)),
      hashesForBTC,
    };
  }

  async calculateAvgHashesPerBlock(nblocks = 144): Promise<bigint> {
    const lastBlockNumber = await this.bitcoinClient.getBlockCount();
    const lastBlock = await this.bitcoinClient.getBlockHeader(
      await this.bitcoinClient.getBlockHash(lastBlockNumber)
    );
    const firstBlock = await this.bitcoinClient.getBlockHeader(
      await this.bitcoinClient.getBlockHash(lastBlockNumber - nblocks)
    );
    const avgBlockTime = (lastBlock.time - firstBlock.time) / nblocks;

    const targetBlockTime = 600;

    // Scale the theoretical hashes per block by how the observed block time compares
    // to Bitcoin's 10 minute target so temporary slow/fast periods adjust proportionally.
    const avgHashesPerBlock =
      lastBlock.difficulty *
      Number(DIFFICULTY_TO_HASHRATE_FACTOR) *
      (targetBlockTime / avgBlockTime);

    // const hashesPerLastBlock = lastBlock.difficulty * Number(DIFFICULTY_TO_HASHRATE_FACTOR);

    // console.log("hashesPerLastBlock", hashesPerLastBlock);
    // console.log("avgHashesPerBlock", avgHashesPerBlock);

    return BigInt(Math.round(avgHashesPerBlock));
  }

  async calculateNetworkHashPS(nblocks = 144): Promise<bigint> {
    const lastBlockNumber = await this.bitcoinClient.getBlockCount();
    const lastBlock = await this.bitcoinClient.getBlockHeader(
      await this.bitcoinClient.getBlockHash(lastBlockNumber)
    );
    const firstBlock = await this.bitcoinClient.getBlockHeader(
      await this.bitcoinClient.getBlockHash(lastBlockNumber - nblocks)
    );
    const avgBlockTime = (lastBlock.time - firstBlock.time) / nblocks;
    const realizedHashrate =
      (lastBlock.difficulty * Number(DIFFICULTY_TO_HASHRATE_FACTOR)) / avgBlockTime;
    return BigInt(Math.round(realizedHashrate));
  }
}

type BlockData = {
  blockNumber: number;
  blockHash: string;
  reward: bigint;
  difficulty: bigint;
  hashesForBTC: bigint;
};
