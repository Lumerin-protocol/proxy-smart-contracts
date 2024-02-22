import { network } from "hardhat";
import Web3 from "web3";
import { requireEnvsSet } from "../lib/utils";
import { HttpNetworkConfig } from "hardhat/types";
import { CloneFactory, Implementation } from "../build-js/dist";

async function main() {
  const env = requireEnvsSet(
    "CONTRACT_ADDRESS",
    "CLONE_FACTORY_ADDRESS",
    "OWNER_PRIVATEKEY",
  );

  const web3 = new Web3((network.config as HttpNetworkConfig).url);
  const ownerWallet = web3.eth.accounts.privateKeyToAccount(
    env.OWNER_PRIVATEKEY,
  );
  web3.eth.accounts.wallet.create(0).add(ownerWallet);

  console.log(`Deleting/undeleting contract: ${env.CONTRACT_ADDRESS}`);
  console.log(`Using account: ${ownerWallet.address}`);
  console.log(`CLONEFACTORY address: ${env.CLONE_FACTORY_ADDRESS}`);
  console.log("\n");

  const impl = Implementation(web3, env.CONTRACT_ADDRESS);
  const isDeleted = await impl.methods.isDeleted().call();

  const cf = CloneFactory(web3, env.CLONE_FACTORY_ADDRESS);
  await cf.methods
    .setContractDeleted(env.CONTRACT_ADDRESS, !isDeleted)
    .send({ from: ownerWallet.address, gas: 1e6 });

  console.log(
    `Contract ${env.CONTRACT_ADDRESS} is now ${
      isDeleted ? "undeleted" : "deleted"
    }`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
