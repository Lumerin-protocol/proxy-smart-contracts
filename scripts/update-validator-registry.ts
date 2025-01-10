import { requireEnvsSet } from "../lib/utils";
import { ethers, run, upgrades } from "hardhat";

// https://forum.openzeppelin.com/t/openzeppelin-upgrades-step-by-step-tutorial-for-hardhat/3580
async function main() {
  const env = requireEnvsSet("VALIDATOR_REGISTRY_ADDRESS");
  const validator = await ethers.getContractFactory("ValidatorRegistry");
  console.log("Preparing upgrade...");

  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    env.VALIDATOR_REGISTRY_ADDRESS
  );
  console.log("Current implementation:", currentImpl);

  const validatorImpl = await upgrades.upgradeProxy(env.VALIDATOR_REGISTRY_ADDRESS, validator);
  console.log("new implementation is at:", validatorImpl.address);

  console.log("Verifying implementation...");
  await run("verify:verify", { address: validatorImpl.address })
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
