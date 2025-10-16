import { requireEnvsSet } from "../lib/utils";
import { viem } from "hardhat";
import { verifyContract } from "./lib/verify";

async function main() {
  console.log("Futures contract update script");
  console.log();

  const env = <
    {
      LUMERIN_TOKEN_ADDRESS: `0x${string}`;
      USDC_TOKEN_ADDRESS: `0x${string}`;
      HASHRATE_ORACLE_ADDRESS: `0x${string}`;
      VALIDATOR_ADDRESS: `0x${string}`;
      SELLER_LIQUIDATION_MARGIN_PERCENT: string;
      BUYER_LIQUIDATION_MARGIN_PERCENT: string;
      SPEED_HPS: string;
      DELIVERY_DURATION_SECONDS: string;
      PRICE_LADDER_STEP: string;
      FUTURES_ADDRESS: `0x${string}`;
    }
  >requireEnvsSet("LUMERIN_TOKEN_ADDRESS", "USDC_TOKEN_ADDRESS", "HASHRATE_ORACLE_ADDRESS", "VALIDATOR_ADDRESS", "SELLER_LIQUIDATION_MARGIN_PERCENT", "BUYER_LIQUIDATION_MARGIN_PERCENT", "SPEED_HPS", "DELIVERY_DURATION_SECONDS", "PRICE_LADDER_STEP", "FUTURES_ADDRESS");

  const SAFE_OWNER_ADDRESS = process.env.SAFE_OWNER_ADDRESS as `0x${string}` | undefined;

  const [deployer] = await viem.getWalletClients();
  const pc = await viem.getPublicClient();
  console.log("Deployer:", deployer.account.address);
  console.log("Safe owner address:", SAFE_OWNER_ADDRESS);

  console.log();

  // Verify token contracts
  const paymentToken = await viem.getContractAt(
    "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata",
    env.USDC_TOKEN_ADDRESS
  );
  console.log("Payment token:", paymentToken.address);
  console.log("Name:", await paymentToken.read.name());
  console.log("Symbol:", await paymentToken.read.symbol());
  console.log("Decimals:", await paymentToken.read.decimals());

  console.log();

  const feeToken = await viem.getContractAt(
    "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata",
    env.LUMERIN_TOKEN_ADDRESS as `0x${string}`
  );
  console.log("Fee token:", feeToken.address);
  console.log("Name:", await feeToken.read.name());
  console.log("Symbol:", await feeToken.read.symbol());
  console.log("Decimals:", await feeToken.read.decimals());

  console.log();

  const hashrateOracle = await viem.getContractAt(
    "HashrateOracle",
    env.HASHRATE_ORACLE_ADDRESS as `0x${string}`
  );
  console.log("Hashrate oracle:", hashrateOracle.address);
  console.log("Num hashes to find to earn 1 satoshi:", await hashrateOracle.read.getHashesForBTC());

  console.log();

  console.log("Checking existing Futures contract...");
  const futuresProxy = await viem.getContractAt("Futures", env.FUTURES_ADDRESS);
  console.log("Current implementation:", futuresProxy.address);
  console.log("Owner:", await futuresProxy.read.owner());
  console.log("Payment token:", await futuresProxy.read.token());
  console.log("Hashrate oracle:", await futuresProxy.read.hashrateOracle());
  console.log("Validator address:", await futuresProxy.read.validatorAddress());
  console.log();

  console.log("Deploying new Futures implementation...");
  const futuresImpl = await viem.deployContract("contracts/marketplace/Futures.sol:Futures", []);
  console.log("Deployed at:", futuresImpl.address);
  await verifyContract(futuresImpl.address, []);

  console.log();
  console.log("Upgrading Futures proxy to new implementation...");
  const tx = await futuresProxy.write.upgradeToAndCall([futuresImpl.address, "0x"]);

  await pc.waitForTransactionReceipt({ hash: tx });
  console.log("Upgrade transaction completed!");

  console.log();
  console.log("Verifying upgrade...");
  const upgradedFutures = await viem.getContractAt("Futures", env.FUTURES_ADDRESS);
  console.log("Payment token:", await upgradedFutures.read.token());
  console.log("Hashrate oracle:", await upgradedFutures.read.hashrateOracle());
  console.log("Validator address:", await upgradedFutures.read.validatorAddress());
  console.log("Owner:", await upgradedFutures.read.owner());

  // TODO: propose upgrade to owner

  console.log();
  console.log("---");
  console.log("SUCCESS");
  console.log("FUTURES address:", env.FUTURES_ADDRESS);
  console.log("New implementation:", futuresImpl.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
