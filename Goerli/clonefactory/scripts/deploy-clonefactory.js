//@ts-check
require("dotenv").config();
const fs = require("fs");
const { DeployCloneFactory } = require("../lib/deploy");

async function main() {
  console.log("CloneFactory deployment script")
  console.log()

  const privateKey = process.env.CONTRACTS_OWNER_PRIVATE_KEY;
  const lumerinAddr = process.env.LUMERIN_TOKEN_ADDRESS;
  const {address} = await DeployCloneFactory(lumerinAddr, privateKey, console.log);
  
  console.log("SUCCESS")
  console.log("CLONEFACTORY address:", address);

  fs.writeFileSync("clonefactory-addr.tmp", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
