import { UpdateImplementation } from "../lib/deploy";
import { requireEnvsSet } from "../lib/utils";
import { run } from "hardhat";

async function main() {
  console.log("Implementation update script");

  const env = requireEnvsSet("OWNER_PRIVATEKEY", "CLONE_FACTORY_ADDRESS");
  const { logicAddress } = await UpdateImplementation(
    "Implementation",
    env.CLONE_FACTORY_ADDRESS,
    env.OWNER_PRIVATEKEY,
    console.log
  );

  await run("verify:verify", { address: logicAddress })
    .then(() => {
      console.log("Contracts verified on Etherscan");
    })
    .catch((error) => {
      console.error("Error verifying contracts on Etherscan:", error);
    });

  console.log("SUCCESS. Implementation updated.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
