let fs = require('fs')

let fastLumerinDrop
let lumerin

async function setFastLumerinDropAndLumerin(fldAddress, lAddress) {
	const FastLumerinDrop = await ethers.getContractFactory("FastLumerinDrop");
	fastLumerinDrop = FastLumerinDrop.attach(fldAddress)
	const Lumerin = await ethers.getContractFactory("Lumerin");
	lumerin = Lumerin.attach(lAddress)
	return [fastLumerinDrop, lumerin]
}


async function sendLumerinToFastTokenDrop(lumerinAmount, fld, lumerin = lumerin) {
	await lumerin.transfer(fld.address, lumerinAmount)
	return true
}

async function checkIfAddressIsInTokenDrop(address, fastLumerinDrop=fastLumerinDrop) {
	let isWalletAdded
	await fastLumerinDrop.checkWallet(address).then(x => isWalletAdded = x)
	return isWalletAdded
}

async function addIndividualAddressToFastTokenDrop(
	address, value, fastLumerinDrop=fastLumerinDrop
) {
	
	await fastLumerinDrop.addWallet(address, value)
}

async function addMultipleAddressesToFastTokenDrop(
	addresses, values, fastLumerinDrop=fastLumerinDrop, upload_length =200 
) {
	if (addresses.length != values.length) {
		return false
	}
	for (let i = 0; i < addresses.length; i = i+upload_length) {
		let j
		if (i+upload_length >= addresses.length) {
			j = addresses.length
		} else {
			j = i+upload_length
		}

		let _addresses = addresses.slice(i, j)
		let _values = values.slice(i, j)
		await fastLumerinDrop.addMultiWallet(_addresses, _values)
	}
}

function obtainListOfAddresses(fname) {
	let addresses = []
	let dropValues = []
	let vestingValues = []
	let trancheValues = []
	let csv_file = fs.readFileSync(fname)
	csv_file = csv_file.toString()
	csv_file = csv_file.split('\n')
	for (let line of csv_file) {
		if (line != '') {
		let row = line.split(',')
		addresses.push(row[0])
		vestingValues.push(row[1])
		trancheValues.push(row[2])
		}
	}
	let vestingNumbers = []
	for (n of vestingValues) {
		let x = Number(n)
		x = x*10**8
		x = x.toFixed(0)
		vestingNumbers.push(x)
	}
	return [addresses, vestingNumbers, trancheValues]
}

module.exports.setFastLumerinDropAndLumerin = setFastLumerinDropAndLumerin
module.exports.sendLumerinToFastTokenDrop = sendLumerinToFastTokenDrop
module.exports.addIndividualAddressToFastTokenDrop = addIndividualAddressToFastTokenDrop
module.exports.addMultipleAddressesToFastTokenDrop = addMultipleAddressesToFastTokenDrop
module.exports.obtainListOfAddresses = obtainListOfAddresses
