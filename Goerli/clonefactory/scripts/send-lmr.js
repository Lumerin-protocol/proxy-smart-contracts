//@ts-check
require("dotenv").config();
/**
 * @type {import("hardhat/types/runtime").HardhatRuntimeEnvironment}
 */
const { ethers } = require("hardhat");
const { encrypt } = require('ecies-geth')
const { add65BytesPrefix } = require("../lib/utils");
// const { Lumerin } = require('../build-js/dist/index.js')

async function main() {
  let lumerinAddress = process.env.LUMERIN_ADDRESS || "";
  const recipient = process.env.RECIPIENT || "";
  if (!lumerinAddress || !recipient) {
    throw new Error("Lumerin address or recipient not provided");
  }

  console.log(process.env.ETH_NODE_ADDRESS)

  console.log(`Sending lumerin`)
  console.log(`Using Lumerin address: ${lumerinAddress}`);
  const [seller, buyer] = await ethers.getSigners();



  const lumerin = await ethers.getContractAt("Lumerin", lumerinAddress);

  const sendLumerin = await lumerin.connect(seller).transfer(recipient, 2000);
  await sendLumerin.wait();

  console.log(`Sent lumerin to ${recipient}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
