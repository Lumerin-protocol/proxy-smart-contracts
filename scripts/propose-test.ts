import { viem } from "hardhat";
import { SafeWallet } from "./lib/safe";
import { parseUnits } from "viem";
import { OperationType } from "@safe-global/types-kit";

async function main() {
  const [deployer] = await viem.getWalletClients();
  const pc = await viem.getPublicClient();

  const safeWalletAddr = "0x063eFfdB4f1aa1213F72C2a7781dC915e7eB6355";
  const signer = "0x1441Bc52156Cf18c12cde6A92aE6BDE8B7f775D4";

  console.log("Deployer:", deployer.account.address);

  const safe = new SafeWallet(safeWalletAddr, deployer);
  const txHash = await safe.proposeTransaction({
    data: "0x",
    to: signer,
    value: parseUnits("0.0001", 18).toString(),
    operation: OperationType.Call,
  });
  console.log("Transaction URL:", safe.getSafeUITxUrl(txHash));
}

main();
