let fs = require('fs')
let {exec} = require('child_process')
let sleep = require('sleep')
let validatorAddress = "0xD12b787E2F318448AE2Fd04e51540c9cBF822e89";

function getContractJSON(name) {
	let path = `./build/contracts/${name}.json`;
	let contractRaw = fs.readFileSync(path);
	let contract = JSON.parse(contractRaw)
	return contract
}

function createContractObject(web3, name) {
	let contract = getContractJSON(name)
	let contractAddress = contract.networks['5777']['address']
	let contractABI = contract.abi
	return new web3.eth.Contract(contractABI, contractAddress)
}

async function callCommand(cmd) {
	exec(cmd, (error, sout, serr) => {
		if (error) {
			console.log(`error when calling exec when calling ${cmd}: ${error}`)
		} else {
			sleep.sleep(10)
		}
	return sout
	}) 
}


async function getBlock(web3) {
	let block;
	while (true) {
		try {
			await web3.eth.getBlockNumber().then(r => block = parseInt(r))
			break
		} catch (err) {
			console.log(`error getting block number: ${err}`)
			sleep.sleep(1)
		}
	}
	return block
}


async function waitForBlock(n, startingBlock, web3) {
	while (true) {
		let currentBlock;
		await getBlock(web3).then(r => currentBlock = parseInt(r))
		if (currentBlock - startingBlock >= n) {
			break
		} else {
			sleep.sleep(1)
		}
	}
	return 0
}

async function purchaseContract(hashrateContract, buyerAddress, withValidator, expectPurchaseError, customFee) {
	let ipAddress = "127.0.0.1";
	let username = "titan";
	let password = "can I have a raise please"
	let result;
	let validationFee = 0;
	if (withValidator) {
		validationFee = 100
	} else if (customFee > 0) {
		validationFee = customFee
	}
	await contractSendFunction(
		hashrateContract.methods.setPurchaseContract, 
		buyerAddress, 
		[ipAddress, username, password, buyerAddress, validatorAddress, withValidator],
		expectPurchaseError,
		validationFee
	).then(r => result = r)
	return result
}

async function contractCallFunction(contractCall, args) {
	//args is a list of variables, which is optional
	let success = false;
	let result;
	while (!success) {
		try {
			if (args) {
				await contractCall(...args).call().then(r => result = r)
			} else {
				await contractCall().call().then(r => result = r)
			}
			success = true
		} catch (err) {
			console.log(`error calling call function: ${err}`)
			sleep.sleep(1)
		}
	}
	return result
}


async function contractSendFunction(contractCall, seller, args, expectError=false, fee=0) {
	//args is a list of variables, which is optional
	let success = false;
	let result;
	while (!success) {
		try {
			let send;
			if (fee != 0) {
				send = {from: seller, gas: 1000000, value: fee}
			} else {
				send = {from: seller, gas: 1000000}
			}
			if (args) {
				await contractCall(...args).send(send).then(r => result = r)
			} else {
				await contractCall().send(send).then(r => result = r)
			}
			success = true
		} catch (err) {
			if (String(err).includes("reverted by the EVM")) {
				console.log('evm reverted')
				result = "Expected Error"
				success = true
			} else {
				sleep.sleep(1)
			}
		}
	}
	return result
}


//contractIndex is int
//withValidator is true
async function genericPurchaseContract(
								web3, 
								ledger, 
								buyerAddress, 
								sellerAddress, 
								hashrateContractAddress, 
								token, 
								contractIndex, 
								withValidator,
								halfLmn = false,
								expectPurchaseError = false,
								customFee = false
	) {
	let hashrateContract;
	let sellerLumerin;
	let buyerLumerin;
	let contractPrice;
	let blockWait = 1;
	let purchaseBlock;
	let mutex;

	let contract = getContractJSON('Implementation');
	hashrateContract = new web3.eth.Contract(contract.abi, hashrateContractAddress)

	await purchaseContract(hashrateContract, buyerAddress, withValidator, expectPurchaseError, customFee).then(r => mutex = r)
	if (mutex == "Expected Error") { //fails early if mutex is an expected error
		returnObject = {
			i0: hashrateContract,
			i1: sellerLumerin,
			i2: buyerLumerin,
			i3: contractPrice,
			i4: purchaseBlock,
		}
		return returnObject
	}

	await contractCallFunction(hashrateContract.methods.price).then(r => contractPrice = r)
	contractPrice = parseInt(contractPrice)

	if (halfLmn) { contractPrice = parseInt(contractPrice/2)}

	//transfering tokens from buyer to contract
	await contractSendFunction(
		token.methods.transfer, 
		buyerAddress, 
		[hashrateContractAddress,parseInt(contractPrice)]
	).then(r => purchaseBlock = parseInt(r["blockNumber"]))

	await contractSendFunction(
		hashrateContract.methods.setFundContract,
		buyerAddress
	).then(r => mutex = r)

	await contractCallFunction(token.methods.balanceOf, [sellerAddress]).then(r => sellerLumerin =r)
	await contractCallFunction(token.methods.balanceOf, [buyerAddress]).then(r => buyerLumerin =r)

	
	returnObject = {
		i0: hashrateContract,
		i1: sellerLumerin,
		i2: buyerLumerin,
		i3: contractPrice,
		i4: purchaseBlock,
	}
	return returnObject
}

module.exports.getBlock = getBlock
module.exports.waitForBlock = waitForBlock
module.exports.contractCallFunction = contractCallFunction
module.exports.contractSendFunction = contractSendFunction
module.exports.genericPurchaseContract = genericPurchaseContract
module.exports.createContractObject = createContractObject
module.exports.callCommand = callCommand
