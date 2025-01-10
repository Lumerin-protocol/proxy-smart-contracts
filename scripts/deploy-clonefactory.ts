import fs from "fs"
import { DeployCloneFactory } from "../lib/deploy"
import { requireEnvsSet } from "../lib/utils"

async function main() {
  console.log("CloneFactory deployment script")
  console.log()

  const env = requireEnvsSet("OWNER_PRIVATEKEY", "LUMERIN_TOKEN_ADDRESS", "FEE_RECIPIENT_ADDRESS", "VALIDATOR_FEE_RATE")

  const { address } = await DeployCloneFactory(
    env.LUMERIN_TOKEN_ADDRESS, 
    env.OWNER_PRIVATEKEY, 
    env.FEE_RECIPIENT_ADDRESS, 
    Number(env.VALIDATOR_FEE_RATE),
    console.log
  );

  console.log("SUCCESS")
  console.log("CLONEFACTORY address:", address);

  fs.writeFileSync("clonefactory-addr.tmp", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
