import Web3 from "web3";
import { network } from "hardhat";
import { requireEnvsSet } from "../lib/utils";
import { HttpNetworkConfig } from "hardhat/types";
import { ValidatorRegistry } from "../build-js/dist";

async function main() {
  console.log("Validator registry configure script");
  console.log();

  const env = requireEnvsSet(
    "OWNER_PRIVATEKEY",
    "VALIDATOR_REGISTRY_ADDRESS",
    "VALIDATOR_REGISTRY_STAKE_MINIMUN",
    "VALIDATOR_REGISTRY_STAKE_REGISTER",
    "VALIDATOR_REGISTRY_PUNISH_AMOUNT",
    "VALIDATOR_REGISTRY_PUNISH_THRESHOLD",
  );

  const web3 = new Web3((network.config as HttpNetworkConfig).url);
  const ownerWallet = web3.eth.accounts.privateKeyToAccount(
    env.OWNER_PRIVATEKEY,
  );
  web3.eth.accounts.wallet.create(0).add(ownerWallet);

  console.log(`Using account: ${ownerWallet.address}`);
  console.log(`VALIDATOR REGISTRY address: ${env.VALIDATOR_REGISTRY_ADDRESS}`);
  console.log();
  console.log(`Stake minimum: ${env.VALIDATOR_REGISTRY_STAKE_MINIMUN}`);
  console.log(`Stake register: ${env.VALIDATOR_REGISTRY_STAKE_REGISTER}`);
  console.log(`Punish amount: ${env.VALIDATOR_REGISTRY_PUNISH_AMOUNT}`);
  console.log(`Punish threshold: ${env.VALIDATOR_REGISTRY_PUNISH_THRESHOLD}`);
  console.log("\n");

  const reg = ValidatorRegistry(web3, env.VALIDATOR_REGISTRY_ADDRESS);
  await reg.methods
    .configure(
      env.VALIDATOR_REGISTRY_STAKE_MINIMUN,
      env.VALIDATOR_REGISTRY_STAKE_REGISTER,
      env.VALIDATOR_REGISTRY_PUNISH_AMOUNT,
      env.VALIDATOR_REGISTRY_PUNISH_THRESHOLD,
    )
    .send({ from: ownerWallet.address });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
