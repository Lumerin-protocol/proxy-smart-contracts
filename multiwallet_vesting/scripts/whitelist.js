let { ethers } = require("hardhat");
let scripts = require('./main.js')




function getAddressLists(f) {
	csv_read = scripts.obtainListOfAddresses(f)
	return [addresses, dropValues]
}

function makeArray(len, ) {
	let initialArray = []
	for (let i = 0; i < len; i++) {
		initialArray.push(true)
	}
	return initialArray
}

//function to add the whitelist values to the multi vesting conract
async function populateWhiteList(fastlmn = null, lmn = null, wallets = null, tranche='tranche1') {

	/*for testing, a 3d array where 0 is the address, 
	 * 1 is the tx_amt, and 2 is the wallet object used to sign stuff
	 */
	//let initialProvider = await ethers.getSigner()
	//let defaultProvider = initialProvider.provider

	let vestingAddr
	let lmnAddr

	//determening what the actual address should be on eth
	if (fastlmn) { vestingAddr = fastlmn } else { vestingAddr = '' }
	if (lmn) { lmnAddr = lmn } else { lmnAddr = '' }
	
	let FastLumerinDrop = await ethers.getContractFactory("LumerinVestingMulti");
	//input the mainnet address here
	let tokenDrop = FastLumerinDrop.attach(vestingAddr) //mainnet

	//let csvFiles = ['tranche1', 'tranche2', 'trancheSeed', 'trancheCorporate']
	let csvFiles = [tranche]

	for (let f of csvFiles) {
		let fileName = `./scripts/${f}Condensed.csv`
		let csvData = scripts.obtainListOfAddresses(fileName)
		//potentially creating fake addresses to use with vesting
		let accounts = []
		if (wallets) {
			for (let wallet of wallets.slice(0, csvData[0].length)) {
				accounts.push(wallet[0])
			}
		} else {
			accounts = csvData[0]
		}
		let numbers = csvData[1].slice(0, accounts.length) //slice to keep as same size of accounts
		let vestingSchedule = csvData[2].slice(0, accounts.length) //slice to keep size of accounts
		let inc = 400
		for (let i = 0; i < accounts.length; i+=inc) {
			let j
			if (i+j >= accounts.length) { j = accounts.length } else {j = i+inc}
			let loadContract = await tokenDrop.setAddMultiAddressToVestingSchedule(
				accounts.slice(i, j-1),
				vestingSchedule.slice(i, j-1),
				numbers.slice(i, j-1)
			)
			loadContract = await loadContract.wait()
		}
	}
	return true
}

module.exports.populateWhiteList = populateWhiteList
populateWhiteList()
