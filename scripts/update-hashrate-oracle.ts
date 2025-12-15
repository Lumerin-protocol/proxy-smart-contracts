import { requireEnvsSet } from "../lib/utils";
import { viem } from "hardhat";
import { verifyContract } from "./lib/verify";

async function main() {
  console.log("Hashrate Oracle deployment script");
  console.log();

  const env = <
    {
      BTCUSDC_ORACLE_ADDRESS: `0x${string}`;
      USDC_TOKEN_ADDRESS: `0x${string}`;
      HASHRATE_ORACLE_ADDRESS: `0x${string}`;
      UPDATER_ADDRESS: `0x${string}`;
    }
  >requireEnvsSet("BTCUSDC_ORACLE_ADDRESS", "USDC_TOKEN_ADDRESS", "HASHRATE_ORACLE_ADDRESS", "UPDATER_ADDRESS");

  const SAFE_OWNER_ADDRESS = process.env.SAFE_OWNER_ADDRESS as `0x${string}` | undefined;

  const [deployer] = await viem.getWalletClients();
  const pc = await viem.getPublicClient();
  console.log("Deployer:", deployer.account.address);
  console.log("Safe owner address:", SAFE_OWNER_ADDRESS);
  console.log("Updater address:", env.UPDATER_ADDRESS);

  console.log();

  console.log("Getting payment token decimals...");
  const paymentToken = await viem.getContractAt(
    "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata",
    env.USDC_TOKEN_ADDRESS
  );
  const tokenDecimals = await paymentToken.read.decimals();
  console.log("Name:", await paymentToken.read.name());
  console.log("Symbol:", await paymentToken.read.symbol());
  console.log("Decimals:", tokenDecimals);

  console.log();

  console.log("Getting Oracle details...");
  const btcusdOracle = await viem.getContractAt(
    "AggregatorV3Interface",
    env.BTCUSDC_ORACLE_ADDRESS
  );
  const oracleDecimals = await btcusdOracle.read.decimals();
  const btcPrice = Number((await btcusdOracle.read.latestRoundData())[1]) / 10 ** oracleDecimals;
  console.log("Oracle decimals:", oracleDecimals);
  console.log("BTC price:", btcPrice);

  console.log();

  // console.log("Checking existing HashrateOracle...");
  const oracleProxy = await viem.getContractAt("HashrateOracle", env.HASHRATE_ORACLE_ADDRESS);
  console.log("Version:", await oracleProxy.read.VERSION());
  console.log("Current implementation:", oracleProxy.address);
  console.log();

  console.log("Deploying new HashrateOracle implementation...");
  const hashrateOracleImpl = await viem.deployContract("HashrateOracle", [
    env.BTCUSDC_ORACLE_ADDRESS,
    tokenDecimals,
  ]);
  console.log("Deployed at:", hashrateOracleImpl.address);
  await verifyContract(hashrateOracleImpl.address, [env.BTCUSDC_ORACLE_ADDRESS, tokenDecimals]);
  // const hashrateOracleImpl = await viem.getContractAt(
  //   "HashrateOracle",
  //   "0x4b744bb1bf2ada0cfeec1f559ba6efd711ebdbec"
  // );

  const tx = await oracleProxy.write.upgradeToAndCall([hashrateOracleImpl.address, "0x"]);

  await pc.waitForTransactionReceipt({ hash: tx });
  console.log("Done!");

  console.log();
  const newImpl = await viem.getContractAt("HashrateOracle", env.HASHRATE_ORACLE_ADDRESS);
  console.log("Version:", await newImpl.read.VERSION());
  console.log();

  console.log("Setting updater address...");
  const hash = await oracleProxy.write.setUpdaterAddress([env.UPDATER_ADDRESS], {
    account: deployer.account.address,
  });
  await pc.waitForTransactionReceipt({ hash });
  console.log("Done!");
  console.log();
  console.log("Updater address:", await oracleProxy.read.updaterAddress());
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
