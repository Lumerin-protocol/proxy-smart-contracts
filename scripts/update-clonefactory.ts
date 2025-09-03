import { requireEnvsSet } from "../lib/utils";
import { viem } from "hardhat";
import { verifyContract } from "./lib/verify";
import { upgrades } from "hardhat";
import { encodeFunctionData } from "viem/utils";

async function main() {
  console.log("CloneFactory update script");
  console.log();

  const env = <
    {
      CLONE_FACTORY_ADDRESS: `0x${string}`;
      HASHRATE_ORACLE_ADDRESS: `0x${string}`;
      USDC_TOKEN_ADDRESS: `0x${string}`;
      LUMERIN_TOKEN_ADDRESS: `0x${string}`;
    }
  >requireEnvsSet("CLONE_FACTORY_ADDRESS", "HASHRATE_ORACLE_ADDRESS", "USDC_TOKEN_ADDRESS", "LUMERIN_TOKEN_ADDRESS");

  const [deployer] = await viem.getWalletClients();
  console.log("Deployer:", deployer.account.address);

  // Get the existing CloneFactory proxy contract
  const cloneFactoryProxy = await viem.getContractAt("CloneFactory", env.CLONE_FACTORY_ADDRESS);
  const currentImplementation = await upgrades.erc1967.getImplementationAddress(
    cloneFactoryProxy.address
  );
  console.log("CloneFactory proxy:", cloneFactoryProxy.address);
  console.log("Current version:", await cloneFactoryProxy.read.VERSION());
  console.log("Current implementation:", currentImplementation);

  // // Register the existing proxy
  // console.log("\nRegistering existing proxy...");
  // const CloneFactory = await ethers.getContractFactory("CloneFactory");
  // await upgrades.forceImport(env.CLONE_FACTORY_ADDRESS, CloneFactory);
  // console.log("Proxy registration successful");

  // Validate the upgrade
  // console.log("\nValidating upgrade...");
  // await upgrades.validateUpgrade(env.CLONE_FACTORY_ADDRESS, CloneFactory);
  // console.log("Upgrade validation successful - storage layout is compatible");

  // Deploy new implementation
  console.log("\nDeploying new CloneFactory implementation...");
  const newImpl = await viem.deployContract("CloneFactory");
  console.log("New implementation deployed at:", newImpl.address);
  console.log("New version:", await newImpl.read.VERSION());
  await verifyContract(newImpl.address, []);

  // Update the proxy to point to new implementation
  console.log("\nUpdating proxy to new implementation...");
  // encode call to setHashrateOracle
  const setHashrateOracleCall = encodeFunctionData({
    abi: cloneFactoryProxy.abi,
    functionName: "setHashrateOracle",
    args: [env.HASHRATE_ORACLE_ADDRESS],
  });
  const tx = await cloneFactoryProxy.write.upgradeToAndCall(
    [newImpl.address, setHashrateOracleCall],
    { account: deployer.account.address }
  );
  console.log("Proxy update txhash:", tx);

  const pc = await viem.getPublicClient();
  await pc.waitForTransactionReceipt({ hash: tx });

  // Verify the update was successful
  const newImplementation = await upgrades.erc1967.getImplementationAddress(
    cloneFactoryProxy.address
  );
  console.log("\nVerification:", newImplementation);
  console.log(
    "Update successful:",
    newImpl.address.toLowerCase() === newImplementation.toLowerCase()
  );

  console.log("\n---");
  console.log("SUCCESS");
  console.log("New clonefactory implementation address:", newImpl.address);

  //
  // Update Implementation
  //

  const hashrateContractBeaconAddr: `0x${string}` =
    await cloneFactoryProxy.read.baseImplementation();
  const beacon = await viem.getContractAt(
    "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol:UpgradeableBeacon",
    hashrateContractBeaconAddr
  );
  console.log("Beacon address:", beacon.address);

  // Get current Implementation address
  const currentImplAddress = await beacon.read.implementation();
  console.log("Current Implementation address:", currentImplAddress);

  // Deploy new Implementation
  console.log("\nDeploying new Implementation...");
  const params = [
    cloneFactoryProxy.address,
    env.HASHRATE_ORACLE_ADDRESS,
    env.USDC_TOKEN_ADDRESS,
    env.LUMERIN_TOKEN_ADDRESS,
  ] as const;

  const newHashrateContractImpl = await viem.deployContract("Implementation", [...params]);
  console.log("New Implementation deployed at:", newHashrateContractImpl.address);
  console.log("New Implementation version:", await newHashrateContractImpl.read.VERSION());
  await verifyContract(newHashrateContractImpl.address, [...params]);

  // Update beacon to point to new Implementation
  console.log("\nUpdating beacon to new Implementation...");
  const beaconTx = await beacon.write.upgradeTo([newHashrateContractImpl.address], {
    account: deployer.account.address,
  });

  await pc.waitForTransactionReceipt({ hash: beaconTx });
  console.log("Beacon update txhash:", beaconTx);

  // Verify beacon update
  const newBeaconImpl = await beacon.read.implementation();
  console.log("\nBeacon update verification:");
  console.log("New Implementation in beacon:", newBeaconImpl);
  console.log(
    "Update successful:",
    newHashrateContractImpl.address.toLowerCase() === newBeaconImpl.toLowerCase()
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
