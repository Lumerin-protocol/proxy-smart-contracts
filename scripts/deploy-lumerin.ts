import fs from "fs"
import { DeployLumerin } from "../lib/deploy"
import { requireEnvsSet } from "../lib/utils"

async function main() {
  console.log("Lumerin deployment script")

  const env = requireEnvsSet("OWNER_PRIVATEKEY")
  const { address } = await DeployLumerin(env.OWNER_PRIVATEKEY, console.log);

  console.log("SUCCESS")
  console.log("LUMERIN address:", address);
  fs.writeFileSync("lumerin-addr.tmp", String(address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
