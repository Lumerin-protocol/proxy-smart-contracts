//@ts-check
require("dotenv").config();
const { ApproveSeller } = require("../lib/deploy");
const { CloneFactory } = require("../build-js/dist");
const { network } = require("hardhat");
const Web3 = require("web3");

async function main() {
  const ownerPrivateKey = process.env.OWNER_PRIVATEKEY
  const cloneFactoryAddress = process.env.CLONE_FACTORY_ADDRESS
  const whitelistedAddressesString = process.env.CLONE_FACTORY_WHITELIST_ADDRESSES;

  if (!ownerPrivateKey) throw new Error("OWNER_PRIVATEKEY is not set")
  if (!cloneFactoryAddress) throw new Error("CLONE_FACTORY_ADDRESS is not set")
  if (!whitelistedAddressesString) throw new Error("CLONE_FACTORY_WHITELIST_ADDRESSES is not set");

  /** @type {string[]} */
  let whitelistedAddresses = [];

  try {
    whitelistedAddresses = JSON.parse(whitelistedAddressesString);
    if (!Array.isArray(whitelistedAddresses)) {
      throw new Error("Is not a valid array");
    }
  } catch (err) {
    throw new Error(`Invalid CLONE_FACTORY_WHITELIST_ADDRESSES, should be a JSON array of strings: ${err}`);
  }


  /** @type {import("web3").default} */
  //@ts-ignore
  const web3 = new Web3(network.config.url)
  const deployerWallet = web3.eth.accounts.privateKeyToAccount(ownerPrivateKey)
  web3.eth.accounts.wallet.create(0).add(deployerWallet)

  console.log(`Whitelisting ${whitelistedAddresses.length} addresses:`);
  console.log(`${whitelistedAddresses}`);
  console.log(`CLONEFACTORY address: ${cloneFactoryAddress}`);
  console.log(`From address: ${deployerWallet.address}`);
  console.log("\n");

  for (const address of whitelistedAddresses) {
    await ApproveSeller(address, CloneFactory(web3, cloneFactoryAddress), deployerWallet.address, console.log)
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
