require("dotenv").config();
const fs = require("fs");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying LUMERIN with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Lumerin = await ethers.getContractFactory("Lumerin");
  const lumerin = await Lumerin.deploy();
  await lumerin.deployed();
  const receipt = await ethers.provider.getTransactionReceipt(lumerin.deployTransaction.hash);

  console.log("LUMERIN address:", lumerin.address, " gas used: ", receipt.gasUsed);
  fs.writeFileSync("lumerin-addr.tmp", String(lumerin.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
