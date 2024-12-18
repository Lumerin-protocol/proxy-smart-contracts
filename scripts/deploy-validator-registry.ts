import fs from "node:fs";
import { requireEnvsSet } from "../lib/utils";
import { ethers, upgrades, run } from "hardhat";

async function main() {
  console.log("Validation registry deployment script");
  console.log();

  const env = requireEnvsSet(
    "OWNER_PRIVATEKEY",
    "LUMERIN_TOKEN_ADDRESS",
    "VALIDATOR_STAKE_MINIMUM",
    "VALIDATOR_STAKE_REGISTER",
    "VALIDATOR_PUNISH_AMOUNT",
    "VALIDATOR_PUNISH_THRESHOLD"
  );

  const vr = await ethers.getContractFactory("ValidatorRegistry");
  const proxy = await upgrades.deployProxy(vr, [
    env.LUMERIN_TOKEN_ADDRESS,
    env.VALIDATOR_STAKE_MINIMUM,
    env.VALIDATOR_STAKE_REGISTER,
    env.VALIDATOR_PUNISH_AMOUNT,
    env.VALIDATOR_PUNISH_THRESHOLD,
  ]);

  await proxy.deployed();

  console.log("SUCCESS");
  console.log("VALIDATOR REGISTRY address:", proxy.address);
  fs.writeFileSync("validator-registry-addr.tmp", proxy.address);

  // verification
  const implAddr = await upgrades.erc1967.getImplementationAddress(proxy.address);
  console.log("VALIDATOR REGISTRY implementation address:", implAddr);

  console.log("Verifying contracts on Etherscan...");
  await run("verify:verify", { address: proxy.address });
  await run("verify:verify", { address: implAddr });
  console.log("Contracts verified on Etherscan");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
