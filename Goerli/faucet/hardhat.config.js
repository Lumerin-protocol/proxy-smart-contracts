require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.9",
  networks: {
    hardhat: {
      mining: {
        auto: true,
      }
    }, 
    gorelli: {
      url: 'https://eth-goerli.g.alchemy.com/v2/fVZAxRtdmyD4gcw-EyHhpSbBwFPZBw3A',
      accounts: [
        'de33baba187e2f172a8313d6fd578db3941b18277d05ad7e2cfceeb0a9f9fd46',
      ],
      gas: 10000000000000,
      gasMultiplier: 10,
      gasPrice: "auto",
      //gas: "auto"
    },
  },
};
