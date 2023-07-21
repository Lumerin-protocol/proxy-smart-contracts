//@ts-check
require("dotenv").config();
const fs = require("fs");
const { UpdateCloneFactory } = require("../lib/deploy");

async function main() {
  console.log("CloneFactory update script")
  console.log()

  const privateKey = process.env.CONTRACTS_OWNER_PRIVATE_KEY
  const cloneFactoryAddr = process.env.CLONE_FACTORY_ADDRESS

  await UpdateCloneFactory("CloneFactory", cloneFactoryAddr, privateKey, console.log)
  fs.writeFileSync("clonefactory-addr.tmp", cloneFactoryAddr);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });