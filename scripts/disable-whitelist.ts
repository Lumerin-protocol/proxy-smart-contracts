import { viem } from "hardhat";
import { requireEnvsSet } from "../lib/utils";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const env = requireEnvsSet("OWNER_PRIVATEKEY", "CLONE_FACTORY_ADDRESS");

  const cf = await viem.getContractAt("CloneFactory", env.CLONE_FACTORY_ADDRESS as `0x${string}`);
  const account = privateKeyToAccount(`0x${env.OWNER_PRIVATEKEY}`);

  const hash = await cf.write.setDisableWhitelist({ account });
  console.log(`disableWhitelist tx hash: ${hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
