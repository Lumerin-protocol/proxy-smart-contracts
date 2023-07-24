// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const fs = require("fs");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  //TODO: extract deployment code to separate file in lib folder
  console.log("Deploying FAUCET with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log("LUMERIN address:", process.env.LUMERIN_TOKEN_ADDRESS);

  const Faucet = await ethers.getContractFactory("Faucet");
  const faucet = await Faucet.deploy(process.env.LUMERIN_TOKEN_ADDRESS);
  await faucet.deployed();
  const receipt = await ethers.provider.getTransactionReceipt(faucet.deployTransaction.hash);

  console.log("Faucet address:", faucet.address, " gas used: ", receipt.gasUsed);
  fs.writeFileSync("faucet-addr.tmp", String(faucet.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
