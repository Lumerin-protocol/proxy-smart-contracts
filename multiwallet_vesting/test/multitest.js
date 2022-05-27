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
	let initialAddress
	let monthlyArray1
	let monthlyArray2
	let monthlyArray3
	let monthlyArray4
	let accounts
	let tx_amt = 240
	beforeEach(async function() {
		/*
		 * accounts is a modification of what the csv will provide
		 * index 0 is an ethereum address
		 * index 1 is a value to be vested
		 * index 2 is the wallet object used in signing
		 */
		initialProvider = await ethers.getSigner()
		initialAddress = await initialProvider.getAddress()
		defaultProvider = initialProvider.provider
		accounts = [] //for testing, a 3d array where 0 is the address, 1 is the tx_amt, and 2 is the wallet object used to sign stuff
		for (let i = 0; i < 10; i++) {
			let wallet1 = ethers.Wallet.createRandom()
			wallet1 = wallet1.connect(defaultProvider)
			accounts.push([wallet1.address, tx_amt, wallet1])
			let fundUserTx = {
				value: ethers.utils.parseEther('1'),
				to: wallet1.address
			}
			let fundUser = await initialProvider.sendTransaction(fundUserTx)
			await fundUser.wait()
		}

		const Lumerin = await ethers.getContractFactory("Lumerin");
		lumerin = await Lumerin.deploy()
		await lumerin.deployed()
		const LumerinVesting = await ethers.getContractFactory("LumerinVestingMulti");
		monthlyArray1 = makeArray(24, 10)
		monthlyArray2 = makeArray(24, 15)
		monthlyArray3 = makeArray(24, 15)
		monthlyArray3 = makeArray(24, 15)
		lumerinVesting = await LumerinVesting.deploy(
			lumerin.address,
			//the previous 2 items should add up to the purchase during tranche 2
			monthlyArray1, //timestamps of each vesting event
			monthlyArray2, //timestamps of each vesting event
			monthlyArray3, //timestamps of each vesting event
			monthlyArray4, //timestamps of each vesting event
		)
		console.log("sucessful deployment")
		await lumerinVesting.deployed()
		//used to test bulk import of values
		console.log('lumerin deployed to: ', lumerin.address)
		console.log('fast token drop deployed to: ', lumerinVesting.address)
		await lumerin.transfer(lumerinVesting.address, lumerin.balanceOf(initialAddress))
		let lumerinVestingBalance = await lumerin.balanceOf(lumerinVesting.address)
		let totalLumerinBalance = await lumerin.totalSupply()
		expect(Number(lumerinVestingBalance)).to.equal(Number(totalLumerinBalance))


	})
	it("load 1 account and see if you can claim properly", async function () {
		// determine which account to use and set values
		let account = accounts[0]
		let address = account[0]
		console.log("address is:", address)
		let vestingAmount = account[1]
		let wallet = account[2]

		//load the address into the LumerinVestingMulti contract
		let loadContract = await lumerinVesting.setAddAddressToVestingSchedule(address, 0, vestingAmount)
		loadContract = await loadContract.wait()

		let fundUserTx = {
			value: ethers.utils.parseEther('1'),
			to: address
		}
		let fundUser = await initialProvider.sendTransaction(fundUserTx)
		await fundUser.wait()

		for (let i = 0; i < monthlyArray1.length; i++) {
			//call the releaseTest function on the vesting contract
			console.log("current i is: ",i)
			let currentMonths = await lumerinVesting.connect(wallet).releaseTest(monthlyArray1[i])
			//wait for the release call to finish
			currentMonths = await currentMonths.wait()
			let walletlmr = await lumerin.balanceOf(address)
			let expectedlmr = tx_amt*(i+1)/24
			//check the lumerin balance of the wallet
			expect(Number(walletlmr), `expected ${expectedlmr}, but got ${walletlmr}`).to.equal(Number(expectedlmr))
		}

		//cycle through all months in vestingMonths0 and ensure they can claim the proper amount
	})
	it("load 2 accounts with different schedules and see if you can claim properly", async function () {
		// determine which account to use and set values
		let account1 = accounts[0]
		let address1 = account1[0]
		console.log("address is:", address1)
		let vestingAmount1 = account1[1]
		let wallet1 = account1[2]

		let account2 = accounts[1]
		let address2 = account2[0]
		console.log("address is:", address2)
		let vestingAmount2 = account2[1]
		let wallet2 = account2[2]

		//load address1 into the LumerinVestingMulti contract
		let loadContract1 = await lumerinVesting.setAddAddressToVestingSchedule(address1, 0, vestingAmount1)
		loadContract1 = await loadContract1.wait()
		
		//load address2 into the LumerinVestingMulti contract
		let loadContract2 = await lumerinVesting.setAddAddressToVestingSchedule(address2, 1, vestingAmount2)
		loadContract2 = await loadContract2.wait()


		let fundUserTx1 = {
			value: ethers.utils.parseEther('1'),
			to: address1
		}
		let fundUserTx2 = {
			value: ethers.utils.parseEther('1'),
			to: address2
		}
		let fundUser1 = await initialProvider.sendTransaction(fundUserTx1)
		await fundUser1.wait()
		let fundUser2 = await initialProvider.sendTransaction(fundUserTx2)
		await fundUser2.wait()

		for (let i = 0; i < monthlyArray1.length; i++) {
			//call the releaseTest function on the vesting contract
			console.log("current i is: ",i)
			let currentMonths = await lumerinVesting.connect(wallet1).releaseTest(monthlyArray1[i])
			//wait for the release call to finish
			currentMonths = await currentMonths.wait()
			let walletlmr = await lumerin.balanceOf(address1)
			let expectedlmr = tx_amt*(i+1)/24
			//check the lumerin balance of the wallet
			expect(Number(walletlmr), `expected ${expectedlmr}, but got ${walletlmr}`).to.equal(Number(expectedlmr))
		}

		for (let i = 0; i < monthlyArray2.length; i++) {
			//call the releaseTest function on the vesting contract
			console.log("current i is: ",i)
			let currentMonths = await lumerinVesting.connect(wallet2).releaseTest(monthlyArray2[i])
			//wait for the release call to finish
			currentMonths = await currentMonths.wait()
			let walletlmr = await lumerin.balanceOf(address2)
			let expectedlmr = tx_amt*(i+1)/24
			//check the lumerin balance of the wallet
			expect(Number(walletlmr), `expected ${expectedlmr}, but got ${walletlmr}`).to.equal(Number(expectedlmr))
		}

		//cycle through all months in vestingMonths0 and ensure they can claim the proper amount
	})
	it("load multiple accounts with same schedule and see if you can claim properly", async function () {
			// determine which account to use and set values
		let i = 1
		for (let account of accounts) {
			let address = account[0]
			console.log("address is:", address)
			let vestingAmount = account[1]

			//load the address into the LumerinVestingMulti contract
			let loadContract = await lumerinVesting.setAddAddressToVestingSchedule(address, 0, vestingAmount*i)
			loadContract = await loadContract.wait()
			i++
			let fundUserTx = {
				value: ethers.utils.parseEther('1'),
				to: address
			}
			let fundUser = await initialProvider.sendTransaction(fundUserTx)
			await fundUser.wait()
		}


		let j = 1
		for (let account of accounts) {
			for (let i = 0; i < monthlyArray1.length; i++) {
				//call the releaseTest function on the vesting contract
				console.log("current i is: ",i)
				let currentMonths = await lumerinVesting.connect(account[2]).releaseTest(monthlyArray1[i])
				//wait for the release call to finish
				currentMonths = await currentMonths.wait()
				let walletlmr = await lumerin.balanceOf(account[0])
				let expectedlmr = account[1]*j*(i+1)/24
				//check the lumerin balance of the wallet
				expect(Number(walletlmr), `expected ${expectedlmr}, but got ${walletlmr}`).to.equal(Number(expectedlmr))
			}
			j++
		}

		//cycle through all months in vestingMonths0 and ensure they can claim the proper amount
})
	it("load multiple accounts with different schedules and see if you can claim properly", async function () {
			// determine which account to use and set values
		let i = 1
		for (let account of accounts) {
			let address = account[0]
			console.log("address is:", address)
			let vestingAmount = account[1]

			//load the address into the LumerinVestingMulti contract
			let chooseSchedule = i%2==0
			let loadContract = await lumerinVesting.setAddAddressToVestingSchedule(address, chooseSchedule, vestingAmount*i)
			loadContract = await loadContract.wait()
			i++
			let fundUserTx = {
				value: ethers.utils.parseEther('1'),
				to: address
			}
			let fundUser = await initialProvider.sendTransaction(fundUserTx)
			await fundUser.wait()
		}


		let j = 1
		for (let account of accounts) {
			let chooseSchedule = j%2
			let schedule
			if (chooseSchedule) {
				schedule = monthlyArray1
			} else {
				schedule = monthlyArray2
			}
			for (let i = 0; i < schedule.length; i++) {
				//call the releaseTest function on the vesting contract
				console.log("current i is: ",i)
				let currentMonths = await lumerinVesting.connect(account[2]).releaseTest(schedule[i])
				//wait for the release call to finish
				currentMonths = await currentMonths.wait()
				let walletlmr = await lumerin.balanceOf(account[0])
				let expectedlmr = account[1]*j*(i+1)/24
				//check the lumerin balance of the wallet
				expect(Number(walletlmr), `expected ${expectedlmr}, but got ${walletlmr}`).to.equal(Number(expectedlmr))
			}
			j++
		}

		//cycle through all months in vestingMonths0 and ensure they can claim the proper amount
	})
});
