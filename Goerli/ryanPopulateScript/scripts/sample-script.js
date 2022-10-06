// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const Lumerin = await hre.ethers.getContractFactory("Lumerin");
  const lumerin = await Lumerin.deploy();

  await lumerin.deployed();

  console.log("Lumerin deployed to:", lumerin.address);


	const CloneFactory = await hre.ethers.getContractFactory("CloneFactory");
	const cloneFactory = await CloneFactory.deploy(lumerin.address, lumerin.address, lumerin.address);

	await cloneFactory.deployed()
  console.log("clonefactory deployed to:", cloneFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
