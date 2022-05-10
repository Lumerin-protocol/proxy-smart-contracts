let { expect } = require("chai");
let { ethers } = require("hardhat");
let scripts = require('../scripts/main.js')

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
	let account
	let tx_amt = 240
	beforeEach(async function() {
		/*
		 * accounts is a modification of what the csv will provide
		 * index 0 is an ethereum address
		 * index 1 is a value to be vested
		 * index 2 is the wallet object used in signing
		 */
		initialProvider = await ethers.getSigner()
		defaultProvider = initialProvider.provider
		accounts = [] //for testing, a 3d array where 0 is the address, 1 is the tx_amt, and 2 is the wallet object used to sign stuff
		let wallet1 = ethers.Wallet.createRandom()
		wallet1 = wallet1.connect(defaultProvider)
		accounts.push([wallet1.address, tx_amt, wallet1])

		const Lumerin = await ethers.getContractFactory("Lumerin");
		lumerin = await Lumerin.deploy()
		await lumerin.deployed()
		const LumerinVesting = await ethers.getContractFactory("LumerinVestingActual");
		account = accounts[0]
		let monthlyArray = makeArray(24, 10)
		console.log("here")
		lumerinVesting = await LumerinVesting.deploy(
			account[0], //address to claim vesting balances
			lumerin.address,
			//the previous 2 items should add up to the purchase during tranche 2
			tx_amt, //total amount of lumerin to be vested
			monthlyArray, //timestamps of each vesting event
			monthlyArray[0], //start of vesting
			monthlyArray[monthlyArray.length-1]-monthlyArray[0] //duration of vesting
		)
		console.log("sucessful deployment")
		await lumerinVesting.deployed()
		//used to test bulk import of values
		console.log('lumerin deployed to: ', lumerin.address)
		console.log('fast token drop deployed to: ', lumerinVesting.address)
		await lumerin.transfer(lumerinVesting.address, account[1])
		let lumerinVestingBalance = await lumerin.balanceOf(lumerinVesting.address)
		expect(Number(lumerinVestingBalance)).to.equal(Number(account[1]))


	})
	it("check to see if expected amount is available at all time intervals", async function () {
		let times = makeArray(24, 10)
		for (let i = 0; i < times.length; i++) {
			//call the releaseTest function on the vesting contract
			let currentMonths = await lumerinVesting.releaseTest(times[i])
			//wait for the release call to finish
			currentMonths = await currentMonths.wait()
			let walletLMR = await lumerin.balanceOf(account[0])
			let expectedLMR = tx_amt*(i+1)/24
			//check the lumerin balance of the wallet
			expect(Number(walletLMR), `expected ${walletLMR}, but got ${expectedLMR}`).to.equal(Number(expectedLMR))
		}
	})
	it("check to see if expected amount is available at all time intervals+1", async function () {
		let times = makeArray(24, 10)
		for (let i = 0; i < times.length; i++) {
			//call the releaseTest function on the vesting contract
			let currentMonths = await lumerinVesting.releaseTest(times[i]+1)
			//wait for the release call to finish
			currentMonths = await currentMonths.wait()
			let walletLMR = await lumerin.balanceOf(account[0])
			let expectedLMR = tx_amt*(i+1)/24
			//check the lumerin balance of the wallet
			expect(Number(walletLMR), `expected ${walletLMR}, but got ${expectedLMR}`).to.equal(Number(expectedLMR))
		}
	})
	it("check to see if expected amount is available at all time intervals-1", async function () {
		let times = makeArray(24, 10)
		for (let i = 0; i < times.length; i++) {
			//call the releaseTest function on the vesting contract
			let t = times[i] - 1
			if (t < 0) {t = 0}
			let currentMonths = await lumerinVesting.releaseTest(t)
			//wait for the release call to finish
			currentMonths = await currentMonths.wait()
			let walletLMR = await lumerin.balanceOf(account[0])
			let expectedLMR
			if (t == 0) {
				expectedLMR = tx_amt*(i+1)/24
			} else {
				expectedLMR = tx_amt*(i)/24
			}
			//check the lumerin balance of the wallet
			expect(Number(walletLMR), `i: ${i} t: ${t}; expected ${walletLMR}, but got ${expectedLMR}`).to.equal(Number(expectedLMR))
		}
	})
	it("attempt to claim twice and still have funds from claiming once", async function () {
		let times = makeArray(24, 10)
		for (let i = 0; i < times.length; i++) {
			//call the releaseTest function on the vesting contract
			let currentMonths = await lumerinVesting.releaseTest(times[i])
			currentMonths = await lumerinVesting.releaseTest(times[i])
			//wait for the release call to finish
			currentMonths = await currentMonths.wait()
			let walletlmr = await lumerin.balanceOf(account[0])
			let expectedlmr = tx_amt*(i+1)/24
			//check the lumerin balance of the wallet
			expect(Number(walletlmr), `expected ${walletlmr}, but got ${expectedlmr}`).to.equal(Number(expectedlmr))
		}
	})
});
