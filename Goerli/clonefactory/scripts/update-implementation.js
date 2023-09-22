//@ts-check
require("dotenv").config();
const { UpdateImplementation } = require("../lib/deploy");

async function main() {
  const privateKey = process.env.OWNER_PRIVATEKEY
  const cloneFactoryAddr = process.env.CLONE_FACTORY_ADDRESS

  if (!privateKey) throw new Error("OWNER_PRIVATEKEY is not set")
  if (!cloneFactoryAddr) throw new Error("CLONE_FACTORY_ADDRESS is not set")

  await UpdateImplementation("Implementation", cloneFactoryAddr, privateKey, console.log)

  console.log("SUCCESS. Script finished.");
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });