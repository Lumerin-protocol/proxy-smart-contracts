//@ts-check
require("dotenv").config();
/**
 * @type {import("hardhat/types/runtime").HardhatRuntimeEnvironment}
 */
const { ethers } = require("hardhat");
const { encrypt } = require('ecies-geth')
const { add65BytesPrefix } = require("../lib/utils");

async function main() {
  let contractAddress = process.env.CONTRACT_ADDRESS || "";
  let dest = process.env.DESTINATION || "";
  let lumerinAddress = process.env.LUMERIN_ADDRESS || "";
  let cloneFactoryAddress = process.env.CLONE_FACTORY_ADDRESS || "";
  let poolDestination = process.env.POOL_DESTINATION || "";

  if (cloneFactoryAddress === "") {
    cloneFactoryAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"
  }
  if (lumerinAddress === "") {
    lumerinAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
  }
  if (dest === "") {
    throw new Error('DESTINATION env variable is required')
  }
  if (contractAddress === "") {
    throw new Error('CONTRACT_ADDRESS env variable is required')
  }
  if (poolDestination === "") {
    throw new Error('POOL_DESTINATION env variable is required')
  }

  console.log(`Sending lumerin`)
  console.log(`Using Lumerin address: ${lumerinAddress}`);
  const lumerin = await ethers.getContractAt("Lumerin", lumerinAddress);
  const [seller, buyer, validator] = await ethers.getSigners();
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
  const encryptedDest = await encrypt(
    Buffer.from(add65BytesPrefix(pubKey), 'hex'),
    Buffer.from(dest)
  )

  const validatorWallet = new ethers.Wallet('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');
  const encryptedPoolDest = await encrypt(
    Buffer.from(validatorWallet.publicKey.slice(2), 'hex'),
    Buffer.from(poolDestination)
  )

  const purchase = await cloneFactory
    .connect(buyer)
    .setPurchaseRentalContractV2(contractAddress, validator.address, encryptedDest.toString('hex'), encryptedPoolDest.toString('hex'), 0, { value: fee.toString() })
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
