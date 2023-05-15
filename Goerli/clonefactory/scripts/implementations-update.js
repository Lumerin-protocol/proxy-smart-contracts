require("dotenv").config();
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Updating IMPLEMENTATION contract");
  console.log();
  console.log("Clonefactory address", process.env.CLONE_FACTORY_ADDRESS)
  console.log("Deployer account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log();

  const CloneFactory = await ethers.getContractFactory("CloneFactory");  
  const Implementation = await ethers.getContractFactory("Implementation");  

  const baseImplementationAddr = await CloneFactory.attach(process.env.CLONE_FACTORY_ADDRESS).baseImplementation();
  console.log("Updating base implementation contract:", baseImplementationAddr);
  
  const oldLogicAddr = await upgrades.beacon.getImplementationAddress(baseImplementationAddr);
  console.log("Old beacon proxy logic:", oldLogicAddr)
  console.log();
  
  const newImplementation = await upgrades.upgradeBeacon(baseImplementationAddr, Implementation, { unsafeAllow: ['constructor'] });
  const newLogicAddr = await upgrades.beacon.getImplementationAddress(newImplementation.address);
  console.log("New beacon proxy logic:", newLogicAddr)

  if (oldLogicAddr == newLogicAddr) {
    console.log("Warning. Implementation proxy logic didn't change, cause it's likely the same implementation.");
  } else {
    console.log("Implementation proxy logic changed.")
    console.log("New proxy logic address:", newLogicAddr)
  }
  console.log();

  console.log("SUCCESS. Base implementation contract updated.");
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });