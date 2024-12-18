import { run } from "hardhat";
import fs from "fs";
import { UpdateCloneFactory } from "../lib/deploy";
import { requireEnvsSet } from "../lib/utils";

async function main() {
  console.log("CloneFactory update script");
  console.log();

  const env = requireEnvsSet("OWNER_PRIVATEKEY", "CLONE_FACTORY_ADDRESS");
  const { logicAddress } = await UpdateCloneFactory(
    "CloneFactory",
    env.CLONE_FACTORY_ADDRESS,
    env.OWNER_PRIVATEKEY,
    console.log
  );

  await run("verify:verify", { address: logicAddress });

  fs.writeFileSync("clonefactory-addr.tmp", env.CLONE_FACTORY_ADDRESS);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
