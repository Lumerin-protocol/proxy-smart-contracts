require("dotenv").config();
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("CloneFactory update script")
  console.log()

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", (await deployer.getBalance()).toString());
  console.log("LUMERIN address:", process.env.LUMERIN_TOKEN_ADDRESS);
  console.log("CLONE FACTORY address:", process.env.CLONE_FACTORY_ADDRESS);
  console.log()
  
  const currentCloneFactoryImpl = await upgrades.erc1967.getImplementationAddress(process.env.CLONE_FACTORY_ADDRESS)
  console.log("Current CLONE FACTORY implementation:", currentCloneFactoryImpl);

  const CloneFactory = await ethers.getContractFactory("CloneFactory2");
  const cloneFactory = await upgrades.upgradeProxy(process.env.CLONE_FACTORY_ADDRESS, CloneFactory, { unsafeAllow: ['constructor'] });
  await cloneFactory.deployed();
  const receipt = await ethers.provider.getTransactionReceipt(cloneFactory.deployTransaction.hash);

  const newCloneFactoryImpl = await upgrades.erc1967.getImplementationAddress(process.env.CLONE_FACTORY_ADDRESS)
  console.log("New CLONE FACTORY implementation:", newCloneFactoryImpl, " gas used: ", receipt.gasUsed);
  console.log()

  if (currentCloneFactoryImpl == newCloneFactoryImpl) {
    console.log("Warning: CLONE FACTORY implementation didn't change, cause it's likely the same implementation");
  } else {
    console.log("CLONE FACTORY implementation updated")
  }
  
  fs.writeFileSync("clonefactory-addr.tmp", String(cloneFactory.address));
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });