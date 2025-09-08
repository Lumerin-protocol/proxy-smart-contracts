import fs from "node:fs";
import { requireEnvsSet } from "../lib/utils";
import { viem } from "hardhat";
import { encodeFunctionData, zeroAddress } from "viem";
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
      CF_MIN_SELLER_STAKE: string;
      CF_MIN_CONTRACT_DURATION: string;
      CF_MAX_CONTRACT_DURATION: string;
    }
  >requireEnvsSet("LUMERIN_TOKEN_ADDRESS", "VALIDATOR_FEE_RATE", "USDC_TOKEN_ADDRESS", "HASHRATE_ORACLE_ADDRESS", "CF_MIN_SELLER_STAKE", "CF_MIN_CONTRACT_DURATION", "CF_MAX_CONTRACT_DURATION");
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

  console.log();

  // Deploy Implementation and Beacon
  console.log("Deploying Implementation mock implementation...");
  const mockImplementation = await viem.deployContract(
    "contracts/marketplace/Implementation.sol:Implementation",
    [zeroAddress, zeroAddress, zeroAddress, zeroAddress]
  );

  console.log("Deploying Implementation beacon...");
  const beacon = await viem.deployContract(
    "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol:UpgradeableBeacon",
    [mockImplementation.address, deployer.account.address]
  );
  console.log("Deployed at:", beacon.address);

  console.log("Deploying clonefactory");
  const cloneFactoryImpl = await viem.deployContract(
    "contracts/marketplace/CloneFactory.sol:CloneFactory",
    []
  );
  console.log("Deployed at:", cloneFactoryImpl.address);
  await verifyContract(cloneFactoryImpl.address, []);
  console.log("Version:", await cloneFactoryImpl.read.VERSION());

  const feeDecimals = await cloneFactoryImpl.read.VALIDATOR_FEE_DECIMALS();
  console.log("Validator fee decimals:", feeDecimals);

  console.log();

  console.log("Deploying CloneFactory proxy...");
  const encodedInitFn = encodeFunctionData({
    abi: cloneFactoryImpl.abi,
    functionName: "initialize",
    args: [
      beacon.address, // implementation address
      env.HASHRATE_ORACLE_ADDRESS as `0x${string}`, // beacon address
      env.USDC_TOKEN_ADDRESS as `0x${string}`, // payment token
      env.LUMERIN_TOKEN_ADDRESS as `0x${string}`, // fee token
      BigInt(Number(env.VALIDATOR_FEE_RATE) * 10 ** (feeDecimals + 8 - 6)), // validator fee rate
      BigInt(env.CF_MIN_SELLER_STAKE),
      Number(env.CF_MIN_CONTRACT_DURATION),
      Number(env.CF_MAX_CONTRACT_DURATION),
    ],
  });
  const cloneFactoryProxy = await viem.deployContract(
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
    [cloneFactoryImpl.address, encodedInitFn]
  );
  console.log("Deployed at:", cloneFactoryProxy.address);
  const cf = await viem.getContractAt("CloneFactory", cloneFactoryProxy.address);
  console.log("Version:", await cf.read.VERSION());

  ///////////////////////

  console.log("Deploying real Implementation...");
  const impl = await viem.deployContract("Implementation", [
    cloneFactoryProxy.address,
    env.HASHRATE_ORACLE_ADDRESS as `0x${string}`,
    env.USDC_TOKEN_ADDRESS as `0x${string}`,
    env.LUMERIN_TOKEN_ADDRESS as `0x${string}`,
  ]);
  console.log("Deployed at:", impl.address);
  await verifyContract(impl.address, [
    cloneFactoryProxy.address,
    env.HASHRATE_ORACLE_ADDRESS as `0x${string}`,
    env.USDC_TOKEN_ADDRESS as `0x${string}`,
    env.LUMERIN_TOKEN_ADDRESS as `0x${string}`,
  ]);
  console.log("Version:", await impl.read.VERSION());

  console.log();

  console.log("Upgrading beacon to real Implementation...");
  const tx = await beacon.simulate.upgradeTo([impl.address]);
  const receipt = await writeAndWait(deployer, tx);
  console.log("Txhash:", receipt.transactionHash);

  console.log();
  if (SAFE_OWNER_ADDRESS) {
    console.log("Transferring ownership of CloneFactory to owner:", SAFE_OWNER_ADDRESS);

    const res = await cf.simulate.transferOwnership([SAFE_OWNER_ADDRESS]);
    const receipt = await writeAndWait(deployer, res);
    console.log("Txhash:", receipt.transactionHash);

    console.log();
    console.log("Transferring ownership of Implementation to owner:", SAFE_OWNER_ADDRESS);

    const res2 = await beacon.simulate.transferOwnership([SAFE_OWNER_ADDRESS]);
    const receipt2 = await writeAndWait(deployer, res2);
    console.log("Txhash:", receipt2.transactionHash);
  }

  console.log("---");
  console.log("SUCCESS");

  console.log("CLONE_FACTORY address:", cloneFactoryProxy.address);
  fs.writeFileSync("clone-factory-addr.tmp", cloneFactoryProxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
