//@ts-check
require("dotenv").config();
const { network, ethers } = require("hardhat");
const Web3 = require("web3");
const { Wallet } = require("ethers");
const { CloneFactory } = require("../build-js/dist");
const { CreateContract } = require("../lib/deploy");
const { buildContractsList } = require("../lib/populate-contracts");

const main = async function () {
  const cloneFactoryAddress = process.env.CLONE_FACTORY_ADDRESS;
  const sellerPrivateKey = process.env.SELLER_PRIVATEKEY;

  if (!cloneFactoryAddress) throw new Error("CLONE_FACTORY_ADDRESS is not set");
  if (!sellerPrivateKey) throw new Error("SELLER_PRIVATEKEY is not set");

  const seller = new Wallet(sellerPrivateKey).connect(ethers.provider)

  console.log("Deploying contracts with the seller account:", seller.address);
  console.log("Account balance:", (await seller.getBalance()).toString());
  console.log("CLONEFACTORY address:", cloneFactoryAddress);

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(network.config.url)
  const account = web3.eth.accounts.privateKeyToAccount(seller.privateKey)
  web3.eth.accounts.wallet.create(0).add(account)
  const cf = CloneFactory(web3, cloneFactoryAddress)

  const contractList = buildContractsList(
    process.env.BUILD_FULL_MARKETPLACE === "true"
  );

  const fee = await cf.methods.marketplaceFee().call()
  console.log(`marketplace fee: ${fee} wei`);

  for (const c of contractList) {
    const { address, txHash } = await CreateContract(c.price, c.length, c.speed, cf, seller, fee, console.log)
    console.log(`contract created, address: ${address} tx hash: ${txHash}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
