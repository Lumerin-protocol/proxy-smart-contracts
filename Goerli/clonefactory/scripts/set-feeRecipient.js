//@ts-check
require("dotenv").config();
const fs = require("fs");
const { UpdateCloneFactoryFeeRecipient } = require("../lib/modify");

const Web3 = require("web3");

async function main() {
  console.log("CloneFactory deployment script")
  console.log()

  const privateKey = process.env.OWNER_PRIVATEKEY;
  const lumerinAddr = process.env.LUMERIN_TOKEN_ADDRESS;
  const feeRecipientAddress = process.env.FEE_RECIPIENT_ADDRESS;
  const cloneFactoryAddress = process.env.CLONE_FACTORY_ADDRESS;

  if (!privateKey) throw new Error("OWNER_PRIVATEKEY is not set")
  if (!lumerinAddr) throw new Error("LUMERIN_TOKEN_ADDRESS is not set")
  if (!feeRecipientAddress) throw new Error("FEE_RECIPIENT_ADDRESS is not set")
  if (!cloneFactoryAddress) throw new Error("CLONE_FACTORY_ADDRESS is not set")

  //@ts-ignore
  console.log("ETH_NODE_ADDRESS: ", process.env.ETH_NODE_ADDRESS);
  console.log("config network url: ", config.networks.default.url);

  let web3 = new Web3(config.networks.default.url);
  const deployerWallet = web3.eth.accounts.privateKeyToAccount(privateKey)
  web3.eth.accounts.wallet.create(0).add(deployerWallet)
  
  const { address } = await UpdateCloneFactoryFeeRecipient(web3, cloneFactoryAddress, privateKey, feeRecipientAddress, console.log);

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
