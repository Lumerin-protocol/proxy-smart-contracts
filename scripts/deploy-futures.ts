import fs from "node:fs";
import { requireEnvsSet } from "../lib/utils";
import { viem } from "hardhat";
import { encodeFunctionData, zeroAddress } from "viem";
import { writeAndWait } from "./lib/writeContract";
import { verifyContract } from "./lib/verify";

async function main() {
  console.log("Futures deployment script");
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
    }
  >requireEnvsSet("LUMERIN_TOKEN_ADDRESS", "USDC_TOKEN_ADDRESS", "HASHRATE_ORACLE_ADDRESS", "VALIDATOR_ADDRESS", "SELLER_LIQUIDATION_MARGIN_PERCENT", "BUYER_LIQUIDATION_MARGIN_PERCENT", "SPEED_HPS", "DELIVERY_DURATION_SECONDS", "PRICE_LADDER_STEP");
  const SAFE_OWNER_ADDRESS = process.env.SAFE_OWNER_ADDRESS as `0x${string}` | undefined;

  const [deployer] = await viem.getWalletClients();
  console.log("Deployer:", deployer.account.address);

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

  // Deploy Futures implementation
  console.log("Deploying Futures implementation...");
  const futuresImpl = await viem.deployContract("contracts/marketplace/Futures.sol:Futures", []);
  console.log("Deployed at:", futuresImpl.address);
  await verifyContract(futuresImpl.address, []);

  console.log();

  // Deploy Futures proxy
  console.log("Deploying Futures proxy...");
  const encodedInitFn = encodeFunctionData({
    abi: futuresImpl.abi,
    functionName: "initialize",
    args: [
      env.USDC_TOKEN_ADDRESS as `0x${string}`, // payment token
      env.HASHRATE_ORACLE_ADDRESS as `0x${string}`, // hashrate oracle
      env.VALIDATOR_ADDRESS as `0x${string}`, // validator address
      Number(env.SELLER_LIQUIDATION_MARGIN_PERCENT), // seller liquidation margin percent
      Number(env.BUYER_LIQUIDATION_MARGIN_PERCENT), // buyer liquidation margin percent
      BigInt(env.SPEED_HPS), // speed HPS
      Number(env.DELIVERY_DURATION_SECONDS), // delivery duration seconds
      BigInt(env.PRICE_LADDER_STEP), // price ladder step
    ],
  });

  const futuresProxy = await viem.deployContract(
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
    [futuresImpl.address, encodedInitFn]
  );
  console.log("Deployed at:", futuresProxy.address);

  const futures = await viem.getContractAt("Futures", futuresProxy.address);

  console.log();

  if (SAFE_OWNER_ADDRESS) {
    console.log("Transferring ownership of Futures to owner:", SAFE_OWNER_ADDRESS);

    const res = await futures.simulate.transferOwnership([SAFE_OWNER_ADDRESS]);
    const receipt = await writeAndWait(deployer, res);
    console.log("Txhash:", receipt.transactionHash);
  }

  console.log("---");
  console.log("SUCCESS");

  console.log("FUTURES address:", futuresProxy.address);
  fs.writeFileSync("futures-addr.tmp", futuresProxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
