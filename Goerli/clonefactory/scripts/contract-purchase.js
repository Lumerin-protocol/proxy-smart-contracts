//@ts-check
require("dotenv").config();
/**
 * @type {import("@nomiclabs/hardhat-ethers")}
 */
const { ethers } = require("hardhat");
const { encrypt } = require('ecies-geth')
const { add65BytesPrefix } = require("../lib/utils");

async function main() {
  let contractAddress = process.env.CONTRACT_ADDRESS || "";
  let dest = process.env.DESTINATION || "";
  let lumerinAddress = process.env.LUMERIN_ADDRESS || "";
  let cloneFactoryAddress = process.env.CLONE_FACTORY_ADDRESS || "";

  if (cloneFactoryAddress === "") {
    cloneFactoryAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"
  }

  if (contractAddress === "") {
    const CloneFactory = await ethers.getContractFactory("CloneFactory");
    const cloneFactory = CloneFactory.attach(cloneFactoryAddress);
    [contractAddress] = await cloneFactory.getContractList()
    console.log('contract address', contractAddress)
  }
  if (dest === "") {
    dest = "random string"
  }
  if (lumerinAddress === "") {
    lumerinAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
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
  console.log("Account owner", await cloneFactory.owner())
  console.log(`CLONEFACTORY address: ${cloneFactoryAddress}`);
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

  console.log(await implementation.getPublicVariables())

  const purchase = await cloneFactory
    .connect(buyer)
    .setPurchaseRentalContract(contractAddress, encryptedDest.toString('hex'), "0", { value: fee.toString() })
  const receipt = await purchase.wait();

  console.log(`Purchased: ${contractAddress}, gas used ${receipt.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
