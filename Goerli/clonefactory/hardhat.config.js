//@ts-check
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-abi-exporter");
require('@openzeppelin/hardhat-upgrades');
require("dotenv").config();
const base = require("./hardhat-base.config.js");

// This config is used for blockchain deploymente
//
// Two configs are required because hardhat validates each network entry 
// config for compile and test jobs, even it is not needed. Only deployment
// job needs eth node url and private key

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  ...base,
  networks: {
    ...base.networks,
    default: {
      url: process.env.ETH_NODE_ADDRESS,
      accounts: [process.env.OWNER_PRIVATEKEY, process.env.SELLER_PRIVATEKEY],
      gasPrice: "auto",
      gas: "auto",
    }
  }
};
