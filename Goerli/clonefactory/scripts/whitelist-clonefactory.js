//@ts-check
require("dotenv").config();
const { ethers, config } = require("hardhat");
const { ApproveSeller } = require("../lib/deploy");
const { CloneFactory } = require("../build-js/dist");
const Web3 = require("web3");

async function main() {
  /** @type {string[]} */
  let whitelistedAddresses;

  try {
    whitelistedAddresses = JSON.parse(process.env.CLONE_FACTORY_WHITELIST_ADDRESSES);
    if (!Array.isArray(whitelistedAddresses)) {
      throw new Error("Is not a valid array");
    }
  } catch (err) {
    throw new Error(`Invalid CLONE_FACTORY_WHITELIST_ADDRESSES, should be a JSON array of strings: ${err}`);
  }

  console.log(`Whitelisting ${whitelistedAddresses.length} addresses:`);
  console.log(`${whitelistedAddresses}`);
  console.log(`CLONEFACTORY address: ${process.env.CLONE_FACTORY_ADDRESS}`);
  console.log("\n");

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(config.networks.localhost.url)
  const privateKey = process.env.CONTRACTS_OWNER_PRIVATE_KEY

  for (const address of whitelistedAddresses) {
    await ApproveSeller(address, CloneFactory(web3, process.env.CLONE_FACTORY_ADDRESS), privateKey, console.log)
    console.log(`Added to whitelist: ${address}`);
  }

  console.log("\n");
  console.log("Whitelisting finished");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
