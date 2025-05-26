import fs from "node:fs";
import { requireEnvsSet } from "../lib/utils";
import { viem } from "hardhat";
import { encodeFunctionData } from "viem";
import { writeAndWait } from "./lib/writeContract";
import { verifyContract } from "./lib/verify";

async function main() {
  console.log("CloneFactory deployment script");
  console.log();

  const env = <
    {
      LUMERIN_TOKEN_ADDRESS: `0x${string}`;
      VALIDATOR_FEE_RATE: string;
      USDC_TOKEN_ADDRESS: `0x${string}`;
      HASHRATE_ORACLE_ADDRESS: `0x${string}`;
    }
  >requireEnvsSet("LUMERIN_TOKEN_ADDRESS", "VALIDATOR_FEE_RATE", "USDC_TOKEN_ADDRESS", "HASHRATE_ORACLE_ADDRESS");
  const SAFE_OWNER_ADDRESS = process.env.SAFE_OWNER_ADDRESS as `0x${string}` | undefined;

  const [deployer] = await viem.getWalletClients();
  console.log("Deployer:", deployer.account.address);

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
  console.log("Block reward:", await hashrateOracle.read.getBlockReward());
  console.log("Difficulty:", await hashrateOracle.read.getDifficulty());

  console.log();

  console.log("Deploying Implementation implementation...");
  const impl = await viem.deployContract("Implementation");
  console.log("Deployed at:", impl.address);
  await verifyContract(impl.address, []);
  console.log("Version:", await impl.read.VERSION());

  console.log();

  console.log("Deploying Implementation Beacon...");
  const beacon = await viem.deployContract(
    "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol:UpgradeableBeacon",
    [impl.address, deployer.account.address]
  );
  console.log("Deployed at:", beacon.address);
  await verifyContract(beacon.address, [impl.address, deployer.account.address]);
  console.log();

  console.log("Deploying CloneFactory implementation...");
  const cloneFactory = await viem.deployContract("CloneFactory");
  console.log("Deployed at:", cloneFactory.address);
  await verifyContract(cloneFactory.address, []);
  console.log("Version:", await cloneFactory.read.VERSION());

  const feeDecimals = await cloneFactory.read.VALIDATOR_FEE_DECIMALS();
  console.log("Validator fee decimals:", feeDecimals);

  console.log();

  console.log("Deploying CloneFactory proxy...");
  const encodedInitFn = encodeFunctionData({
    abi: cloneFactory.abi,
    functionName: "initialize",
    args: [
      beacon.address, // implementation address
      env.HASHRATE_ORACLE_ADDRESS as `0x${string}`, // beacon address
      env.USDC_TOKEN_ADDRESS as `0x${string}`, // payment token
      env.LUMERIN_TOKEN_ADDRESS as `0x${string}`, // fee token
      BigInt(Number(env.VALIDATOR_FEE_RATE) * 10 ** feeDecimals), // validator fee rate
    ],
  });
  const cloneFactoryProxy = await viem.deployContract(
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
    [cloneFactory.address, encodedInitFn]
  );
  console.log("Deployed at:", cloneFactoryProxy.address);
  await verifyContract(cloneFactoryProxy.address, [cloneFactory.address, encodedInitFn]);
  const cf = await viem.getContractAt("CloneFactory", cloneFactoryProxy.address);
  console.log("Version:", await cf.read.VERSION());

  console.log();
  if (SAFE_OWNER_ADDRESS) {
    console.log("Transferring ownership of CloneFactory to owner:", SAFE_OWNER_ADDRESS);

    const res = await cf.simulate.transferOwnership([SAFE_OWNER_ADDRESS]);
    const receipt = await writeAndWait(deployer, res);
    console.log("Txhash:", receipt.transactionHash);

    console.log();
    console.log("Transferring ownership of Implementation to owner:", SAFE_OWNER_ADDRESS);

    const res2 = await impl.simulate.transferOwnership([SAFE_OWNER_ADDRESS]);
    const receipt2 = await writeAndWait(deployer, res2);
    console.log("Txhash:", receipt2.transactionHash);
  }

  console.log("---");
  console.log("SUCCESS");

  console.log("CLONE_FACTORY address:", cloneFactoryProxy.address);
  fs.writeFileSync("clone-factory-addr.tmp", cloneFactory.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
