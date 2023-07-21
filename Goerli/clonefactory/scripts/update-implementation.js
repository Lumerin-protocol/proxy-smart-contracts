//@ts-check
require("dotenv").config();
const { UpdateImplementation } = require("../lib/deploy");

async function main() {
  const privateKey = process.env.CONTRACTS_OWNER_PRIVATE_KEY
  const cloneFactoryAddr = process.env.CLONE_FACTORY_ADDRESS
  
  await UpdateImplementation("Implementation", cloneFactoryAddr, privateKey, console.log)

  console.log("SUCCESS. Script finished.");
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });