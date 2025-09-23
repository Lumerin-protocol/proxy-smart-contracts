import { viem } from "hardhat";

export async function getResellChain(contractAddress: `0x${string}`, index: number) {
  const implementation = await viem.getContractAt("Implementation", contractAddress);
  const data = await implementation.read.resellChain([BigInt(index)]);
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
    _isResellable,
    _resellProfitTarget,
    _isResellToDefaultBuyer,
  ] = data;
  return {
    _account,
    _validator,
    _price,
    _fee,
    _startTime,
    _encrDestURL,
    _encrValidatorURL,
    _lastSettlementTime,
    _seller,
    _isResellable,
    _resellProfitTarget,
    _isResellToDefaultBuyer,
  };
}

type ResellTerms = Awaited<ReturnType<typeof getResellChain>>;

export async function getFullResellChain(contractAddress: `0x${string}`) {
  const data: ResellTerms[] = [];
  for (let i = 0; ; i++) {
    try {
      const d = await getResellChain(contractAddress, i);
      data.push(d);
    } catch (e) {
      break;
    }
  }
  return data;
}
