require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\nDeploying CLONEFACTORY with the account:", deployer.address);
  console.log("LUMERIN address:", process.env.LUMERIN_TOKEN_ADDRESS);
  console.log("VALIDATOR address:", process.env.VALIDATOR_ADDRESS);

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = await CloneFactory.deploy(
    process.env.LUMERIN_TOKEN_ADDRESS,
    process.env.VALIDATOR_ADDRESS
  );
  await cloneFactory.deployed();

  console.log("CLONEFACTORY address:", cloneFactory.address);
  fs.writeFileSync("clonefactory-addr.tmp", String(cloneFactory.address));

  console.log("Deploying IMPLEMENTATION with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Implementation = await ethers.getContractFactory("Implementation");
  const implementation = await Implementation.deploy();
  await implementation.deployed();

  console.log("IMPLEMENTATION address:", implementation.address);

  const setBaseImplementation = await cloneFactory.setBaseImplementation(
    implementation.address
  );
  await setBaseImplementation.wait();

  let initialize = await implementation.initialize(
    10**8,
    1,
    1,
    1 * 60 * 60,
    process.env.TEST_SELLER_ADDRESS,
    process.env.LUMERIN_TOKEN_ADDRESS,
    cloneFactory.address,
    process.env.VALIDATOR_ADDRESS,
    ""
  );

  await initialize.wait();

  console.log("IMPLEMENTATION price:", await implementation.price());
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
