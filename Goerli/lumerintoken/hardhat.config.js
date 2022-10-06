require("@nomiclabs/hardhat-ethers");
require("hardhat-abi-exporter");
require("dotenv").config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.9",
  networks: {
    hardhat: {},
    gorelli: {
      url: process.env.NODE_URL,
      accounts: JSON.parse(process.env.LUMERIN_TOKEN_ACCOUNTS),
      gasPrice: "auto",
      gas: "auto",
    },
    //	mainnet: {}
  },
  abiExporter: {
    path: "./abi",
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
  },
};
