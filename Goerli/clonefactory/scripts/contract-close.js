require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || "";
  const cloneFactoryAddress = process.env.CLONE_FACTORY_ADDRESS || "";
  
  const [seller, buyer] = await ethers.getSigners();

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = CloneFactory.attach(cloneFactoryAddress);

  console.log(`Closing contract: ${contractAddress}`);
  console.log(`Using buyer address: ${buyer.address}`);
  console.log("\n");

  console.log("Using account:", buyer.address);
  console.log("Account balance:", (await buyer.getBalance()).toString());
  console.log("\n");

  const fee = await cloneFactory.marketplaceFee();
  console.log(`marketplace fee: ${fee} wei`);

  const closeout = await cloneFactory
    .connect(buyer)
    .setContractCloseOut(0, {value: fee})
  const receipt = await closeout.wait();

  console.log(receipt)

  console.log(`Closed: ${contractAddress}, gas used ${receipt.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
