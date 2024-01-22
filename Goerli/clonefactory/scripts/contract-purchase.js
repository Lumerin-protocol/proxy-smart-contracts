//@ts-check
require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
/**
 * @type {import("hardhat/types/runtime").HardhatRuntimeEnvironment}
 */
const { ethers } = require("hardhat");
const { encrypt } = require('ecies-geth')
const { add65BytesPrefix, trimRight64Bytes } = require("../lib/utils");

async function main() {
  let contractAddress = process.env.CONTRACT_ADDRESS || "";
  let validatorURL = process.env.VALIDATOR_URL || "";
  let destURL = process.env.DEST_URL || "";
  let lumerinAddress = process.env.LUMERIN_ADDRESS || "";
  let cloneFactoryAddress = process.env.CLONE_FACTORY_ADDRESS || "";
  let validatorPrivateKey = process.env.VALIDATOR_PRIVATE_KEY || "";

  if (cloneFactoryAddress === "") {
    cloneFactoryAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"
  }
  if (lumerinAddress === "") {
    lumerinAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
  }
  if (validatorURL === "") {
    throw new Error('VALIDATOR_URL env variable is required')
  }
  if (destURL === "") {
    throw new Error('DEST_URL env variable is required')
  }
  if (contractAddress === "") {
    throw new Error('CONTRACT_ADDRESS env variable is required')
  }
  if (validatorPrivateKey === "") {
    throw new Error('VALIDATOR_PRIVATE_KEY env variable is required')
  }

  console.log(`Sending lumerin`)
  console.log(`Using Lumerin address: ${lumerinAddress}`);
  const lumerin = await ethers.getContractAt("Lumerin", lumerinAddress);
  const [seller, buyer] = await ethers.getSigners();
  const sendLumerin = await lumerin.connect(seller).transfer(buyer.address, 1000 * 10 ** 8)
  await sendLumerin.wait();
  console.log(`Sent lumerin to ${buyer.address}`)

  // authorize
  console.log(`Authorizing clone factory to spend lumerin`)
  const authorize = await lumerin.connect(buyer).approve(cloneFactoryAddress, 1000 * 10 ** 8)
  await authorize.wait();
  console.log('authorized')

  console.log(`Purchasing contract: ${contractAddress}`);
  console.log(`Using buyer address: ${buyer.address}`);
  console.log("\n");

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = CloneFactory.attach(cloneFactoryAddress);
  console.log("Using account:", buyer.address);
  console.log("Account balance:", (await buyer.getBalance()).toString());
  console.log(`CLONEFACTORY address: ${cloneFactoryAddress}`);
  console.log("Account owner", await cloneFactory.owner())
  console.log("\n");

  const fee = await cloneFactory.marketplaceFee();
  console.log(`marketplace fee: ${fee} wei`);

  const Implementation = await ethers.getContractFactory("Implementation");
  const implementation = Implementation.attach(contractAddress);
  const pubKey = await implementation.pubKey()

  const encryptedValidatorURL = await encrypt(
    Buffer.from(add65BytesPrefix(pubKey), 'hex'),
    Buffer.from(validatorURL)
  )

  const validator = new ethers.Wallet(validatorPrivateKey)
  const pubKey2 = add65BytesPrefix(trimRight64Bytes(validator.publicKey))

  const encryptedDestURL = await encrypt(
    Buffer.from(pubKey2, 'hex'),
    Buffer.from(destURL)
  )

  const purchase = await cloneFactory
    .connect(buyer)
    .setPurchaseRentalContractV2(contractAddress, validator.address, encryptedValidatorURL.toString('hex'), encryptedDestURL.toString('hex'), 0, { value: fee.toString() })
  const receipt = await purchase.wait();

  console.log(receipt)

  console.log(`Purchased: ${contractAddress}, gas used ${receipt.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
