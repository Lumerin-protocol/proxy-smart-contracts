require("@nomiclabs/hardhat-waffle");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  solidity: "0.8.7",
networks: {
  hardhat: {
    mining: {
      auto: false,
      interval: 1000
    }
  }, 
	gorli: {
	//	url: 'https://ropsten.connect.bloq.cloud/v1/brown-click-brother',
		url: 'https://eth-goerli.g.alchemy.com/v2/fVZAxRtdmyD4gcw-EyHhpSbBwFPZBw3A',
		accounts: [
			//'3b6bdee2016d0803a11bbb0e3d3b8b5f776f3cf0239b2e5bb53bda317b8a2e20', //dev
			//'3b6bdee2016d0803a11bbb0e3d3b8b5f776f3cf0239b2e5bb53bda317b8a2e20', //stg
			'926635cb6bd207c1bfabf9aedabada98f308b7fe5d85825ca33c669f96f7cc66', //main
		],
    gas: "auto",
    gasPrice: "auto",
	}
},
};
