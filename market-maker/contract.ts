import { createPublicClient, createWalletClient, encodeFunctionData, http } from "viem";
import { FuturesABI } from "./abi/Futures.ts";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

function makeClient(url: string) {
  return createPublicClient({
    transport: http(url),
    chain: hardhat,
  });
}

function makeWalletClient(url: string, privateKey: `0x${string}`) {
  return createWalletClient({
    transport: http(url),
    account: privateKeyToAccount(privateKey),
    chain: hardhat,
  });
}

export class FuturesContract {
  private address: string;
  private pc: ReturnType<typeof makeClient>;
  private wc: ReturnType<typeof makeWalletClient>;

  constructor(address: string, url: string, privateKey: `0x${string}`) {
    this.address = address;
    this.pc = makeClient(url);
    this.wc = makeWalletClient(url, privateKey);
  }

  getWalletAddress(): `0x${string}` {
    return this.wc.account.address;
  }

  async getBalance(): Promise<bigint> {
    return this.pc.readContract({
      address: this.address as `0x${string}`,
      abi: FuturesABI,
      functionName: "balanceOf",
      args: [this.wc.account.address],
      authorizationList: undefined,
    });
  }

  async deposit(amount: bigint): Promise<TxResult> {
    const tx = await this.pc.simulateContract({
      address: this.address as `0x${string}`,
      abi: FuturesABI,
      functionName: "addMargin",
      args: [amount],
      account: this.wc.account,
      chain: this.wc.chain,
    });
    const hash = await this.wc.writeContract(tx.request);
    return await this.pc.waitForTransactionReceipt({ hash });
  }

  async placeOrders(
    orders: { price: bigint; qty: bigint; deliveryDate: bigint }[]
  ): Promise<TxResult> {
    const callsDatas = orders.map((order) =>
      encodeFunctionData({
        abi: FuturesABI,
        functionName: "createOrder",
        args: [order.price, order.deliveryDate, "", Number(order.qty)],
      })
    );
    const tx = await this.pc.simulateContract({
      address: this.address as `0x${string}`,
      abi: FuturesABI,
      functionName: "multicall",
      args: [callsDatas],
      account: this.wc.account,
    });
    const txHash = await this.wc.writeContract(tx.request);
    return await this.pc.waitForTransactionReceipt({ hash: txHash });
  }

  //TODO: rewrite for continuous monitoring
  async waitForPositionCreated(address: `0x${string}`, blockNumber: number): Promise<void> {
    const positionCreatedAbi = FuturesABI.find(
      (event) => event.type === "event" && event.name === "PositionCreated"
    )!;

    return new Promise((resolve, reject) => {
      const unwatch = this.pc.watchEvent({
        address: this.address as `0x${string}`,
        events: [positionCreatedAbi, positionCreatedAbi],
        fromBlock: BigInt(blockNumber),
        args: [{ seller: address }, { buyer: address }] as any,
        onLogs: (logs) => {
          unwatch();
          resolve();
        },
        onError: (error) => {
          unwatch();
          reject(error);
        },
      });
    });
  }

  async getCurrentDeliveryDate(): Promise<number> {
    const deliveryDates = await this.pc.readContract({
      address: this.address as `0x${string}`,
      abi: FuturesABI,
      functionName: "getDeliveryDates",
      authorizationList: undefined,
    });

    return Number(deliveryDates[0]);
  }

  async getIndexPrice(): Promise<bigint> {
    return this.pc.readContract({
      address: this.address as `0x${string}`,
      abi: FuturesABI,
      functionName: "getMarketPrice",
      authorizationList: undefined,
    });
  }

  async getContractMultiplier(): Promise<number> {
    return this.pc.readContract({
      address: this.address as `0x${string}`,
      abi: FuturesABI,
      functionName: "deliveryDurationDays",
      authorizationList: undefined,
    });
  }

  async getTickSize(): Promise<bigint> {
    return this.pc.readContract({
      address: this.address as `0x${string}`,
      abi: FuturesABI,
      functionName: "minimumPriceIncrement",
      authorizationList: undefined,
    });
  }
}

type TxResult = {
  blockNumber: bigint;
  transactionHash: `0x${string}`;
};
