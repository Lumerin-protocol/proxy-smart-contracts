import { network, ethers } from "hardhat"
import Web3 from "web3"
import { Wallet } from "ethers"
import { CloneFactory } from "../build-js/dist"
import { CreateContract } from "../lib/deploy"
import { buildContractsList } from "../lib/populate-contracts"
import { requireEnvsSet } from "../lib/utils"
import { HttpNetworkConfig } from "hardhat/types"

async function main() {
  console.log("Contracts population script")

  const env = requireEnvsSet("CLONE_FACTORY_ADDRESS", "SELLER_PRIVATEKEY", "BUILD_FULL_MARKETPLACE")

  const seller = new Wallet(env.SELLER_PRIVATEKEY).connect(ethers.provider)
  console.log("Deploying contracts with the seller account:", seller.address);
  console.log("Account balance:", (await seller.getBalance()).toString());
  console.log("CLONEFACTORY address:", env.CLONE_FACTORY_ADDRESS);

  const web3 = new Web3((network.config as HttpNetworkConfig).url)
  const account = web3.eth.accounts.privateKeyToAccount(seller.privateKey)
  web3.eth.accounts.wallet.create(0).add(account)
  const cf = CloneFactory(web3, env.CLONE_FACTORY_ADDRESS)

  const contractList = buildContractsList(env.BUILD_FULL_MARKETPLACE === "true");
  const fee = await cf.methods.marketplaceFee().call()
  console.log(`Marketplace fee: ${fee} wei`);

  for (const c of contractList) {
    const { address, txHash } = await CreateContract(String(c.price), String(c.length), String(c.speed), cf, seller, fee, console.log)
    console.log(`contract created, address: ${address} tx hash: ${txHash}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
