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
  console.log("Beacon deployed at address:", implementation.address);

  const beaconProxy = await upgrades.deployBeaconProxy(implementation.address, Implementation, [], { 
    unsafeAllow: ['constructor'],
    initializer: false, 
  });
  await beaconProxy.deployed();
  console.log("Beacon proxy deployed at address", beaconProxy.address);
  console.log()

  console.log("2. Deploying upgradeable CloneFactory")
  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = await upgrades.deployProxy(
    CloneFactory, 
    [implementation.address, process.env.LUMERIN_TOKEN_ADDRESS, deployer.address], 
    { unsafeAllow: ['constructor'] }
  );
  await cloneFactory.deployed();
  console.log("CloneFactory proxy deployed to:", cloneFactory.address);

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
