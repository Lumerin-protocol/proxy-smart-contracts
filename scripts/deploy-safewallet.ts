import { viem } from "hardhat";
import { requireEnvsSet } from "../lib/utils";

async function main() {
  console.log("SafeWalletIntegration deployment script");
  console.log();

  const env = requireEnvsSet("CLONE_FACTORY_ADDRESS");

  console.log("Deploying SafeWalletIntegration...");
  const safeWalletIntegration = await viem.deployContract("SafeWalletIntegration", [
    env.CLONE_FACTORY_ADDRESS as `0x${string}`,
  ]);
  console.log("SafeWalletIntegration deployed at:", safeWalletIntegration.address);
  console.log("---");
  console.log("SUCCESS");

  console.log("SAFE_WALLET_INTEGRATION address:", safeWalletIntegration.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
