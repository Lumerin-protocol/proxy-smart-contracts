require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');
require("hardhat-abi-exporter");
require("dotenv").config();

// Base config is used for local deployment and/or contract build

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  },
  networks: {
    hardhat: {
      mining: {
        auto: true,
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"],
      gasPrice: "auto",
      gas: "auto",
    },
  },
  abiExporter: {
    path: "./abi",
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
  },
};
