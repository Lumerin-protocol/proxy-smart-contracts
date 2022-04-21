let fs = require('fs')
let {
    exec
} = require('child_process')
let sleep = require('sleep')

//const encryption = require('./enrypt.js')

function getConfigParams() {
	configRaw = fs.readFileSync('test/config.json')
	config = JSON.parse(configRaw)
	return config
}

function getContractJSON(name) {
    let path = `./build/contracts/${name}.json`;
    let contractRaw = fs.readFileSync(path);
    let contract = JSON.parse(contractRaw)
    return contract
}

function createContractObject(web3, name, network) {
	let x
	if (network == "development") {
		x = '5777'
	} else {
		x = '3'
	}
    let contract = getContractJSON(name)
    let contractAddress = contract.networks[x]['address'] 
    let contractABI = contract.abi
    return new web3.eth.Contract(contractABI, contractAddress)
}

function createLumerin(web3, network) {
    let contract = getContractJSON('Lumerin')
	let address
    let contractABI = contract.abi
	if (network == "development") {
    address = contract.networks['5777']['address'] 
	} else {
		address = '0x84E00a18a36dFa31560aC216da1A9bef2164647D'
	}
    return new web3.eth.Contract(contractABI, address)
}

async function callCommand(cmd) {
    exec(cmd, (error, sout, _) => {
        if (error) {
            console.log(`error when calling exec when calling ${cmd}: ${error}`)
        } else {
            sleep.sleep(1)
        }
        return sout
    })
}

async function defundAddress(tokenContract, owner, spender) {
	let allowance;
	let res;
	await getPreApprovedAmount(tokenContract, owner, spender).then( r => allowance = r)
    await contractSendFunction(
        tokenContract.methods.decreaseAllowance,
        owner,
        [spender, allowance]
    ).then( r => res = r)
	return res
}


async function preApproveLumerin(tokenContract, amount, recipient, from) {
	let x
	console.log('preapproving lumerin')
    await contractSendFunction(
        tokenContract.methods.increaseAllowance,
        from,
        [recipient, amount]
    ).then(r => x = r)
	console.log('lumerin pre-approved')
}

async function getBlock(web3) {
    let block;
    while (true) {
        try {
            await web3.eth.getBlockNumber().then(r => block = parseInt(r))
            break
        } catch (err) {
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

async function purchaseContract(cloneFactory, contractAddress, sender, fail=false) {
    encryptedData = "josh is great"

    let result;
    console.log('inside purchaseContract')
    await contractSendFunction(
        cloneFactory.methods.setPurchaseRentalContract,
        sender,
        [contractAddress, encryptedData],
	    false
    ).then(r => result = r)
    console.log('contract purchased')
    return result
}

async function getContractDuration(web3, contractAddress) {
    let contractABI = getContractJSON('Implementation')
    contract = new web3.eth.Contract(contractABI.abi, contractAddress)
    let length;
    await contractCallFunction(contract.methods.length).then(r => length = r)
    return length
}


async function getContractState(web3, contractAddress) {
    let contractABI = getContractJSON('Implementation')
    contract = new web3.eth.Contract(contractABI.abi, contractAddress)
    let contractState;
    await contractCallFunction(contract.methods.contractState).then(r => contractState = r)
    return contractState
}

async function getContractCP(web3, contractAddress) {
    let contractABI = getContractJSON('Implementation')
    contract = new web3.eth.Contract(contractABI.abi, contractAddress)
    let encryptedPoolData;
    await contractCallFunction(contract.methods.encryptedPoolData).then(r => encryptedPoolData = r)
    return encryptedPoolData
}

async function getContractPurchaseInfo(web3, contractAddress) {
    let contractABI = getContractJSON('Implementation')
	let purchaseInfo = {};
    contract = new web3.eth.Contract(contractABI.abi, contractAddress)
    await contractCallFunction(contract.methods.price).then(r => purchaseInfo.price = r)
    await contractCallFunction(contract.methods.limit).then(r => purchaseInfo.limit = r)
    await contractCallFunction(contract.methods.speed).then(r => purchaseInfo.speed = r)
    await contractCallFunction(contract.methods.length).then(r => purchaseInfo.length = r)
    return purchaseInfo
}


async function getContractPrice(web3, contractAddress) {
    let contractABI = getContractJSON('Implementation')
    contract = new web3.eth.Contract(contractABI.abi, contractAddress)
    let price;
    await contractCallFunction(contract.methods.price).then(r => price = r)
    return price
}

async function getLumerinValue(Lumerin, Address) {
    let value;
    await contractCallFunction(
        Lumerin.methods.balanceOf,
        [Address]
    ).then(r => value = r)
    return value
}

async function getPreApprovedAmount(Lumerin, owner, spender) {
    let value;
    await contractCallFunction(
        Lumerin.methods.allowance,
        [owner, spender]
    ).then(r => value = r)
    return value
}


async function setContractCloseOut(web3, contractAddress, caller, closeoutMethod, fail = false) {
    console.log('beginning contract closeout')
    let contractABI = getContractJSON('Implementation')
    let result;
    contract = new web3.eth.Contract(contractABI.abi, contractAddress)
    await contractSendFunction(
        contract.methods.setContractCloseOut,
        caller,
        [closeoutMethod],
        fail
    ).then(r => result = r);
    console.log('contract closeout complete')
    return result
}

async function setUpdatePurchaseData(web3, contractAddress, caller, purchaseInfo, fail = false) {
	//ensure that purchaseInfo is always 4 items
    console.log('beginning contract closeout')
    let contractABI = getContractJSON('Implementation')
    let result;
    contract = new web3.eth.Contract(contractABI.abi, contractAddress)
    await contractSendFunction(
        contract.methods.setUpdatePurchaseInformation,
        caller,
	    purchaseInfo,
        fail
    ).then(r => result = r);
    console.log('contract closeout complete')
    return result
}


async function setUpdatePoolData(web3, contractAddress, caller, poolData, fail = false) {
    console.log('beginning contract closeout')
    let contractABI = getContractJSON('Implementation')
    let result;
    contract = new web3.eth.Contract(contractABI.abi, contractAddress)
    await contractSendFunction(
        contract.methods.setUpdateMiningInformation,
        caller,
        [poolData],
        fail
    ).then(r => result = r);
    console.log('contract closeout complete')
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

async function contractSendFunction(contractCall, seller, args, fail = false) {
    //args is a list of variables, which is optional
    let success = false;
    let result = false;
    while (!success) {
        try {
            let send = {
                from: seller,
                gas: 10000000
            }
            if (args) {
                //await contractCall(...args).send(send).on('transactionHash',console.log).on('error', console.log).on('receipt', r => result = r)
                await contractCall(...args).send(send).on('error', r => {
			console.log(r)
			result = true
		}).on('receipt', r => result = r)
                //await contractCall(...args).send(send).on('receipt', r => result = r)
            } else {
                await contractCall().send(send).on('transactionHash',console.log).on('error', console.log).on('receipt',r => result = r)
                //await contractCall().send(send).on('receipt',r => result = r)
            }
            success = true
        } catch (err) {
            if (fail == true && String(err).includes("reverted by the EVM")) {
                    console.log(`EVM reverted: ${err}`)
		    success = true
            } else if (String(err).includes("sender account")) {
                console.log(`ERROR_INFO_:${err}`)
                return "Unexpected Error"

            } else {
                console.log(`ERROR_OTHER_:${err}`)
            }
            sleep.sleep(1)
        }
    }
    return result
}

module.exports.getBlock = getBlock
module.exports.getConfigParams = getConfigParams
module.exports.defundAddress = defundAddress
module.exports.getLumerinValue = getLumerinValue
module.exports.setContractCloseout = setContractCloseOut
module.exports.getContractPrice = getContractPrice
module.exports.getContractCP = getContractCP
module.exports.getContractPurchaseInfo = getContractPurchaseInfo
module.exports.getPreApprovedAmount = getPreApprovedAmount
module.exports.setUpdatePoolData = setUpdatePoolData
module.exports.setUpdatePurchaseData = setUpdatePurchaseData
module.exports.getContractState = getContractState
module.exports.getContractDuration = getContractDuration
module.exports.preApproveLumerin = preApproveLumerin
module.exports.waitForBlock = waitForBlock
module.exports.contractCallFunction = contractCallFunction
module.exports.contractSendFunction = contractSendFunction
module.exports.purchaseContract = purchaseContract
module.exports.createContractObject = createContractObject
module.exports.createLumerin = createLumerin
module.exports.callCommand = callCommand
