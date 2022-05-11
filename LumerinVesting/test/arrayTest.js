let { expect } = require("chai");
let { ethers } = require("hardhat");
let scripts = require("../scripts/main.js");

function makeArray(len, mul = 1, addr = 0) {
	let initialArray = [...Array(len).keys()];
	if (mul != 1) {
		let newArray = [];
		for (let x of initialArray) {
			newArray.push(x * mul + addr);
		}
		return newArray;
	}
	return initialArray;
}

describe("Array Contract Purchase", function () {
	this.timeout(600 * 1000);
	//function to create a lumerin and lumerinVesting at the designated addresses
	let lumerin;
	let lumerinVesting;
	let tx_amt = 240;
	let tranche1;
	let tranche2;
	let initialProvider
	let defaultProvider
	beforeEach(async function () {
		/*
		 * accounts is a modification of what the csv will provide
		 * index 0 is an ethereum address
		 * index 1 is a value to be vested
		 * index 2 is the wallet object used in signing
		 */
		initialProvider = await ethers.getSigner();
		defaultProvider = initialProvider.provider;
		let wallet1 = ethers.Wallet.createRandom();
		wallet1 = wallet1.connect(defaultProvider);

		const Lumerin = await ethers.getContractFactory("Lumerin");
		lumerin = await Lumerin.deploy();
		await lumerin.deployed();
		const LumerinVesting = await ethers.getContractFactory(
			"VestingWalletMulti"
		);
		tranche1 = makeArray(24, 10);
		tranche2 = makeArray(24, 10);
		lumerinVesting = await LumerinVesting.deploy(
			lumerin.address,
			tranche1,
			tranche2
		);
		await lumerinVesting.deployed();
		//used to test bulk import of values
		console.log("lumerin deployed to: ", lumerin.address);
		console.log(
			"fast token drop deployed to: ",
			lumerinVesting.address
		);
		await lumerin.transfer(lumerinVesting.address, tx_amt);
		let lumerinVestingBalance = await lumerin.balanceOf(
			lumerinVesting.address
		);
		expect(Number(lumerinVestingBalance)).to.equal(tx_amt)
	});
	it("add address then claim tokens", async function () {
		let user = ethers.Wallet.createRandom()
		user = user.connect(defaultProvider)
		let fundUserTx = {
			value: ethers.utils.parseEther('1'),
			to: user.address
		}
		let fundUser = await initialProvider.sendTransaction(fundUserTx)
		await fundUser.wait()
		//adding a user to the contract to claim tokens
		let addedUser = await lumerinVesting.setAddIndividualToVesting(
			user.address,
			tx_amt,
			0
		)
		await addedUser.wait()

		//claiming tokens
		//for loop to claim at each vesting period
		for (let i = 0; i < tranche1.length; i++) {
			let claimTokens = await lumerinVesting.connect(user).release()
			await claimTokens.wait()

			let userBalance = await lumerin.balanceOf(
				user.address
			);
			expect(Number(userBalance)).to.equal(
				Number(tx_amt)
			);
		}
	});
	it("add address then claim tokens twice", async function () {
		let user = ethers.Wallet.createRandom()
		user = user.connect(defaultProvider)
	});
	it("add multiple addresses then claim tokens", async function () {
		let users = []
		for (let i = 0; i < 10; i++) {
			let user = ethers.Wallet.createRandom()
			user = user.connect(defaultProvider)
			users.push([user.address, 100, user])
		}
	});
	it("add multiple addresses then claim tokens twice", async function () {
		let users = []
		for (let i = 0; i < 10; i++) {
			let user = ethers.Wallet.createRandom()
			user = user.connect(defaultProvider)
			users.push([user.address, 100, user])
		}
	});
});
