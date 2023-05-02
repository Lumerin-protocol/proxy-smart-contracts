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

  console.log("Deploying FAUCET with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log("LUMERIN address:", process.env.LUMERIN_TOKEN_ADDRESS);

  const Faucet = await ethers.getContractFactory("Faucet");
  const faucet = await Faucet.deploy(
    process.env.LUMERIN_TOKEN_ADDRESS,
    process.env.FAUCET_DAILY_LIMIT_LMR,
    process.env.FAUCET_LMR_AMOUNT,
    process.env.FAUCET_ETH_AMOUNT,
  );
  await faucet.deployed();

  console.log("Faucet address:", faucet.address);
  fs.writeFileSync("faucet-addr.tmp", String(faucet.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
