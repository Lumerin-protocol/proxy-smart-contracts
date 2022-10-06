async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = await CloneFactory.getDeployTransaction(
	  "0x84E00a18a36dFa31560aC216da1A9bef2164647D", 
	  "0x9FC7b6608c2d00f0AceDa7D6BEea610FC24a58Ff"
  );

	const estimatedGas = await ethers.provider.estimateGas({data: cloneFactory.data})

  console.log("deployment cost:", estimatedGas);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

