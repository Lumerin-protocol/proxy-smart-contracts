const CloneFactory = artifacts.require("CloneFactory");
const Migrations = artifacts.require("Migrations");
const MyToken = artifacts.require("Lumerin");

//for testing purposes we'll need to deploy the token each time a new ganache instance is made


module.exports = async function (deployer, network) {
  let tokenAddress;
  let validatorAddress = "0x9FC7b6608c2d00f0AceDa7D6BEea610FC24a58Ff";
  deployer.deploy(Migrations);
  /*
   * async deployment of ledger and clone factory so their addresses can be captured
   */

	console.log(network)

	if (network == "development") {
		await deployer.deploy(MyToken).then(r => tokenAddress = r.address)
		  await deployer.deploy(CloneFactory, tokenAddress, validatorAddress, validatorAddress)
		//deploy lumerin token to newly made network
	} else if (network == "ropsten-fork" || network == "ropsten") {
		tokenAddress = '0x84E00a18a36dFa31560aC216da1A9bef2164647D'
		  await deployer.deploy(CloneFactory, tokenAddress, validatorAddress, validatorAddress)
		}


};
