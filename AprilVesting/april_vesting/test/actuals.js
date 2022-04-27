let { expect } = require("chai");
let { ethers } = require("hardhat");
let scripts = require('../scripts/main.js')


describe("ContractPurchase", function () {
	this.timeout(600*1000);
	//function to create a lumerin and tokenDrop at the designated addresses
	let lumerin
	let tokenDrop
	let accounts
	let addresses
	let values
	let wallets //used to sign objects
	let initialProvider
	let tx_amt = 100000000000
	beforeEach(async function() {
		/*
		 * deployment and initialization of contracts (lumerin and token drop
		 * the plan is to remove the deployment once all other aspects are sucessful
		 * and test against contracts deployed on the following networks
		 * localhost
		 * ropsten
		 * mattic
		 */
		initialProvider = await ethers.getSigner()
		defaultProvider = initialProvider.provider
		const Lumerin = await ethers.getContractFactory("Lumerin");
		lumerin = await Lumerin.deploy()
		await lumerin.deployed()
		const FastLumerinDrop = await ethers.getContractFactory("FastLumerinDrop");
		tokenDrop = await FastLumerinDrop.deploy(lumerin.address)
		await tokenDrop.deployed()
		//used to test bulk import of values
		tokenDropMass = await FastLumerinDrop.deploy(lumerin.address)
		await tokenDropMass.deployed()
		console.log('lumerin deployed to: ', lumerin.address)
		console.log('fast token drop deployed to: ', tokenDrop.address)
		console.log('fast token drop mass deployed to: ', tokenDrop.address)
		await lumerin.transfer(tokenDrop.address, tx_amt)
		await lumerin.transfer(tokenDropMass.address, tx_amt)
		let fastDropBalance = await lumerin.balanceOf(tokenDrop.address)
		expect(String(fastDropBalance)).to.equal(String(tx_amt))

		/*
		 * obtaining the csv file where each row contains
		 * an address, private key, and lumerin vesting value
		 * this is important to have the address and private key
		 * since testing will also include retrieving funds
		 */

		addresses = []
		values = []
		wallets = [] //0: wallet, 1: address, 2: value

		//for loop to open csv file and do the following
		//create a wallet from the private key and default provider
		//store the public key in index 1
		//store the value in index 2
		csv_read = scripts.obtainListOfAddresses('./test/addresses.csv')
		addresses = csv_read[0]
		let privkeys = csv_read[2]
		values = csv_read[1]

		for (let row of privkeys) {
			let w = new ethers.Wallet(row, defaultProvider)
			wallets.push(w)
		}





		/*
		 * inputting the values into the fast drop contract
		 * first step is to use the generated accounts file
		 * also sending them 1 eth
		 * later on intake from csv file
		 */
		for (let i = 0; i < addresses.length; i++) {
			await scripts.addIndividualAddressToFastTokenDrop(
				addresses[i], 
				values[i], 
				tokenDrop
			)
			let eth_tx = {
				to: addresses[i],
				value: ethers.utils.parseEther('1')
			}
			await initialProvider.sendTransaction(eth_tx)
		}
		//adding larger groups into the token drop
		await scripts.addMultipleAddressesToFastTokenDrop(addresses, values, tokenDropMass)
	})
	it("check to see if balance can be claimed on tokenDrop", async function () {
		/*
		 * go through list of accounts
		 * call the contract claim function for each account
		 * confirm that the balance of each account is now
		 * the same as what is in the list
		 */
		for (let i = 0; i < addresses.length; i++) {
			let user = wallets[i]
			//call claim function
			await tokenDrop.connect(user).Claim()
			//check balance of token
			let userBalance = await lumerin.balanceOf(addresses[i])
			expect(String(userBalance)).to.equal(String(values[i]))
		}
	});

	it("check to see if balance can be claimed on tokenDropMass", async function () {
		/*
		 * go through list of accounts
		 * call the contract claim function for each account
		 * confirm that the balance of each account is now
		 * the same as what is in the list
		 */
		for (let i = 0; i < addresses.length; i++) {
			let user = wallets[i]
			//call claim function
			await tokenDropMass.connect(user).Claim()
			//check balance of token
			let userBalance = await lumerin.balanceOf(addresses[i])
			expect(String(userBalance), `user ${addresses[i]}`).to.equal(String(values[i]))
		}
	});
});
