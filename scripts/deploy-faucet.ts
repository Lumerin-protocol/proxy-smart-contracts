import fs from "fs"
import { ethers } from "hardhat"
import { requireEnvsSet } from "../lib/utils";

async function main() {
  console.log("Faucet deployment script")

  const env = requireEnvsSet("LUMERIN_TOKEN_ADDRESS", "FAUCET_DAILY_MAX_LMR", "FAUCET_LMR_PAYOUT", "FAUCET_ETH_PAYOUT")
  const [deployer] = await ethers.getSigners();
  
  //TODO: extract deployment code to separate file in lib folder
  console.log("Deploying FAUCET with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log("LUMERIN address:", env.LUMERIN_TOKEN_ADDRESS);

  const Faucet = await ethers.getContractFactory("Faucet");
  const faucet = await Faucet.deploy(
    env.LUMERIN_TOKEN_ADDRESS,
    env.FAUCET_DAILY_MAX_LMR,
    env.FAUCET_LMR_PAYOUT,
    env.FAUCET_ETH_PAYOUT,
  );
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
