import { viem } from "hardhat";

export function getImplementation(contractAddress: `0x${string}`) {
  return viem.getContractAt("Implementation", contractAddress);
}

export async function getResellChain(contractAddress: `0x${string}`, index: number) {
  return await (
    await viem.getContractAt("Implementation", contractAddress)
  ).read.resellChain([BigInt(index)]);
}

export function mapResellTerms(entry: Awaited<ReturnType<typeof getResellChain>>) {
  const [
    _account,
    _validator,
    _price,
    _fee,
    _startTime,
    _encrDestURL,
    _encrValidatorURL,
    _lastSettlementTime,
    _seller,
    _resellPrice,
    _resellProfitTarget,
    _isResellable,
    _isResellToDefaultBuyer,
  ] = entry;

  return {
    _account,
    _validator,
    _price,
    _fee,
    _startTime,
    _encrDestURL,
    _encrValidatorURL,
    _lastSettlementTime, // timestamp when the contract was settled last time
    // resell terms
    _seller, // seller of the contract !== account when there is a default buyer
    _resellPrice,
    _isResellable,
    _resellProfitTarget,
    _isResellToDefaultBuyer, //
  };
}
