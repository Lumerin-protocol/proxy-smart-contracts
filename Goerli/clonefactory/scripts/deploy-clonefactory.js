//@ts-check
require("dotenv").config();
const fs = require("fs");
const { DeployCloneFactory } = require("../lib/deploy");

async function main() {
  console.log("CloneFactory deployment script")
  console.log()

  const privateKey = process.env.OWNER_PRIVATEKEY;
  const lumerinAddr = process.env.LUMERIN_TOKEN_ADDRESS;
  const feeRecipientAddress = process.env.FEE_RECIPIENT_ADDRESS;

  if (!privateKey) throw new Error("OWNER_PRIVATEKEY is not set")
  if (!lumerinAddr) throw new Error("LUMERIN_TOKEN_ADDRESS is not set")
  if (!feeRecipientAddress) throw new Error("FEE_RECIPIENT_ADDRESS is not set")

  const { address } = await DeployCloneFactory(lumerinAddr, privateKey, feeRecipientAddress, console.log);

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
