require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = await CloneFactory.deploy(
    process.env.LUMERIN_TOKEN_ADDR,
    process.env.VALIDATOR_TOKEN_ADDR
  );
  await cloneFactory.deployed();

  console.log("Clone Factory address:", cloneFactory.address);
  fs.writeFileSync("clonefactory-addr.tmp", String(cloneFactory.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
