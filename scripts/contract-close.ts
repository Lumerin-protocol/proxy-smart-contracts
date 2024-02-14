import { ethers } from "hardhat";
import { requireEnvsSet } from "../lib/utils";

async function main() {
  const envs = requireEnvsSet("CONTRACT_ADDRESS", "CLONE_FACTORY_ADDRESS")
  
  console.log(`Closing contract: ${envs.CONTRACT_ADDRESS}`);
  
  const [_, buyer] = await ethers.getSigners();
  console.log("Using account:", buyer.address);
  console.log("Account balance:", (await buyer.getBalance()).toString());
  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = CloneFactory.attach(envs.CLONE_FACTORY_ADDRESS);
  const fee = await cloneFactory.marketplaceFee();
  console.log(`Marketplace fee: ${fee} wei`);
  
  console.log("\n");

  const Implementation = await ethers.getContractFactory("Implementation");
  const impl = Implementation.attach(envs.CONTRACT_ADDRESS);
  const closeout = await impl.connect(buyer).setContractCloseOut(0, { value: fee })
  const receipt = await closeout.wait();

  console.log(`Closed: ${envs.CONTRACT_ADDRESS}, gas used ${receipt.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
