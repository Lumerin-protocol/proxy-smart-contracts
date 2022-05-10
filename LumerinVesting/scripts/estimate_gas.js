let { ethers } = require("hardhat");
let scripts = require('./main.js')

async function deployContracts() {
	//too lazy to change contract variable names lol
	let initialProvider = await ethers.getSigner()
	let defaultProvider = initialProvider.provider
	let accounts = []
	let wallet = ethers.Wallet.createRandom()
	wallet = wallet.connect(defaultProvider)
	accounts.push([wallet.address, 240, wallet])
	let Lumerin = await ethers.getContractFactory("Lumerin");
	let lumerin = await Lumerin.deploy()
	await lumerin.deployed()
	const LumerinVesting = await ethers.getContractFactory("LumerinVesting");
	let account = accounts[0]
	let lumerinVesting = await LumerinVesting.deploy(
		account[0], //address to claim vesting balances
		lumerin.address,
		account[1], //duration is how long the vesting contract lasts
		//the previous 2 items should add up to the purchase during tranche 2
		[1,2,3] //timestamps of each vesting event
	)
	await lumerinVesting.deployed()
	await lumerin.transfer(lumerinVesting.address, account[1])
	return [lumerin, lumerinVesting, wallet]
}

async function originalMethodGasCost() {
	let contracts = await deployContracts()
	let lumerin = contracts[0]
	let tokenDrop = contracts[1]
	let unlockTxFee = await tokenDrop.estimateGas.releaseTest(1)
	console.log(`release test function gas cost: ${unlockTxFee}`)
}

async function alternateMethodGasCost() {
	let contracts = await deployContracts()
	let lumerin = contracts[0]
	let tokenDrop = contracts[1]
	let unlockTxFee = await tokenDrop.estimateGas.releaseTestAlternate(1)
	console.log(`release test alternate function gas cost: ${unlockTxFee}`)
}

originalMethodGasCost()
alternateMethodGasCost()

