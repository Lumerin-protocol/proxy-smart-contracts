let { expect } = require("chai");
let { ethers } = require("hardhat");
let scripts = require('../scripts/whitelist.js')
let otherScripts = require('../scripts/main.js')
let sleep = require('sleep')

function makeArray(len, mul=1, addr = 0) {
	let initialArray = [...Array(len).keys()]
	if (mul != 1) {
		let newArray = []
		for (let x of initialArray) {
			newArray.push(x*mul+addr)
		}
		return newArray
	} 
	return initialArray
}

describe("Inherited Contract Purchase", function () {
	this.timeout(600*1000);
	//function to create a lumerin and lumerinVesting at the designated addresses
	let lumerin
	let lumerinVesting
	let accounts
	let tranche1Schedule = [1653760800, 1656439200, 1659031200, 1661709600]
	let tranche2Schedule = [1653760800]
	let trancheSeed = [
						1656439200,
						1659031200,
						1661709600,
						1664388000,
						1666980000,
						1669662000,
						1672254000,
						1674932400,
						1677610800,
						1680026400,
						1682704800,
						1685296800,
					]
	let trancheCorporate = [
						1664388000,
						1666980000,
						1669662000,
						1672254000,
						1674932400,
						1677610800,
						1680026400,
						1682704800,
						1685296800,
						1687975200,
						1690567200,
						1693245600,
						1695924000,
						1698516000,
						1701198000,
						1703790000,
						1706468400,
						1709146800,
						1711648800,
						1714327200,
						1716919200,
						1719597600,
						1722189600,
						1724868000,
					]

	beforeEach(async function() {
		accounts = []
		//create a set of wallets to use for testing
		let initialProvider = await ethers.getSigner()
		let defaultProvider = initialProvider.provider
		for (let i = 0; i < 5; i++) {
			let wallet1 = ethers.Wallet.createRandom()
			wallet1 = wallet1.connect(defaultProvider)
			//update to have a random number representing token drop and vesting value
			accounts.push([wallet1.address, wallet1])
			let fundUserTx = {
				value: ethers.utils.parseEther('1'),
				to: wallet1.address
			}
			let fundUser = await initialProvider.sendTransaction(fundUserTx)
			await fundUser.wait()
		}
		/*
		 * accounts is a modification of what the csv will provide
		 * index 0 is an ethereum address
		 * index 1 is a value to be vested
		 * index 2 is the wallet object used in signing
		 */
		const Lumerin = await ethers.getContractFactory("Lumerin");
		lumerin = await Lumerin.deploy()
		await lumerin.deployed()
		const LumerinVesting = await ethers.getContractFactory("LumerinVestingMulti");
		lumerinVesting = await LumerinVesting.deploy(
			lumerin.address,
			//the previous 2 items should add up to the purchase during tranche 2
			tranche1Schedule, //timestamps of each vesting event
			tranche2Schedule, //timestamps of each vesting event
			trancheSeed, //timestamps of each vesting event
			trancheCorporate, //timestamps of each vesting event
		)
		await lumerinVesting.deployed()
		//used to test bulk import of values
		console.log('lumerin deployed to: ', lumerin.address)
		console.log('fast token drop deployed to: ', lumerinVesting.address)
		let totalLumerinBalance = await lumerin.totalSupply()
		let lumerinTx = await lumerin.transfer(lumerinVesting.address, totalLumerinBalance)
		lumerinTx = await lumerinTx.wait()
		let lumerinVestingBalance = await lumerin.balanceOf(lumerinVesting.address)
		expect(Number(lumerinVestingBalance)).to.equal(Number(totalLumerinBalance))


	})
	it("load accounts and check if they can claim tranche1", async function () {
		//call the releaseTest function from each wallet
		//ensure that they have vested the proper amount of funds
		await scripts.populateWhiteList(lumerinVesting.address, lumerin.address, accounts, 'tranche1').then(console.log)
		let values = otherScripts.obtainListOfAddresses('./scripts/tranche1Condensed.csv')
		let valuesToCheck = values[1]
		for (let i = 0; i < accounts.length; i++) {
			//establishing the wallet to call from and the account to claim from
			let address = accounts[i][0]
			let wallet = accounts[i][1]
			let totalVestingAmount = valuesToCheck[i]
			//loop through each time and see if the tokens vest as expected
			let k = 1
			for (let j of tranche1Schedule) {
				let expectedTx = totalVestingAmount*(k)/tranche1Schedule.length
				let claim = await lumerinVesting.connect(wallet).releaseTest(j)
				claim = await claim.wait()
				let accountBalance = await lumerin.balanceOf(address)
				expect(Number(accountBalance), `account: ${address} failed tranche 1 timestamp: ${j}`).to.equal(expectedTx)
				k++
			}
		}
	})
	it("load accounts and check if they can claim tranche2", async function () {
		//call the releaseTest function from each wallet
		//ensure that they have vested the proper amount of funds
		await scripts.populateWhiteList(lumerinVesting.address, lumerin.address, accounts, 'tranche2').then(console.log)
		let values = otherScripts.obtainListOfAddresses('./scripts/tranche2Condensed.csv')
		let valuesToCheck = values[1]
		for (let i = 0; i < accounts.length; i++) {
			//establishing the wallet to call from and the account to claim from
			let address = accounts[i][0]
			let wallet = accounts[i][1]
			let totalVestingAmount = valuesToCheck[i]
			//loop through each time and see if the tokens vest as expected
			let k = 1
			for (let j of tranche2Schedule) {
				let expectedTx = totalVestingAmount*(k)/tranche2Schedule.length
				let claim = await lumerinVesting.connect(wallet).releaseTest(j)
				claim = await claim.wait()
				let accountBalance = await lumerin.balanceOf(address)
				expect(Number(accountBalance), `account: ${address} failed tranche 2 timestamp: ${j}`).to.equal(expectedTx)
				k++
			}
		}
	})
	it("load accounts and check if they can claim trancheSeed", async function () {
		//call the releaseTest function from each wallet
		//ensure that they have vested the proper amount of funds
		await scripts.populateWhiteList(lumerinVesting.address, lumerin.address, accounts, 'trancheSeed').then(console.log)
		let values = otherScripts.obtainListOfAddresses('./scripts/trancheSeedCondensed.csv')
		let valuesToCheck = values[1]
		for (let i = 0; i < accounts.length; i++) {
			//establishing the wallet to call from and the account to claim from
			let address = accounts[i][0]
			let wallet = accounts[i][1]
			let totalVestingAmount = valuesToCheck[i]
			//loop through each time and see if the tokens vest as expected
			let k = 1
			for (let j of trancheSeed) {
				let expectedTx = totalVestingAmount*(k)/trancheSeed.length
				expectedTx = Number(expectedTx.toFixed(0))
				let claim = await lumerinVesting.connect(wallet).releaseTest(j)
				claim = await claim.wait()
				let accountBalance = await lumerin.balanceOf(address)
				expect(Number(accountBalance), `account: ${address} failed tranche 2 timestamp: ${j}`).to.be.within(expectedTx-1, expectedTx+1)
				k++
			}
		}
	})
	it("load accounts and check if they can claim trancheCorporate", async function () {
		//call the releaseTest function from each wallet
		//ensure that they have vested the proper amount of funds
		await scripts.populateWhiteList(lumerinVesting.address, lumerin.address, accounts, 'trancheCorporate').then(console.log)
		let values = otherScripts.obtainListOfAddresses('./scripts/trancheCorporateCondensed.csv')
		let valuesToCheck = values[1]
		for (let i = 0; i < accounts.length; i++) {
			//establishing the wallet to call from and the account to claim from
			let address = accounts[i][0]
			let wallet = accounts[i][1]
			let totalVestingAmount = valuesToCheck[i]
			//loop through each time and see if the tokens vest as expected
			let k = 1
			for (let j of trancheCorporate) {
				let expectedTx = totalVestingAmount*(k)/trancheCorporate.length
				expectedTx = Number(expectedTx.toFixed(0))
				let claim = await lumerinVesting.connect(wallet).releaseTest(j)
				claim = await claim.wait()
				let accountBalance = await lumerin.balanceOf(address)
				expect(Number(accountBalance), `account: ${address} failed tranche 2 timestamp: ${j}`).to.be.within(expectedTx-1, expectedTx+1)
				k++
			}
		}
	})
	it("load accounts and check if they can claim +1", async function () {
		//call the releaseTest function from each wallet
		//ensure that they have vested the proper amount of funds
		await scripts.populateWhiteList(lumerinVesting.address, lumerin.address, accounts, 'tranche1').then(console.log)
		let values = otherScripts.obtainListOfAddresses('./scripts/tranche1Condensed.csv')
		let valuesToCheck = values[1]
		for (let i = 0; i < accounts.length; i++) {
			//establishing the wallet to call from and the account to claim from
			let address = accounts[i][0]
			let wallet = accounts[i][1]
			let totalVestingAmount = valuesToCheck[i]
			//loop through each time and see if the tokens vest as expected
			let k = 1
			for (let j of tranche1Schedule) {
				let expectedTx = totalVestingAmount*(k)/tranche1Schedule.length
				let claim = await lumerinVesting.connect(wallet).releaseTest(j+1)
				claim = await claim.wait()
				let accountBalance = await lumerin.balanceOf(address)
				expect(Number(accountBalance), `account: ${address} failed tranche 1 timestamp: ${j}`).to.equal(expectedTx)
				k++
			}
		}
	})
	it("load accounts and check if they can claim -1", async function () {
	})
	it("load accounts and ensure double spend can't happen", async function () {
		//call the releaseTest function from each wallet
		//ensure that they have vested the proper amount of funds
		await scripts.populateWhiteList(lumerinVesting.address, lumerin.address, accounts, 'tranche1').then(console.log)
		let values = otherScripts.obtainListOfAddresses('./scripts/tranche1Condensed.csv')
		let valuesToCheck = values[1]
		for (let i = 0; i < accounts.length; i++) {
			//establishing the wallet to call from and the account to claim from
			let address = accounts[i][0]
			let wallet = accounts[i][1]
			let totalVestingAmount = valuesToCheck[i]
			//loop through each time and see if the tokens vest as expected
			let k = 1
			for (let j of tranche1Schedule) {
				let expectedTx = totalVestingAmount*(k)/tranche1Schedule.length
				await lumerinVesting.connect(wallet).releaseTest(j)
				//simulating a double claim
				await lumerinVesting.connect(wallet).releaseTest(j)
				await lumerinVesting.connect(wallet).releaseTest(j, {gasPrice: 1000000000})
				sleep.sleep(3) //wait 3 seconds
				let accountBalance = await lumerin.balanceOf(address)
				expect(Number(accountBalance), `account: ${address} failed tranche 1 timestamp: ${j}`).to.equal(expectedTx)
				k++
			}
		}
	})
});
