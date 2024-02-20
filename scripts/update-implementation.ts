import { UpdateImplementation } from "../lib/deploy";
import { requireEnvsSet } from "../lib/utils";

async function main() {
  console.log("Implementation update script")

  const env = requireEnvsSet("OWNER_PRIVATEKEY", "CLONE_FACTORY_ADDRESS")
  await UpdateImplementation("Implementation", env.CLONE_FACTORY_ADDRESS, env.OWNER_PRIVATEKEY, console.log)

  console.log("SUCCESS. Implementation updated.")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });