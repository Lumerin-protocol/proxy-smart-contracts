require("@nomiclabs/hardhat-waffle");

const NET_API_KEY = "KEY";
const NET_PRIVATE_KEY = "PRIVATE KEY FROM NETWORK";

module.exports = {
  solidity: "0.7.3",
  networks: {
    NetworkNameHere: {
      url: `https://path-to-network-api/${NET_API_KEY}`,
      accounts: [`0x${NET_PRIVATE_KEY}`]
    }
  }
};
