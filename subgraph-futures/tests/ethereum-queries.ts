import viem, { zeroAddress } from "viem";
import { hardhat } from "viem/chains";
import { FuturesABI } from "../../margin-call/abi/Futures";
import { waitForTransactionReceipt, writeContract } from "viem/actions";
import { HashrateOracleABI } from "./abi";
import { parseEventLogs } from "viem";

const config = {
  ETH_NODE_URL: "http://127.0.0.1:8545",
  MULTICALL_ADDRESS: zeroAddress,
  FUTURES_ADDRESS: zeroAddress,
  HASHRATE_ORACLE_ADDRESS: zeroAddress,
};

const ethClient = viem.createClient({
  transport: viem.http(config.ETH_NODE_URL),
  chain: {
    ...hardhat,
    multicall3Address: config.MULTICALL_ADDRESS,
  },
});

export const getFuturesContract = (ethClient: viem.Client) => {
  return viem.getContract({
    address: config.FUTURES_ADDRESS,
    abi: FuturesABI,
    client: ethClient,
  });
};

export const getHashrateOracleContract = (ethClient: viem.Client) => {
  return viem.getContract({
    address: config.HASHRATE_ORACLE_ADDRESS,
    abi: HashrateOracleABI,
    client: ethClient,
  });
};

export const getMinMargin = async (ethClient: viem.Client, participant: `0x${string}`) => {
  const futuresContract = getFuturesContract(ethClient);
  return await futuresContract.read.getMinMargin([participant]);
};

export const addMargin = async (
  ethClient: viem.Client,
  participant: `0x${string}`,
  amount: bigint
) => {
  const futuresContract = getFuturesContract(ethClient);
  const sm = await futuresContract.simulate.addMargin([amount], {
    account: participant,
  });

  const txhash = await writeContract(ethClient, sm.request);
  await waitForTransactionReceipt(ethClient, { hash: txhash });
  return txhash;
};

export const removeMargin = async (
  ethClient: viem.Client,
  participant: `0x${string}`,
  amount: bigint
) => {
  const futuresContract = getFuturesContract(ethClient);
  const sm = await futuresContract.simulate.removeMargin([amount], {
    account: participant,
  });
  const txhash = await writeContract(ethClient, sm.request);
  await waitForTransactionReceipt(ethClient, { hash: txhash });
  return txhash;
};

export const placeOrder = async (
  ethClient: viem.Client,
  participant: `0x${string}`,
  price: bigint,
  deliveryDate: bigint,
  isBuy: boolean
) => {
  const futuresContract = getFuturesContract(ethClient);
  const sm = await futuresContract.simulate.createOrder([price, deliveryDate, isBuy], {
    account: participant,
  });
  const txhash = await writeContract(ethClient, sm.request);
  const receipt = await waitForTransactionReceipt(ethClient, { hash: txhash });

  const [orderEvent] = parseEventLogs({
    logs: receipt.logs,
    abi: futuresContract.abi,
    eventName: "OrderCreated",
  });

  const [positionEvent] = parseEventLogs({
    logs: receipt.logs,
    abi: futuresContract.abi,
    eventName: "PositionCreated",
  });

  return {
    txhash,
    orderId: orderEvent.args.orderId,
    positionId: positionEvent ? positionEvent.args.positionId : undefined,
  };
};

export const closeOrder = async (
  ethClient: viem.Client,
  participant: `0x${string}`,
  orderId: `0x${string}`
) => {
  const futuresContract = getFuturesContract(ethClient);
  const sm = await futuresContract.simulate.closeOrder([orderId], {
    account: participant,
  });
  const txhash = await writeContract(ethClient, sm.request);
  await waitForTransactionReceipt(ethClient, { hash: txhash });
  return txhash;
};

export const closePositionAsSeller = async (
  ethClient: viem.Client,
  participant: `0x${string}`,
  positionId: `0x${string}`
) => {
  const futuresContract = getFuturesContract(ethClient);
  const sm = await futuresContract.simulate.closePositionAsSeller([positionId], {
    account: participant,
  });
  const txhash = await writeContract(ethClient, sm.request);
  await waitForTransactionReceipt(ethClient, { hash: txhash });
  return txhash;
};

export const closePositionAsBuyer = async (
  ethClient: viem.Client,
  participant: `0x${string}`,
  positionId: `0x${string}`
) => {
  const futuresContract = getFuturesContract(ethClient);
  const sm = await futuresContract.simulate.closePositionAsBuyer([positionId], {
    account: participant,
  });
  const txhash = await writeContract(ethClient, sm.request);
  await waitForTransactionReceipt(ethClient, { hash: txhash });
  return txhash;
};
