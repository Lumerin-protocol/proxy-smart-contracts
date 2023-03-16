require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Account balance:", (await deployer.getBalance()).toString());

  console.log("\nDeploying CLONEFACTORY with the account:", deployer.address);
  console.log("LUMERIN address:", process.env.LUMERIN_TOKEN_ADDRESS);
  console.log("VALIDATOR address:", process.env.VALIDATOR_ADDRESS);

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = await CloneFactory.deploy(
    process.env.LUMERIN_TOKEN_ADDRESS,
    process.env.VALIDATOR_ADDRESS
  );
  await cloneFactory.deployed();

  console.log("CLONEFACTORY address:", cloneFactory.address);
  fs.writeFileSync("clonefactory-addr.tmp", String(cloneFactory.address));
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
