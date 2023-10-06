//@ts-check
require("dotenv").config();
const { network, ethers } = require("hardhat");
const Web3 = require("web3");
const { Wallet } = require("ethers");
const { CloneFactory, Implementation } = require("../build-js/dist");
const { CreateContract } = require("../lib/deploy");
const { buildContractsList } = require("../lib/populate-contracts");

const main = async function () {


  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(network.config.url)
  const cf = CloneFactory(web3, process.env.CLONE_FACTORY_ADDRESS)

  const contracts = await cf.methods.getContractList().call()


  for (const c of contracts) {
    const impl = Implementation(web3, c)
    console.log(c)
    const terms = await impl.methods.getPublicVariables().call()
    console.log(terms);
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
