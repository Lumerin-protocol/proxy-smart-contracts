//@ts-check
require("dotenv").config();
const { ApproveSeller } = require("../lib/deploy");
const { CloneFactory } = require("../build-js/dist");
const Web3 = require("web3");
const { Wallet } = require("ethers");

async function main() {
  /** @type {string[]} */
  let whitelistedAddresses = [];

  try {
    whitelistedAddresses = JSON.parse(process.env.CLONE_FACTORY_WHITELIST_ADDRESSES);
    if (!Array.isArray(whitelistedAddresses)) {
      throw new Error("Is not a valid array");
    }
  } catch (err) {
    throw new Error(`Invalid CLONE_FACTORY_WHITELIST_ADDRESSES, should be a JSON array of strings: ${err}`);
  }

  const privateKey = process.env.CONTRACTS_OWNER_PRIVATE_KEY
  const cloneFactoryAddress = process.env.CLONE_FACTORY_ADDRESS
  const deployerWallet = new Wallet(privateKey);
  
  console.log(`Whitelisting ${whitelistedAddresses.length} addresses:`);
  console.log(`${whitelistedAddresses}`);
  console.log(`CLONEFACTORY address: ${cloneFactoryAddress}`);
  console.log(`From address: ${deployerWallet.address}`);
  console.log("\n");
  
  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(process.env.ETH_NODE_ADDRESS)
  const account = web3.eth.accounts.privateKeyToAccount(deployerWallet.privateKey)
  web3.eth.accounts.wallet.create(0).add(account)
  
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
