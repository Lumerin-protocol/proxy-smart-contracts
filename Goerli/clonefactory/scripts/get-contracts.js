//@ts-check

require("dotenv").config();
//@ts-ignore


/** @type { import("@nomiclabs/hardhat-ethers/types").HardhatEthersHelpers } */
//@ts-ignore
const ethers = require("hardhat").ethers
const Web3 = require("web3")
const { Implementation } = require("../build-js/dist")

async function main() {
  let contractAddress = process.env.CONTRACT_ADDRESS || "";

  if (contractAddress === "") {
    throw new Error('CONTRACT_ADDRESS env variable is required')
  }

  const Implementation = await ethers.getContractFactory("Implementation");
  const impl = Implementation.attach(contractAddress);
  const terms = await impl.terms();

  console.log(terms)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
