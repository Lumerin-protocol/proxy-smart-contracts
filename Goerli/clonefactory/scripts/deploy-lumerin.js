//@ts-check
require("dotenv").config();
const fs = require("fs");
const { DeployLumerin } = require("../lib/deploy");

async function main() {
  console.log("Lumerin deployment script")
  const privateKey = process.env.CONTRACTS_OWNER_PRIVATE_KEY

  const {address} = await DeployLumerin(privateKey, console.log);

  console.log("SUCCESS")
  console.log("LUMERIN address:", address);
  fs.writeFileSync("lumerin-addr.tmp", String(address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
