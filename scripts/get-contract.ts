import { ethers } from "hardhat";
import { requireEnvsSet } from "../lib/utils";

async function main() {
  const env = requireEnvsSet("CONTRACT_ADDRESS");

  const Implementation = await ethers.getContractFactory("Implementation");
  const implementation = Implementation.attach(env.CONTRACT_ADDRESS);
  const pubVars = await implementation.getPublicVariablesV2();
  console.log("Public vars:", pubVars);

  const destURL = await implementation.encrDestURL();
  console.log("Encrypted dest url:", destURL);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
