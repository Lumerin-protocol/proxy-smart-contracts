require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-abi-exporter");
require('@openzeppelin/hardhat-upgrades');
require("dotenv").config();

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account);
  }
});

// This config is used for blockchain deployment

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
    goerli: {
      url: process.env.ETH_NODE_ADDRESS,
      accounts: [process.env.CONTRACTS_OWNER_PRIVATE_KEY],
      gasPrice: "auto",
      gas: "auto",
    },
    sepolia: {
      url: process.env.ETH_NODE_ADDRESS,
      accounts: [process.env.CONTRACTS_OWNER_PRIVATE_KEY],
      gasPrice: "auto",
      gas: "auto",
    },
    arbitrum_goerli:{
      url: process.env.ETH_NODE_ADDRESS,
      accounts: [process.env.CONTRACTS_OWNER_PRIVATE_KEY],
      gasPrice: "auto",
      gas: "auto",
      chainId: 421613,
    }
  },
  abiExporter: {
    path: "./abi",
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
  },
};
