require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  let contractAddress = process.env.CONTRACT_ADDRESS || "";
  let cloneFactoryAddress = process.env.CLONE_FACTORY_ADDRESS || "";
  let fee = ""

  if (cloneFactoryAddress === "") {
    throw new Error("clonefactory address not set")
  }

  if (contractAddress === "") {
    throw new Error("contract address not set")
  }

  const [, buyer] = await ethers.getSigners();
  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = CloneFactory.attach(cloneFactoryAddress);

  console.log('contract address', contractAddress)
  fee = await cloneFactory.marketplaceFee();
  console.log(`marketplace fee: ${fee} wei`);


  console.log(`Closing contract: ${contractAddress}`);
  console.log(`Using buyer address: ${buyer.address}`);
  console.log("\n");

  console.log("Using account:", buyer.address);
  console.log("Account balance:", (await buyer.getBalance()).toString());
  console.log("\n");

  const closeout = await cloneFactory
    .setContractCloseout(contractAddress, 0, { value: fee })
  const receipt = await closeout.wait();


  console.log(JSON.stringify({ transaction: closeout, receipt }))

  console.log(`Closed: ${contractAddress}, gas used ${receipt.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
