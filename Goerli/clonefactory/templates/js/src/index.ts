import Web3 from "web3";
import CloneFactoryAbi from "./abi/CloneFactory.json";
import ImplementationAbi from "./abi/Implementation.json";
import LumerinAbi from "./abi/Lumerin.json";
import { AbiItem } from "ethereum-abi-types-generator";
import { ContractContext as CloneFactoryContext } from "./generated-types/CloneFactory";
import { ContractContext as ImplementationContext } from "./generated-types/Implementation";
import { ContractContext as LumerinContext } from "./generated-types/Lumerin";

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

export const CloneFactory = (web3: Web3, address: string): CloneFactoryContext => 
  factory(web3, address, CloneFactoryAbi);

export const Implementation = (web3: Web3, address: string): ImplementationContext => 
  factory(web3, address, ImplementationAbi);
  
export const Lumerin = (web3: Web3, address: string): LumerinContext =>
  factory(web3, address, LumerinAbi);