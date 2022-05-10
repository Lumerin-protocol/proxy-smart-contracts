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

describe("Clonefactory Vesting", function () {
	this.timeout(600*1000);
	//function to create a lumerin and lumerinVesting at the designated addresses
	let lumerin
	let lumerinVesting
	let tx_amt = 240
	let initialProvider, defaultProvider
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

		const Lumerin = await ethers.getContractFactory("Lumerin");
		lumerin = await Lumerin.deploy()
		await lumerin.deployed()
		const CloneFactory = await ethers.getContractFactory("CloneFactory");
		cloneFactory = await CloneFactory.deploy(
			lumerin.address
		)
		await cloneFactory.deployed()
		//used to test bulk import of values
		console.log('lumerin deployed to: ', lumerin.address)
		console.log('clonefactory deployed to: ', cloneFactory.address)
		await lumerin.transfer(cloneFactory.address, tx_amt*10)
		let cfLumerinBalance = await lumerin.balanceOf(cloneFactory.address)
		expect(Number(cfLumerinBalance)).to.equal(tx_amt*10)


	})
	it("check to see if expected amount is available at all time intervals", async function () {
		let wallet = ethers.Wallet.createRandom()
		wallet = wallet.connect(defaultProvider)
		let times = makeArray(24, 10)
		//create a new vesting wallet
		let mk_ctx = await cloneFactory.setCreateNewVestingWallet(wallet.address, tx_amt, times)
		await mk_ctx.wait()
		let vestingAddress = await cloneFactory.getVestingWalletAddress(wallet.address)
		let VestingContract = await ethers.getContractFactory("LumerinVestingClone")
		let vestingContract = await VestingContract.attach(vestingAddress)
		//need to build into contract ability to auto-send lumerin to deployed contract
		await lumerin.transfer(vestingAddress, tx_amt)
		for (let i = 0; i < times.length; i++) {
			let t = times[i]
			let claimTokens = await vestingContract.releaseTest(t)
			await claimTokens.wait()
			let walletLMR = await lumerin.balanceOf(wallet.address)
			let expectedLMR = tx_amt*(i+1)/times.length
			expect(Number(walletLMR), `expected ${walletLMR}, but got ${expectedLMR}`).to.equal(Number(expectedLMR))
		}
	})
	it("check to see if expected amount is available at all time intervals+1", async function () {
		let wallet = ethers.Wallet.createRandom()
		wallet = wallet.connect(defaultProvider)
		let times = makeArray(24, 10)
		//create a new vesting wallet
		let mk_ctx = await cloneFactory.setCreateNewVestingWallet(wallet.address, tx_amt, times)
		await mk_ctx.wait()
		let vestingAddress = await cloneFactory.getVestingWalletAddress(wallet.address)
		let VestingContract = await ethers.getContractFactory("LumerinVestingClone")
		let vestingContract = await VestingContract.attach(vestingAddress)
		//need to build into contract ability to auto-send lumerin to deployed contract
		await lumerin.transfer(vestingAddress, tx_amt)
		for (let i = 0; i < times.length; i++) {
			let t = times[i]+1
			let claimTokens = await vestingContract.releaseTest(t)
			await claimTokens.wait()
			let walletLMR = await lumerin.balanceOf(wallet.address)
			let expectedLMR = tx_amt*(i+1)/times.length
			expect(Number(walletLMR), `expected ${walletLMR}, but got ${expectedLMR}`).to.equal(Number(expectedLMR))
		}
	})
	it("check to see if expected amount is available at all time intervals-1", async function () {
		let wallet = ethers.Wallet.createRandom()
		wallet = wallet.connect(defaultProvider)
		let times = makeArray(24, 10)
		//create a new vesting wallet
		let mk_ctx = await cloneFactory.setCreateNewVestingWallet(wallet.address, tx_amt, times)
		await mk_ctx.wait()
		let vestingAddress = await cloneFactory.getVestingWalletAddress(wallet.address)
		let VestingContract = await ethers.getContractFactory("LumerinVestingClone")
		let vestingContract = await VestingContract.attach(vestingAddress)
		//need to build into contract ability to auto-send lumerin to deployed contract
		await lumerin.transfer(vestingAddress, tx_amt)
		for (let i = 0; i < times.length; i++) {
			let t = times[i]-1
			if (t < 0) { t = 0}
			let claimTokens = await vestingContract.releaseTest(t)
			await claimTokens.wait()
			let walletLMR = await lumerin.balanceOf(wallet.address)
			let expectedLMR
			if (t == 0) {
				expectedLMR = tx_amt*(i+1)/times.length
			} else {
				expectedLMR = tx_amt*(i)/times.length
			}
			expect(Number(walletLMR), `expected ${walletLMR}, but got ${expectedLMR}`).to.equal(Number(expectedLMR))
		}
	})
	it("attempt to claim twice and still have funds from claiming once", async function () {
		let wallet = ethers.Wallet.createRandom()
		wallet = wallet.connect(defaultProvider)
		let times = makeArray(24, 10)
		//create a new vesting wallet
		let mk_ctx = await cloneFactory.setCreateNewVestingWallet(wallet.address, tx_amt, times)
		await mk_ctx.wait()
		let vestingAddress = await cloneFactory.getVestingWalletAddress(wallet.address)
		let VestingContract = await ethers.getContractFactory("LumerinVestingClone")
		let vestingContract = await VestingContract.attach(vestingAddress)
		//need to build into contract ability to auto-send lumerin to deployed contract
		await lumerin.transfer(vestingAddress, tx_amt)
		for (let i = 0; i < times.length; i++) {
			let t = times[i]
			let claimTokens = await vestingContract.releaseTest(t)
			await claimTokens.wait()
			claimTokens = await vestingContract.releaseTest(t)
			await claimTokens.wait()
			let walletLMR = await lumerin.balanceOf(wallet.address)
			let expectedLMR = tx_amt*(i+1)/times.length
			expect(Number(walletLMR), `expected ${walletLMR}, but got ${expectedLMR}`).to.equal(Number(expectedLMR))
		}
	})
});
