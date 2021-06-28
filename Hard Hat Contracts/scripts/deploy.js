async function main() {

  const [deployer] = await ethers.getSigners();

  console.log(
    "Token deploying using:",
    deployer.address
  );
  
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const TheToken = await ethers.getContractFactory("TitanToken");
  const token = await TheToken.deploy();

  console.log("Token address:", token.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
