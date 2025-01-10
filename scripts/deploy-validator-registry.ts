import fs from "node:fs";
import { requireEnvsSet } from "../lib/utils";
import { ethers, upgrades, run, viem } from "hardhat";
import { privateKeyToAddress } from "viem/accounts";

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

  const normalizedPrivateKey: `0x${string}` = `0x${env.OWNER_PRIVATEKEY.replace("0x", "")}`;
  const ownerAddr = privateKeyToAddress(normalizedPrivateKey);
  console.log("OWNER address:", ownerAddr);
  const pc = await viem.getPublicClient();

  console.log("chainId:", await pc.getChainId());
  console.log(await pc.getBalance({ address: ownerAddr }));

  const vr = await ethers.getContractFactory("ValidatorRegistry");
  const proxy = await upgrades.deployProxy(
    vr,
    [
      env.LUMERIN_TOKEN_ADDRESS,
      env.VALIDATOR_STAKE_MINIMUM,
      env.VALIDATOR_STAKE_REGISTER,
      env.VALIDATOR_PUNISH_AMOUNT,
      env.VALIDATOR_PUNISH_THRESHOLD,
    ],
    { unsafeAllow: ["constructor"] }
  );

  await proxy.deployed();

  console.log("SUCCESS");
  console.log("VALIDATOR REGISTRY address:", proxy.address);
  fs.writeFileSync("validator-registry-addr.tmp", proxy.address);

  // verification
  const implAddr = await upgrades.erc1967.getImplementationAddress(proxy.address);
  console.log("VALIDATOR REGISTRY implementation address:", implAddr);

  console.log("Verifying contracts on Etherscan...");

  await run("verify:verify", { address: implAddr })
    .then(() => {
      console.log("Contracts verified on Etherscan");
    })
    .catch((error) => {
      console.error("Error verifying contracts on Etherscan:", error);
    });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
