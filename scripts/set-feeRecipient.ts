import { HttpNetworkConfig } from "hardhat/types";
import { requireEnvsSet } from "../lib/utils";
import { network } from "hardhat";
import Web3 from "web3";
import { UpdateCloneFactoryFeeRecipient } from "../lib/modify";

async function main() {
  console.log("CloneFactory fee recipient update script")
  console.log()

  const env = requireEnvsSet("OWNER_PRIVATEKEY", "LUMERIN_TOKEN_ADDRESS", "FEE_RECIPIENT_ADDRESS", "CLONE_FACTORY_ADDRESS")

  const networkUrl = (network.config as HttpNetworkConfig).url;
  console.log("ETH_NODE_ADDRESS: ", process.env.ETH_NODE_ADDRESS);
  console.log("config network url: ", networkUrl);

  const web3 = new Web3(networkUrl)
  const deployerWallet = web3.eth.accounts.privateKeyToAccount(env.OWNER_PRIVATEKEY)
  web3.eth.accounts.wallet.create(0).add(deployerWallet)
  
  const { address } = await UpdateCloneFactoryFeeRecipient(
    web3, 
    env.CLONE_FACTORY_ADDRESS, 
    env.OWNER_PRIVATEKEY, 
    env.FEE_RECIPIENT_ADDRESS, 
    console.log
  );

  console.log("SUCCESS")
  console.log("Fee recipient updated");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
