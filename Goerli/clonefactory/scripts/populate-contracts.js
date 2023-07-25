//@ts-check
require("dotenv").config();
const { config, ethers } = require("hardhat");
const Web3 = require("web3");
const { Wallet } = require("ethers");
const { CloneFactory } = require("../build-js/dist");
const { CreateContract } = require("../lib/deploy");
const { buildContractsList } = require("../lib/populate-contracts");

const main = async function () {
  const seller = new Wallet(process.env.CONTRACTS_OWNER_PRIVATE_KEY).connect(ethers.provider)

  console.log("Deploying contracts with the seller account:", seller.address);
  console.log("Account balance:", (await seller.getBalance()).toString());
  console.log("CLONEFACTORY address:", process.env.CLONE_FACTORY_ADDRESS);
  console.log("VALIDATOR address:", process.env.VALIDATOR_ADDRESS)

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(process.env.ETH_NODE_ADDRESS)
  const account = web3.eth.accounts.privateKeyToAccount(seller.privateKey)
  web3.eth.accounts.wallet.create(0).add(account)
  const cf = CloneFactory(web3, process.env.CLONE_FACTORY_ADDRESS)

  const contractList = buildContractsList(
    process.env.BUILD_FULL_MARKETPLACE === "true"
  );

  for (const c of contractList) {
    const { address, txHash } = await CreateContract(c.price, c.length, c.speed, cf, seller, console.log)
    console.log(`contract created, address: ${address} tx hash: ${txHash}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
