//@ts-check
require("dotenv").config();
/**
 * @type {import("hardhat/types/runtime").HardhatRuntimeEnvironment}
 */
const { ethers } = require("hardhat");

async function main() {
  let contractAddress = process.env.CONTRACT_ADDRESS || "";

  if (contractAddress === "") {
    throw new Error('CONTRACT_ADDRESS env variable is required')
  }

  const Implementation = await ethers.getContractFactory("Implementation");
  const implementation = Implementation.attach(contractAddress);
  const pubVars = await implementation.getPublicVariablesV2()
  console.log("Public vars:", pubVars)

  const destURL = await implementation.encrDestURL()
  console.log("Encrypted dest url:", destURL)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
