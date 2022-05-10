let { ethers } = require("hardhat");
let scripts = require('./main.js')




function getAddressLists() {
	let addresses = []
	let values = []
	csv_read = scripts.obtainListOfAddresses('./scripts/4-28-22-bandaid.csv')
	addresses = csv_read[0]
	values = csv_read[1]
	return [addresses, values]
}


async function populateWhiteList() {
	let FastLumerinDrop = await ethers.getContractFactory("FastLumerinDrop");
	let tokenDrop = FastLumerinDrop.attach('0xadc9939dfbff74926c375647f1ec42e881994b0e') //mainnet
	let csv_values = getAddressLists()
	let addresses = csv_values[0]
	let values = csv_values[1]
	let num_values = []
	for (let v of values) {
		let n = Math.floor(Number(v)*10**8)
		num_values.push(n)
	}

	//await scripts.addMultipleAddressesToFastTokenDrop(addresses, num_values, tokenDrop)
	//await tokenDrop.addMultiWallet(addresses.slice(0, 320), num_values.slice(0, 320))
	await tokenDrop.addMultiWallet(addresses.slice(320, addresses.length), num_values.slice(320, num_values.length))
}

console.log(ethers)
//populateWhiteList()
