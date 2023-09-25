require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  let contractAddress = ""; //process.env.CONTRACT_ADDRESS || "";
  let cloneFactoryAddress = "";// process.env.CLONE_FACTORY_ADDRESS || "";

  if (cloneFactoryAddress === ""){
    cloneFactoryAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"
  }

  const [seller, buyer] = await ethers.getSigners();


  if (contractAddress === ""){
    const CloneFactory = await ethers.getContractFactory("CloneFactory");
    const cloneFactory = CloneFactory.attach(cloneFactoryAddress);  
    [contractAddress] = await cloneFactory.getContractList()
    console.log('contract address', contractAddress)
  }


  console.log(`Closing contract: ${contractAddress}`);
  console.log(`Using buyer address: ${buyer.address}`);
  console.log("\n");
  
  const Implementation = await ethers.getContractFactory("Implementation");
  const cloneFactory = Implementation.attach(contractAddress);
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
