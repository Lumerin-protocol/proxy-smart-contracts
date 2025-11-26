import { viem } from "hardhat";
import { requireEnvsSet } from "../lib/utils";
import { getAddress } from "viem/utils";
import { getResellChain } from "./lib/resell";

async function main() {
  const env = requireEnvsSet("CONTRACT_ADDRESS");
  const contractAddress = getAddress(env.CONTRACT_ADDRESS as `0x${string}`);

  console.log("Contract address:", contractAddress);
  console.log();

  const implementation = await viem.getContractAt("Implementation", contractAddress);

  console.log("Terms:\n");
  const terms = await implementation.read.terms();
  console.log(
    Object.entries(terms)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")
  );
  console.log();

  console.log("Resell chain:\n");
  for (let i = 0; i < 10; i++) {
    const data = await getResellChain(contractAddress, i);
    console.log(`${i}:`);
    console.log(
      Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
    );
    console.log();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
