import fs from "fs";
import { DeployValidatorRegistry } from "../lib/deploy";
import { requireEnvsSet } from "../lib/utils";

async function main() {
  console.log("Validator registry deployment script");
  console.log();

  const env = requireEnvsSet(
    "OWNER_PRIVATEKEY",
    "VALIDATOR_REGISTRY_STAKE_MINIMUN",
    "VALIDATOR_REGISTRY_STAKE_REGISTER",
    "VALIDATOR_REGISTRY_PUNISH_AMOUNT",
    "VALIDATOR_REGISTRY_PUNISH_THRESHOLD",
  );

  const punishThreshold = Number(env.VALIDATOR_REGISTRY_PUNISH_THRESHOLD);
  if (!Number.isFinite(punishThreshold) || punishThreshold < 0) {
    throw new Error(
      `Invalid VALIDATOR_REGISTRY_PUNISH_THRESHOLD ${env.VALIDATOR_REGISTRY_PUNISH_THRESHOLD}`,
    );
  }

  const { address } = await DeployValidatorRegistry(
    env.OWNER_PRIVATEKEY,
    env.VALIDATOR_REGISTRY_STAKE_MINIMUN,
    env.VALIDATOR_REGISTRY_STAKE_REGISTER,
    env.VALIDATOR_REGISTRY_PUNISH_AMOUNT,
    punishThreshold,
    console.log,
  );

  console.log("SUCCESS");
  console.log("CLONEFACTORY address:", address);

  fs.writeFileSync("validator-registry-addr.tmp", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
