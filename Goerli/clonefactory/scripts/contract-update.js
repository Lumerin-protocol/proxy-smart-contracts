//@ts-check
require("dotenv").config();
/**
 * @type {import("hardhat/types/runtime").HardhatRuntimeEnvironment}
 */
const { ethers } = require("hardhat");


async function main() {
  let contractAddress = process.env.CONTRACT_ADDRESS || "";
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

  const [seller, buyer] = await ethers.getSigners();

  console.log(`Upgrading contract: ${contractAddress}`);
  console.log(`Using seller address: ${seller.address}`);
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


  const purchase = await cloneFactory
    .connect(seller)
    .setUpdateContractInformation(contractAddress, 222222222222, 0, 12321231, 3600, { value: fee })
  const receipt = await purchase.wait();

  console.log(receipt)

  console.log(`Upgraded: ${contractAddress}, gas used ${receipt.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
