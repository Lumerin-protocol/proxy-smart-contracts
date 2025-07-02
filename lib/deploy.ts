import { remove0xPrefix, trimRight64Bytes, noop } from "./utils";
import { ethers, upgrades } from "hardhat";

const Wallet = ethers.Wallet;

export async function DeployLumerin(deployerPkey: string, log = noop) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  log("Deploying LUMERIN with the account:", deployer.address);
  log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const Lumerin = await ethers.getContractFactory("Lumerin", deployer);
  const lumerin = await Lumerin.deploy();
  await lumerin.deployed();

  log("Success. LUMERIN address:", lumerin.address);
  return { address: lumerin.address };
}

export async function DeployUSDCMock(deployerPkey: string, log = noop) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  const USDCMock = await ethers.getContractFactory("USDCMock", deployer);
  const usdcMock = await USDCMock.deploy();
  await usdcMock.deployed();

  log("Success. USDC Mock address:", usdcMock.address);
  return { address: usdcMock.address };
}

export async function DeployBTCPriceOracleMock(deployerPkey: string, log = noop) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  const BTCPriceOracleMock = await ethers.getContractFactory("BTCPriceOracleMock", deployer);
  const btcPriceOracleMock = await BTCPriceOracleMock.deploy([]);
  await btcPriceOracleMock.deployed();

  log("Success. BTC Price Oracle address:", btcPriceOracleMock.address);
  return { address: btcPriceOracleMock.address };
}

export async function DeployHashrateOracle(deployerPkey: string, log = noop) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  const HashrateOracle = await ethers.getContractFactory("HashrateOracle", deployer);
  const hashrateOracle = await HashrateOracle.deploy([]);
  await hashrateOracle.deployed();

  log("Success. Hashrate Oracle address:", hashrateOracle.address);
  return { address: hashrateOracle.address };
}

export async function DeployCloneFactory(
  deployerPkey: string,
  oracleAddr: string,
  paymentTokenAddr: string,
  feeTokenAddr: string,
  validatorFee: number,
  log = noop
) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  log("Deployer address:", deployer.address);
  log("Deployer balance:", (await ethers.provider.getBalance(deployer.address)).toString());
  log("Payment token address:", paymentTokenAddr);
  log();

  log("1. Deploying upgradeable base IMPLEMENTATION");
  const Implementation = await ethers.getContractFactory("Implementation", deployer);
  const impl = await upgrades.deployBeacon(Implementation, { unsafeAllow: ["constructor"] });
  await impl.deployed();
  log("Beacon deployed at address:", impl.address);

  log("2. Deploying upgradeable CLONEFACTORY");
  const CloneFactory = await ethers.getContractFactory("CloneFactory", deployer);
  const cloneFactory = await upgrades.deployProxy(
    CloneFactory,
    [impl.address, oracleAddr, paymentTokenAddr, feeTokenAddr, Math.round(validatorFee * 10 ** 18)],
    { unsafeAllow: ["constructor"] }
  );
  await cloneFactory.deployed();

  log("Success. CLONEFACTORY address:", cloneFactory.address);

  return { address: cloneFactory.address };
}

export async function UpdateCloneFactory(
  newCloneFactoryContractName: string,
  cloneFactoryAddr: string,
  deployerPkey: string,
  log = noop
) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  log("Deployer address:", deployer.address);
  log("Deployer balance:", (await deployer.getBalance()).toString());
  log("CLONEFACTORY address:", cloneFactoryAddr);
  log();

  const currentCloneFactoryImpl = await upgrades.erc1967.getImplementationAddress(cloneFactoryAddr);
  log("Current CLONEFACTORY implementation:", currentCloneFactoryImpl);

  const CloneFactory = await ethers.getContractFactory(newCloneFactoryContractName);
  const cloneFactory = await upgrades.upgradeProxy(cloneFactoryAddr, CloneFactory, {
    unsafeAllow: ["constructor"],
  });
  await cloneFactory.deployed();

  const receipt = await ethers.provider.getTransactionReceipt(cloneFactory.deployTransaction.hash);
  const newCloneFactoryImpl = await upgrades.erc1967.getImplementationAddress(cloneFactoryAddr);
  log("New CLONEFACTORY implementation:", newCloneFactoryImpl, " gas used: ", receipt.gasUsed);
  log();

  if (currentCloneFactoryImpl === newCloneFactoryImpl) {
    log(
      "Warning: CLONEFACTORY implementation didn't change, cause it's likely the same implementation"
    );
  } else {
    log("CLONEFACTORY implementation updated");
  }

  return { logicAddress: newCloneFactoryImpl };
}

export async function UpdateImplementation(
  newImplementationContractName: string,
  cloneFactoryAddr: string,
  deployerPkey: string,
  log = noop
) {
  const deployer = new Wallet(deployerPkey).connect(ethers.provider);

  log("Updating IMPLEMENTATION contract");
  log();
  log("Clonefactory address", cloneFactoryAddr);
  log("Deployer account:", deployer.address);
  log("Account balance:", (await deployer.getBalance()).toString());
  log();

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const Implementation = await ethers.getContractFactory(newImplementationContractName, deployer);

  const baseImplementationAddr = await CloneFactory.attach(cloneFactoryAddr).baseImplementation();
  log("Updating base implementation contract:", baseImplementationAddr);

  const oldLogicAddr = await upgrades.beacon.getImplementationAddress(baseImplementationAddr);
  log("Old beacon proxy logic:", oldLogicAddr);
  log();

  // IMPORTANT: remove unsafeSkipStorageCheck and struct-definition for future upgrades
  const newImplementation = await upgrades.upgradeBeacon(baseImplementationAddr, Implementation, {
    unsafeAllow: ["constructor"],
    unsafeSkipStorageCheck: true,
  });
  const newLogicAddr = await upgrades.beacon.getImplementationAddress(newImplementation.address);
  log("New beacon proxy logic:", newLogicAddr);

  if (oldLogicAddr === newLogicAddr) {
    log(
      "Warning. Implementation proxy logic address didn't change, because it may be the same implementation. Please test manually."
    );
  } else {
    log("Implementation proxy logic changed.");
    log("New proxy logic address:", newLogicAddr);
  }
  log();

  log("SUCCESS. Base implementation contract updated.");
  return { logicAddress: newLogicAddr };
}

export async function ApproveSeller(
  sellerAddr: string,
  cloneFactory: any,
  from: string,
  log = noop
) {
  log(`Approving seller ${sellerAddr}`);
  await cloneFactory.methods.setAddToWhitelist(sellerAddr).send({ from, gas: 1000000 });
  log("Seller approved");
}

export async function CreateContract(
  priceDecimalLMR: string,
  durationSeconds: string,
  hrGHS: string,
  cloneFactory: any,
  fromWallet: InstanceType<typeof Wallet>,
  marketplaceFee: string,
  log = noop
) {
  const pubKey = trimRight64Bytes(remove0xPrefix(fromWallet.publicKey));
  const gas = await cloneFactory.methods
    .setCreateNewRentalContractV2(
      priceDecimalLMR,
      "0",
      hrGHS,
      durationSeconds,
      "0",
      fromWallet.address,
      pubKey
    )
    .estimateGas({ from: fromWallet.address, value: marketplaceFee });
  const receipt = await cloneFactory.methods
    .setCreateNewRentalContractV2(
      priceDecimalLMR,
      "0",
      hrGHS,
      durationSeconds,
      "0",
      fromWallet.address,
      pubKey
    )
    .send({ from: fromWallet.address, value: marketplaceFee, gas });

  const address = receipt.events.contractCreated.returnValues._address;
  const txHash = receipt.transactionHash;

  log("Created contract at address", address);

  return { address, txHash };
}

// DEPLOY LUMERIN VIEM API EXAMPLE
//
// import hardhat from "hardhat";
// import viem, { Hex, http, isHex } from "viem";
// import { privateKeyToAccount } from 'viem/accounts'
// import { innerDeployContract } from "@nomicfoundation/hardhat-viem/src/internal/contracts";
//
// async function DeployLumerinr(deployerPkey: string, transport = viem.custom(hardhat.network.provider), artifacts = hardhat.artifacts.readArtifactSync("Lumerin"), log:Log = noop) {
//   const client = viem.createWalletClient({
//     account: privateKeyToAccount(enforceHex(deployerPkey)),
//     transport,
//   });

//   const publicClient = viem.createPublicClient({
//     transport,
//   });

//   log("Deploying LUMERIN with the account:", client.account.address);
//   log("Account balance:", (await publicClient.getBalance({address: client.account.address})).toString());

//   const lumerin = await innerDeployContract(publicClient as any, client as any, artifacts.abi, artifacts.bytecode, [], {confirmations: 1 })

//   log("LUMERIN address:", lumerin.address);
//   return { address: lumerin.address };
// }
//
// function enforceHex(value: string): Hex {
//   if (!value.startsWith("0x")) {
//     value = "0x" + value;
//   }
//   if (isHex(value, { strict: true })) {
//     return value;
//   }
//   throw new Error(`Invalid hex value: ${value}`);
// }
//
// END EXPAMPLE
