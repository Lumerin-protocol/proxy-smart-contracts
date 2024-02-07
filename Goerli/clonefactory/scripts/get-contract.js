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
  const terms = await implementation.terms()

  console.log(terms)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
