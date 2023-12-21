//@ts-check
require("dotenv").config();
const fs = require("fs");
const { UpdateCloneFactory } = require("../lib/deploy");

async function main() {
  console.log("CloneFactory update script")
  console.log()

  const privateKey = process.env.OWNER_PRIVATEKEY
  const cloneFactoryAddr = process.env.CLONE_FACTORY_ADDRESS
  const lumerinAddr = process.env.LUMERIN_TOKEN_ADDRESS;
  const feeRecipientAddress = process.env.FEE_RECIPIENT_ADDRESS;

  if (!privateKey) throw new Error("OWNER_PRIVATEKEY is not set")
  if (!lumerinAddr) throw new Error("LUMERIN_TOKEN_ADDRESS is not set")
  if (!feeRecipientAddress) throw new Error("FEE_RECIPIENT_ADDRESS is not set")
  if (!cloneFactoryAddr) throw new Error("CLONE_FACTORY_ADDRESS is not set")

  await UpdateCloneFactory("CloneFactory", cloneFactoryAddr, privateKey, console.log)
  fs.writeFileSync("clonefactory-addr.tmp", cloneFactoryAddr);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });