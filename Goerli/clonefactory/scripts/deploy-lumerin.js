require("dotenv").config();
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Lumerin = await ethers.getContractFactory("Lumerin");
  const lumerin = await Lumerin.deploy();
  await lumerin.deployed();

  console.log("Lumerin address:", lumerin.address);
  fs.writeFileSync("lumerin-addr.tmp", String(lumerin.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
