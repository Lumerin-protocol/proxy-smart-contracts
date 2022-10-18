import Web3 from "web3";
import { ContractContext } from "./CloneFactory";
import abi from "./CloneFactory.json";
import { AbiItem } from "ethereum-abi-types-generator";

export const CloneFactory = (web3: Web3, address: string): ContractContext => {
  if (!web3 || !web3.eth) {
    throw new Error("Invalid web3 provided");
  }

  // Create a contract using either web3@0.2x or web3@1.0.0
  const contract =
    typeof web3.eth.Contract === "function"
      ? new web3.eth.Contract(abi as AbiItem[], address)
      : (web3 as any).eth.contract(abi).at(address);

  return contract as ContractContext;
};
