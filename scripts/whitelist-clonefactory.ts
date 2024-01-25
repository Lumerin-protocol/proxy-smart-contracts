import { ApproveSeller } from "../lib/deploy";
import { CloneFactory } from "../build-js/dist";
import { network, ethers } from "hardhat";
import Web3 from "web3"
import { requireEnvsSet } from "../lib/utils"
import { HttpNetworkConfig } from "hardhat/types";

async function main() {
  console.log("CloneFactory whitelist script")
  console.log()

  const env = requireEnvsSet("OWNER_PRIVATEKEY", "CLONE_FACTORY_ADDRESS", "CLONE_FACTORY_WHITELIST_ADDRESSES");
  const whitelistedAddresses = requireEnvJSONArray("CLONE_FACTORY_WHITELIST_ADDRESSES");

  const web3 = new Web3((network.config as HttpNetworkConfig).url)
  const deployerWallet = web3.eth.accounts.privateKeyToAccount(env.OWNER_PRIVATEKEY)
  web3.eth.accounts.wallet.create(0).add(deployerWallet)

  console.log(`Whitelisting ${whitelistedAddresses.length} addresses:`);
  console.log(`${whitelistedAddresses}`);
  console.log(`CLONEFACTORY address: ${env.CLONE_FACTORY_ADDRESS}`);
  console.log(`From address: ${deployerWallet.address}`);
  console.log("\n");

  for (const address of whitelistedAddresses) {
    await ApproveSeller(address, CloneFactory(web3, env.CLONE_FACTORY_ADDRESS), deployerWallet.address, console.log)
    console.log(`Added to whitelist: ${address}`);
  }

  console.log("\n");
  console.log("Whitelisting finished");
}

function requireEnvJSONArray(envName: string): string[] {
  try {
    return parseJSONArray(process.env[envName]!);
  } catch (err) {
    throw new Error(`Invalid CLONE_FACTORY_WHITELIST_ADDRESSES, should be a JSON array of strings: ${err}`);
  }
}

function parseJSONArray(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch (err) {
    throw new Error(`Invalid JSON array: ${err}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
