import { UpdateValidatorRegistry } from "../lib/deploy";
import { requireEnvsSet } from "../lib/utils";

async function main() {
  console.log("CloneFactory update script");
  console.log();

  const env = requireEnvsSet("OWNER_PRIVATEKEY", "VALIDATOR_REGISTRY_ADDRESS");
  await UpdateValidatorRegistry(
    "ValidatorRegistry",
    env.VALIDATOR_REGISTRY_ADDRESS,
    env.OWNER_PRIVATEKEY,
    console.log,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });