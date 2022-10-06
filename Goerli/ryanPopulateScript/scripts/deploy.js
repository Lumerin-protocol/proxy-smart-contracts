async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = await CloneFactory.deploy(
	  "0x04fa90c64DAeEe83B22501c790D39B8B9f53878a", 
	  "0x8F9B59157ea23ddF7528529f614FF09A1884187F"
  );

  console.log("Token address:", cloneFactory.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

