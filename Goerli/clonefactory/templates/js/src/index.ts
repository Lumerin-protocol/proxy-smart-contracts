import Web3 from "web3";
import { AbiItem } from "ethereum-abi-types-generator";
import {
  bytecode as CloneFactoryBC,
  abi as CloneFactoryAbi,
} from "./abi/CloneFactory.json";
import {
  bytecode as ImplementationBC,
  abi as ImplementationAbi,
} from "./abi/Implementation.json";
import { bytecode as LumerinBC, abi as LumerinAbi } from "./abi/Lumerin.json";
import { bytecode as FaucetBC, abi as FaucetAbi } from "./abi/Faucet.json";

import { ContractContext as CloneFactoryContext } from "./generated-types/CloneFactory";
import { ContractContext as ImplementationContext } from "./generated-types/Implementation";
import { ContractContext as LumerinContext } from "./generated-types/Lumerin";
import { ContractContext as FaucetContext } from "./generated-types/Faucet";

const factory = <T>(web3: Web3, address: string, abi: any): T => {
  if (!web3 || !web3.eth) {
    throw new Error("Invalid web3 provided");
  }

  // Create a contract using either web3@0.2x or web3@1.0.0
  const contract =
    typeof web3.eth.Contract === "function"
      ? new web3.eth.Contract(abi as AbiItem[], address)
      : (web3 as any).eth.contract(abi).at(address);

  return contract;
};

export const CloneFactory = (
  web3: Web3,
  address: string
): CloneFactoryContext => factory(web3, address, CloneFactoryAbi);

export const Implementation = (
  web3: Web3,
  address: string
): ImplementationContext => factory(web3, address, ImplementationAbi);

export const Lumerin = (web3: Web3, address: string): LumerinContext =>
  factory(web3, address, LumerinAbi);

export const Faucet = (web3: Web3, address: string): FaucetContext =>
  factory(web3, address, FaucetAbi);

const ethersFactory = <T>(
  ethers: any,
  address: string,
  abi: any,
  bytecode: string
): T => {
  if (!ethers || !ethers.ContractFactory) {
    console.log("Ethers: ", ethers);
    throw new Error("Invalid ethers object provided");
  }

  // Create a contract using either web3@0.2x or web3@1.0.0
  const contract = ethers.ContractFactory(abi, bytecode);

  return contract;
};

export const EthersCloneFactory = (
  ethers: any,
  address: string
): CloneFactoryContext =>
  ethersFactory(ethers, address, CloneFactoryAbi, CloneFactoryBC);

export const EthersImplementation = (
  ethers: any,
  address: string
): ImplementationContext =>
  ethersFactory(ethers, address, ImplementationAbi, ImplementationBC);

export const EthersLumerin = (ethers: any, address: string): LumerinContext =>
  ethersFactory(ethers, address, LumerinAbi, LumerinBC);

export const EthersFaucet = (ethers: any, address: string): FaucetContext =>
  ethersFactory(ethers, address, FaucetAbi, FaucetBC);

export {
  CloneFactoryContext,
  ImplementationContext,
  LumerinContext,
  FaucetContext,
};

export { abi as LumerinAbi } from "./abi/Lumerin.json";
export { abi as FaucetAbi } from "./abi/Faucet.json";
export { abi as ImplementationAbi } from "./abi/Implementation.json";
export { abi as ClonefactoryAbi } from "./abi/Clonefactory.json";
