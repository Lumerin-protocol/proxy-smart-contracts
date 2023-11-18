//@ts-check
const { Wallet } = require("ethers");
const { upgrades, ethers } = require("hardhat");
const { Lumerin, Implementation, CloneFactory } = require("../build-js/dist");
const { remove0xPrefix, trimRight64Bytes } = require("./utils");

const GAS_LIMIT = 5_000_000;
/**
 * @param {Object} web3
 * @param {string} cloneFactoryAddr
 * @param {string} deployerPkey
 * @param {(...args)=>void} log
 * @returns {Promise<any>}
 */
async function UpdateCloneFactoryFeeRecipient(
  web3,
  cloneFactoryAddr,
  deployerPkey,
  feeRecipientAdd,
  log = noop
) {
  log("CloneFactory update script");
  log();

  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  log("Deployer address:", deployer.address);
  log("Deployer balance:", (await deployer.getBalance()).toString());
  log("CLONEFACTORY address:", cloneFactoryAddr);
  log();

  const currentCloneFactoryImpl =
    await upgrades.erc1967.getImplementationAddress(cloneFactoryAddr);
  log("Current CLONEFACTORY implementation:", currentCloneFactoryImpl);

  const cloneFactory = CloneFactory(web3, currentCloneFactoryImpl);

  return await cloneFactory.methods
    .setMarketplaceFeeRecipient("200000000000000", feeRecipientAdd)
    .send({ from: deployer.address, gas: GAS_LIMIT });
  // // await upgrades.forceImport(cloneFactoryAddr, CloneFactory)
  // const cloneFactory = await upgrades.upgradeProxy(cloneFactoryAddr, CloneFactory, { unsafeAllow: ['constructor'] });
  // await cloneFactory.deployed();

  // const receipt = await ethers.provider.getTransactionReceipt(cloneFactory.deployTransaction.hash);
  // const newCloneFactoryImpl = await upgrades.erc1967.getImplementationAddress(cloneFactoryAddr)
  // log("New CLONEFACTORY implementation:", newCloneFactoryImpl, " gas used: ", receipt.gasUsed);
  // log()

  // if (currentCloneFactoryImpl == newCloneFactoryImpl) {
  //   log("Warning: CLONEFACTORY implementation didn't change, cause it's likely the same implementation");
  // } else {
  //   log("CLONEFACTORY implementation updated")
  // }
}

module.exports = {
  UpdateCloneFactoryFeeRecipient,
};
