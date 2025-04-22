import type { HardhatUserConfig } from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-abi-exporter";
import "dotenv/config";
import "@nomicfoundation/hardhat-viem";
import "hardhat-storage-layout";

// Base config is used for local deployment and/or contract build
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      // for older contracts
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      // for validation regitry
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      mining: {
        auto: true,
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
      ],
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
    only: [
      "CloneFactory",
      "Faucet",
      "Implementation",
      "Escrow",
      "LumerinToken",
      "ValidatorRegistry",
      "@openzeppelin/contracts/token/ERC20/IERC20",
    ],
  },
  mocha: {
    timeout: 5 * 60 * 1000, // 5 minutes
  },
};

export default config;
