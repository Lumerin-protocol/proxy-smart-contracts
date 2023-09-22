//@ts-check
const { upgrades, ethers } = require("hardhat");
const { Wallet } = require("ethers");
const { remove0xPrefix, trimRight64Bytes } = require("./utils");

const GAS_LIMIT = 5_000_000;

/**
 * @param {string} deployerPkey 
 * @param {(...arg)=>void} log 
 * @returns {Promise<{address: string}>}
 */
async function DeployLumerin(deployerPkey, log = noop) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  log("Deploying LUMERIN with the account:", deployer.address);
  log("Account balance:", (await deployer.getBalance()).toString());

  const Lumerin = await ethers.getContractFactory("Lumerin", deployer);
  const lumerin = await Lumerin.deploy();
  await lumerin.deployed();
  await ethers.provider.getTransactionReceipt(lumerin.deployTransaction.hash);

  log("LUMERIN address:", lumerin.address);
  return { address: lumerin.address };
}

/**
 * @param {string} lumerinAddr 
 * @param {string} deployerPkey
 * @param {string} feeRecipientAddress 
 * @param {(...arg)=>void} log 
 * @returns {Promise<{address: string}>}
 */
async function DeployCloneFactory(lumerinAddr, deployerPkey, feeRecipientAddress, log = noop) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  log("Deployer address:", deployer.address);
  log("Deployer balance:", (await deployer.getBalance()).toString());
  log("LUMERIN address:", lumerinAddr);
  log()

  log("1. Deploying upgradeable base IMPLEMENTATION")
  const Implementation = await ethers.getContractFactory("Implementation", deployer);
  const implementation = await upgrades.deployBeacon(Implementation, { unsafeAllow: ['constructor'] });
  await implementation.deployed();
  log("Beacon deployed at address:", implementation.address);

  const beaconProxy = await upgrades.deployBeaconProxy(implementation.address, Implementation, [], {
    unsafeAllow: ['constructor'],
    initializer: false,
  });
  await beaconProxy.deployed();
  log("Beacon proxy deployed at address", beaconProxy.address);
  log()

  log("2. Deploying upgradeable CLONEFACTORY")
  const CloneFactory = await ethers.getContractFactory("CloneFactory", deployer);
  const cloneFactory = await upgrades.deployProxy(
    CloneFactory,
    [implementation.address, process.env.LUMERIN_TOKEN_ADDRESS, feeRecipientAddress],
    { unsafeAllow: ['constructor'] }
  );
  await cloneFactory.deployed();

  log("Success. CLONEFACTORY address:", cloneFactory.address);
  return { address: cloneFactory.address };
}

/**
 * @param {string} newCloneFactoryContractName 
 * @param {string} cloneFactoryAddr 
 * @param {string} deployerPkey 
 * @param {(...args)=>void} log 
 * @returns {Promise<void>}
 */
async function UpdateCloneFactory(newCloneFactoryContractName, cloneFactoryAddr, deployerPkey, log = noop) {
  log("CloneFactory update script")
  log()

  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  log("Deployer address:", deployer.address);
  log("Deployer balance:", (await deployer.getBalance()).toString());
  log("CLONEFACTORY address:", cloneFactoryAddr);
  log()

  const currentCloneFactoryImpl = await upgrades.erc1967.getImplementationAddress(cloneFactoryAddr)
  log("Current CLONEFACTORY implementation:", currentCloneFactoryImpl);

  const CloneFactory = await ethers.getContractFactory(newCloneFactoryContractName, deployer);
  // await upgrades.forceImport(cloneFactoryAddr, CloneFactory)
  const cloneFactory = await upgrades.upgradeProxy(cloneFactoryAddr, CloneFactory, { unsafeAllow: ['constructor'] });
  await cloneFactory.deployed();

  const receipt = await ethers.provider.getTransactionReceipt(cloneFactory.deployTransaction.hash);
  const newCloneFactoryImpl = await upgrades.erc1967.getImplementationAddress(cloneFactoryAddr)
  log("New CLONEFACTORY implementation:", newCloneFactoryImpl, " gas used: ", receipt.gasUsed);
  log()

  if (currentCloneFactoryImpl == newCloneFactoryImpl) {
    log("Warning: CLONEFACTORY implementation didn't change, cause it's likely the same implementation");
  } else {
    log("CLONEFACTORY implementation updated")
  }
}

/**
 * @param {string} newImplementationContractName 
 * @param {string} cloneFactoryAddr 
 * @param {string} deployerPkey 
 * @param {(...args)=>void} log
 * @returns {Promise<void>}
 */
async function UpdateImplementation(newImplementationContractName, cloneFactoryAddr, deployerPkey, log = noop) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  log("Updating IMPLEMENTATION contract");
  log();
  log("Clonefactory address", cloneFactoryAddr)
  log("Deployer account:", deployer.address);
  log("Account balance:", (await deployer.getBalance()).toString());
  log();

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const Implementation = await ethers.getContractFactory(newImplementationContractName, deployer);

  const baseImplementationAddr = await CloneFactory.attach(cloneFactoryAddr).baseImplementation();
  log("Updating base implementation contract:", baseImplementationAddr);

  await upgrades.forceImport(baseImplementationAddr, Implementation)

  const oldLogicAddr = await upgrades.beacon.getImplementationAddress(baseImplementationAddr);
  log("Old beacon proxy logic:", oldLogicAddr)
  log();

  const newImplementation = await upgrades.upgradeBeacon(baseImplementationAddr, Implementation, { unsafeAllow: ['constructor'] });
  const newLogicAddr = await upgrades.beacon.getImplementationAddress(newImplementation.address);
  log("New beacon proxy logic:", newLogicAddr)

  if (oldLogicAddr == newLogicAddr) {
    log("Warning. Implementation proxy logic didn't change, cause it's likely the same implementation.");
  } else {
    log("Implementation proxy logic changed.")
    log("New proxy logic address:", newLogicAddr)
  }
  log();

  log("SUCCESS. Base implementation contract updated.");
}

/**
 * @param {string} sellerAddr
 * @param {import("../build-js/dist").CloneFactoryContext} cloneFactory 
 * @param {string} from from address 
 * @param {(...arg)=>void} log
 * @returns {Promise<void>} 
 */
async function ApproveSeller(sellerAddr, cloneFactory, from, log = noop) {
  log(`Approving seller ${sellerAddr}`)
  const tx = await cloneFactory.methods.setAddToWhitelist(sellerAddr).send({ from, gas: GAS_LIMIT });
  log("Seller approved");
}

/**
 * @param {string} priceDecimalLMR 
 * @param {string} durationSeconds 
 * @param {string} hrGHS 
 * @param {import("../build-js/dist").CloneFactoryContext} cloneFactory
 * @param {Wallet} fromWallet 
 * @param {string} marketplaceFee
 * @param {(...args)=>void} log
 * @returns {Promise<{address: string, txHash: string}>}
 */
async function CreateContract(priceDecimalLMR, durationSeconds, hrGHS, cloneFactory, fromWallet, marketplaceFee, log = noop) {
  const pubKey = trimRight64Bytes(remove0xPrefix(fromWallet.publicKey));
  const receipt = await cloneFactory.methods
    .setCreateNewRentalContract(priceDecimalLMR, "0", hrGHS, durationSeconds, fromWallet.address, pubKey)
    .send({ from: fromWallet.address, gas: GAS_LIMIT, value: marketplaceFee });
  const address = receipt.events?.[0].address || "";
  const txHash = receipt.transactionHash;

  log("Created contract at address", address);

  return { address, txHash };
}

function noop(...args) { }

module.exports = {
  DeployLumerin,
  DeployCloneFactory,
  UpdateCloneFactory,
  UpdateImplementation,
  CreateContract,
  ApproveSeller,
}
