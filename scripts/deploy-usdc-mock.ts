import { viem } from "hardhat";
import { parseUnits } from "viem";

async function main() {
  console.log("Deploying USDC Mock token...");

  // Get wallet client
  const [deployer] = await viem.getWalletClients();
  console.log("Deployer address:", deployer.account.address);

  // Deploy USDC Mock contract
  const usdcMock = await viem.deployContract("contracts/mocks/USDCMock.sol:USDCMock", []);
  console.log("USDC Mock deployed at:", usdcMock.address);

  // Get token details
  const name = await usdcMock.read.name();
  const symbol = await usdcMock.read.symbol();
  const decimals = await usdcMock.read.decimals();
  const balance = await usdcMock.read.balanceOf([deployer.account.address]);

  console.log("\nToken Details:");
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Decimals:", decimals);
  console.log("Deployer Balance:", balance.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
