import { upgrades, ethers } from "hardhat";
import { requireEnvsSet } from "../lib/utils";

async function main(log = console.log) {
  log("Import contracts script - recreate openzeppelin state")
  log()
  
  const env = requireEnvsSet("CLONE_FACTORY_ADDRESS")

  log("CLONEFACTORY address:", env.CLONE_FACTORY_ADDRESS);
  log()

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const Implementation = await ethers.getContractFactory("Implementation");

  const baseImplementationAddr = await CloneFactory.attach(env.CLONE_FACTORY_ADDRESS).baseImplementation();
  log("Base IMPLEMENTATION:", baseImplementationAddr);
  log()

  await upgrades.forceImport(env.CLONE_FACTORY_ADDRESS, CloneFactory)
  log("CLONEFACTORY imported")

  await upgrades.forceImport(baseImplementationAddr, Implementation)
  log("IMPLEMENTATION imported")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });