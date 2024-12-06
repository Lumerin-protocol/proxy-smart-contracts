import { requireEnvsSet } from "../lib/utils";
import { ethers, upgrades } from "hardhat";

// https://forum.openzeppelin.com/t/openzeppelin-upgrades-step-by-step-tutorial-for-hardhat/3580
async function main() {
  const env = requireEnvsSet("VALIDATOR_REGISTRY_ADDRESS");
  const validator = await ethers.getContractFactory("ValidatorRegistryV2");
  console.log("Preparing upgrade...");

  const validatorImpl = await upgrades.prepareUpgrade(env.VALIDATOR_REGISTRY_ADDRESS, validator);
  console.log("new implementation is at:", validatorImpl);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
