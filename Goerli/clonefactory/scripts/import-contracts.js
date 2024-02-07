//@ts-check
require("dotenv").config();
const { upgrades, ethers } = require("hardhat");

/**
 * @param {(...arg)=>void} log
 * @returns {Promise<void>}
 */
async function main(log = console.log) {
  log("Import contracts script - recreate openzeppelin state")
  log()

  const cloneFactoryAddr = process.env.CLONE_FACTORY_ADDRESS
  if (!cloneFactoryAddr) throw new Error("CLONE_FACTORY_ADDRESS is not set")

  log("CLONEFACTORY address:", cloneFactoryAddr);
  log()

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const Implementation = await ethers.getContractFactory("Implementation");

  const baseImplementationAddr = await CloneFactory.attach(cloneFactoryAddr).baseImplementation();
  log("Base IMPLEMENTATION:", baseImplementationAddr);
  log()

  await upgrades.forceImport(cloneFactoryAddr, CloneFactory)
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