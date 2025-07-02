import base from "./hardhat.config";
import type { HardhatUserConfig } from "hardhat/config";

// #TODO put to default config content from base config and introduce a new config file hardhat-network.config.ts

// if (!process.env.ETH_NODE_ADDRESS) {
//   throw new Error("ETH_NODE_ADDRESS env variable is not set");
// }

// if (!process.env.OWNER_PRIVATEKEY) {
//   throw new Error("OWNER_PRIVATEKEY env variable is not set");
// }

// if (!process.env.SELLER_PRIVATEKEY) {
//   throw new Error("SELLER_PRIVATEKEY env variable is not set");
// }

const config: HardhatUserConfig = {
  ...base,
  networks: {
    ...base.networks,
    default: {
      url: process.env.ETH_NODE_ADDRESS,
      accounts: [process.env.OWNER_PRIVATEKEY],
      gasPrice: "auto",
      gas: "auto",
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
