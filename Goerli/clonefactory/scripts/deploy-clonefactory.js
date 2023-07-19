require("dotenv").config();
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("CloneFactory deployment script")
  console.log()

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", (await deployer.getBalance()).toString());
  console.log("LUMERIN address:", process.env.LUMERIN_TOKEN_ADDRESS);
  console.log()
  console.log("1. Deploying upgradeable base Implementation")
  const Implementation = await ethers.getContractFactory("Implementation");
  const implementation = await upgrades.deployBeacon(Implementation, { unsafeAllow: ['constructor'] });
  await implementation.deployed();
  let receipt = await ethers.provider.getTransactionReceipt(implementation.deployTransaction.hash);
  console.log("Beacon deployed at address:", implementation.address, " gas used: ", receipt.gasUsed);

  const beaconProxy = await upgrades.deployBeaconProxy(implementation.address, Implementation, [], { 
    unsafeAllow: ['constructor'],
    initializer: false, 
  });
  await beaconProxy.deployed();
  receipt = await ethers.provider.getTransactionReceipt(beaconProxy.deployTransaction.hash);
  console.log("Beacon proxy deployed at address", beaconProxy.address, " gas used: ", receipt.gasUsed);
  console.log()

  console.log("2. Deploying upgradeable CloneFactory")
  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = await upgrades.deployProxy(
    CloneFactory, 
    [implementation.address, process.env.LUMERIN_TOKEN_ADDRESS, deployer.address], 
    { unsafeAllow: ['constructor'] }
  );
  await cloneFactory.deployed();
  receipt = await ethers.provider.getTransactionReceipt(cloneFactory.deployTransaction.hash);
  console.log("CloneFactory proxy deployed to:", cloneFactory.address, " gas used: ", receipt.gasUsed);

  console.log()
  console.log("Success!")
  console.log("CLONE_FACTORY_ADDRESS=" + cloneFactory.address)

  fs.writeFileSync("clonefactory-addr.tmp", String(cloneFactory.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
