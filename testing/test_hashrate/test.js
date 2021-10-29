let assert= require('assert')
let fs = require('fs')
let {exec} = require('child_process')
let Web3 = require('web3') //web3.js library used to interact with blockchain
let sleep = require('sleep')
let tools = require('./tools.js')
let validatorAddress = "0xD12b787E2F318448AE2Fd04e51540c9cBF822e89";
let encryption = require('./enrypt.js')


//before all the tests run, they should 
//the contracts are compiled once
//migrated to the ethereum blockchain
//the sellerAddress sends the buyerAddress 20000 lmn
//
//before each test, the following should happen
//a new hashrate contract is created
//the buyerLMN and sellerLMN count are recorded


//all testing will take place on a fresh contract deployment
describe('tests to ensure contracts uploaded successfully', function() {
	this.timeout(120000)
	let web3, hashrateContractAddress, webfacing, clonefactory, ledger;
	let accounts, sellerAddress, buyerAddress, token;
	let mintingQuantity = 13;
	let ipAddress = "127.0.0.1";
	let username = "titan";
	let password = "can I have a raise please"

	//initialization of entire environment
	before('creating a web3 object', function() {
		//this is hard coded for now but will be modified to be taken from a config file
		web3 = new Web3('http://127.0.0.1:8545') 
	})

	before('compile smart contracts using truffle command', function() {
		tools.callCommand('truffle compile')
	})

	before('migrate smart contracts to network', function() { 
		//tools.callCommand('truffle migrate --reset')
		//sleep.sleep(65) //temp 60 second wait to ensure all contravts are deployed
	})

	before('create contract objects', function() {
		webfacing = tools.createContractObject(web3, 'WebFacing');
		clonefactory = tools.createContractObject(web3, 'CloneFactory');
		ledger = tools.createContractObject(web3, 'Ledger');
		token = tools.createContractObject(web3, 'Lumerin');
	})

	before('get contract list', async function() {
		await web3.eth.getAccounts().then(r => accounts = r);
		sellerAddress = accounts[0];
		buyerAddress = accounts[1];
	})

	let res;
	before('send tokens to buyerAddress', async function() {
		await tools.contractSendFunction(
				token.methods.transfer, 
				sellerAddress, 
				[buyerAddress, 2000]).then(r => res = r)
	})


	//creates a new hashrate contract for use in the test
	beforeEach('mint a new hashrate contract for the upcoming test', async function() {
		let done = false;
		await tools.contractSendFunction(
			webfacing.methods.setCreateRentalContract, 
			sellerAddress, 
			[100,100,20,10,100]
		).then(r =>hashrateContractAddress = r)
	})


	//checks to see if the address of the ledger, and clone factory
	//are what they're expected to be during the deployment process
	it('check to make sure contracts have correct addresses', function() {
		assert.equal(webfacing.options.address,JSON.parse(fs.readFileSync('contractAddresses.json')).webfacingAddress, "webfacing has a bad address")
		assert.equal(ledger.options.address, JSON.parse(fs.readFileSync('contractAddresses.json')).ledgerAddress, "ledger has a bad address")
		assert.equal(clonefactory.options.address, JSON.parse(fs.readFileSync('contractAddresses.json')).cloneFactoryAddress, "clonefactory has a bad address")
	})


	it('#purchase a contract with a validator. Closeout after contract completes', 
		async function() {
			//steps for test
			//1. purchase a contract
			//2. wait for the duration of the contract
			//3. call the contract closeout function
			//4. check to see if the contract is in a "complete" state
			//5. check to see if the contract is no longer funded
			//6. check to see if the seller has the lumeirn tokens
			let ini;
			let contractAddress;
			let contractPrice;
			let mutex;
			let hashrateContract;
			let sellerLumerinOriginal;
			let sellerLumerinAfter;
			let buyerLumerinOriginal;
			let buyerLumerinAfter;
			let contractLumerin;
			let contractState;
			let purchaseBlock;
			let closeOutBlock;
			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

			console.log('purchasing contract')
			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, true
			).then(r => ini = r)

			await tools.getBlock(web3).then(r => purchaseBlock = parseInt(r))
			hashrateContract = ini.i0
			sellerLumerinOriginal = ini.i1
			buyerLumerinOriginal = ini.i2
			contractPrice = ini.i3

			await tools.waitForBlock(20, purchaseBlock, web3).then(r => mutex = r)

			console.log('calling closeout')
			await tools.contractSendFunction(
				hashrateContract.methods.setContractCloseOut, 
				validatorAddress
			).then(r => mutex = r)
			console.log('contract closeout called')
			sleep.sleep(3)

			await tools.contractCallFunction(token.methods.balanceOf, [sellerAddress])
					.then(r => sellerLumerinAfter =r)
			await tools.contractCallFunction(token.methods.balanceOf, [buyerAddress])
					.then(r => buyerLumerinAfter =r)
			await tools.contractCallFunction(token.methods.balanceOf, [contractAddress])
					.then(r => contractLumerin =r)
			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =r)

			assert.equal(contractState, '3', `contract is not in a closed state: contract state: ${contractState}`)
			assert.equal(contractLumerin, '0', `contract is still funded: contract funds: ${contractLumerin}`)
			assert.equal(
				parseInt(buyerLumerinOriginal), 
				parseInt(buyerLumerinAfter), 
				'buyer received tokens'
			)
			assert.equal(
				parseInt(sellerLumerinOriginal) + contractPrice, 
				parseInt(sellerLumerinAfter), 
				'seller does not have contract price'
			)
		})

	it('#purchase a contract with a validator. Closeout 70% of the way done', 
		async function() {
			let ini,  contractAddress,  contractDuration,  contractPrice,  mutex;
			let hashrateContract,  sellerLumerinOriginal,  sellerLumerinAfter;
			let buyerLumerin,  buyerLumerinOriginal,  contractLumerin,  contractState;
			let purchaseBlock,  closeoutBlock;
			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

			console.log('calling contract purchase')
			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, true
			).then(r => ini = r)

			await tools.getBlock(web3).then(r => purchaseBlock = parseInt(r))
			hashrateContract = ini.i0
			sellerLumerinOriginal = ini.i1
			buyerLumerinOriginal = ini.i2
			contractPrice = ini.i3
			purchaseBlock = ini.i4

			await tools.waitForBlock(3, purchaseBlock, web3).then(r => mutex = r)

			console.log('calling closeout')
			await tools.contractSendFunction(
				hashrateContract.methods.setContractCloseOut, 
				validatorAddress
			).then(r => closeoutBlock = parseInt(r["blockNumber"]))

			await tools.contractCallFunction(token.methods.balanceOf, [sellerAddress])
					.then(r => sellerLumerinAfter =parseInt(r))
			await tools.contractCallFunction(token.methods.balanceOf, [buyerAddress])
					.then(r => buyerLumerinAfter =parseInt(r))
			await tools.contractCallFunction(token.methods.balanceOf, [contractAddress])
					.then(r => contractLumerin =parseInt(r))
			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))

			assert.equal(contractState, '3', 'contract is not in a closed state')
			assert.equal(contractLumerin, '0', 'contract is still funded')
			assert.equal(sellerLumerinAfter < sellerLumerinOriginal+contractPrice, true)
			assert.equal(buyerLumerinAfter > buyerLumerinOriginal, true)
	})
	it('#purchase a contract without a validator. Closeout after contract completes', async function() {
			let ini;
			let contractAddress;
			let contractPrice;
			let mutex;
			let hashrateContract;
			let sellerLumerinOriginal;
			let sellerLumerinAfter;
			let buyerLumerinOriginal;
			let buyerLumerinAfter;
			let contractLumerin;
			let contractState;
			let purchaseBlock;
			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, false
			).then(r => ini = r)

			await tools.getBlock(web3).then(r => purchaseBlock = parseInt(r))
			hashrateContract = ini.i0
			sellerLumerinOriginal = ini.i1
			buyerLumerinOriginal = ini.i2
			contractPrice = ini.i3

			await tools.waitForBlock(20, purchaseBlock, web3).then(r => mutex = r)

			await tools.contractSendFunction(
				hashrateContract.methods.setContractCloseOut, 
				buyerAddress
			).then(r => mutex = r)

			await tools.contractCallFunction(token.methods.balanceOf, [sellerAddress])
					.then(r => sellerLumerinAfter =r)
			await tools.contractCallFunction(token.methods.balanceOf, [buyerAddress])
					.then(r => buyerLumerinAfter =r)
			await tools.contractCallFunction(token.methods.balanceOf, [contractAddress])
					.then(r => contractLumerin =r)
			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =r)

			assert.equal(contractState, '3', `contract is not in a closed state: contract state: ${contractState}`)
			assert.equal(contractLumerin, '0', 'contract is still funded')
			assert.equal(
				parseInt(buyerLumerinOriginal), 
				parseInt(buyerLumerinAfter), 
				'buyer received tokens'
			)
			assert.equal(
				parseInt(sellerLumerinOriginal) + contractPrice, 
				parseInt(sellerLumerinAfter), 
				'seller does not have contract price'
			)
	})

	it('#purchase a contract without a validator. Closeout 70% of the way done', async function() {
			let ini,  contractAddress, contractPrice,  mutex;
			let hashrateContract,  sellerLumerinOriginal,  sellerLumerinAfter;
			let buyerLumerinOriginal,  contractLumerin,  contractState;
			let purchaseBlock;

		//get the contracts address to test
			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, false
			).then(r => ini = r)

			await tools.getBlock(web3).then(r => purchaseBlock = parseInt(r))
			hashrateContract = ini.i0
			sellerLumerinOriginal = ini.i1
			buyerLumerinOriginal = ini.i2
			contractPrice = ini.i3
			purchaseBlock = ini.i4

			await tools.waitForBlock(3, purchaseBlock, web3).then(r => mutex = r)

			await tools.contractSendFunction(
				hashrateContract.methods.setContractCloseOut, 
				buyerAddress
			).then(r => closeoutBlock = parseInt(r["blockNumber"]))

			await tools.contractCallFunction(token.methods.balanceOf, [sellerAddress])
					.then(r => sellerLumerinAfter =parseInt(r))
			await tools.contractCallFunction(token.methods.balanceOf, [buyerAddress])
					.then(r => buyerLumerinAfter =parseInt(r))
			await tools.contractCallFunction(token.methods.balanceOf, [contractAddress])
					.then(r => contractLumerin =parseInt(r))
			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))

			assert.equal(contractState, '3', `contract is not in a closed state: contract state: ${contractState}`)
			assert.equal(contractLumerin, '0', 'contract is still funded')
			assert.equal(sellerLumerinAfter < sellerLumerinOriginal+contractPrice, true)
			assert.equal(buyerLumerinAfter > buyerLumerinOriginal, true)
	})
	it('purchase a contract with a validator. fail to send enough lumerin', async function() {
			//steps for test
			//1. purchase a contract with half the lumerin
			//2. check to see if the contract is still running
			let ini;
			let contractAddress;
			let mutex;
			let hashrateContract;
			let contractState;

			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

		console.log('calling purchase')
			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, true, true, true
			).then(r => ini = r)
			hashrateContract = ini.i0

			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))


			assert.equal(contractState, '0', `contract is not in a available state: contract state: ${contractState}`)
	})
	it('purchase a contract without a validator. fail to send enough lumerin', async function() {
			//steps for test
			//1. purchase a contract with half the lumerin
			//2. check to see if the contract is still running
			let ini;
			let contractAddress;
			let mutex;
			let hashrateContract;
			let contractState;
			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

		console.log('calling purchase')
			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, false, true, true
			).then(r => ini = r)
			hashrateContract = ini.i0


			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))

			assert.equal(contractState, '0', `contract is not in a available state: contract state: ${contractState}`)
	})

	it('#purchase a contract with a validator. fail to send validation fee', async function() {
			let ini;
			let contractAddress;
			let mutex;
			let hashrateContract;
			let contractState;
			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

		console.log('calling purchase')
			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, false, true, true, 1
			).then(r => ini = r)
			hashrateContract = ini.i0


			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))

			assert.equal(contractState, '0', `contract is not in a available state: contract state: ${contractState}`)
	})


	it('#purchase a contract with a validator. send double the expected lumerin', async function() {
			let ini;
			let contractAddress;
			let mutex;
			let hashrateContract;
			let contractLumerin;
			let contractState;
			let purchaseBlock;
			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

		console.log('calling purchase')
			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, false, true, true, 1, doubleLumerin=2
			).then(r => ini = r)
			await tools.getBlock(web3).then(r => purchaseBlock = parseInt(r))
			hashrateContract = ini.i0

		console.log('contract purchased')
			await tools.waitForBlock(10, purchaseBlock, web3).then(r => mutex = r)

		console.log('calling closeout')
			await tools.contractSendFunction(
				hashrateContract.methods.setContractCloseOut, 
				buyerAddress
			).then(r => closeOutBlock = parseInt(r["blockNumber"]))
		console.log('called closeout')

			await tools.contractCallFunction(token.methods.balanceOf, [sellerAddress])
					.then(r => sellerLumerinAfter =parseInt(r))
			await tools.contractCallFunction(token.methods.balanceOf, [buyerAddress])
					.then(r => buyerLumerinAfter =parseInt(r))
			await tools.contractCallFunction(token.methods.balanceOf, [contractAddress])
					.then(r => contractLumerin =parseInt(r))
			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))

			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))

			assert.equal(contractState, '3', `contract is not in a closed state: contract state: ${contractState}`)
			assert.equal(contractLumerin, '0', 'contract is still funded')
		/*
		 * write tests to ensure that overpayment is 
		 * sent where it is supposed to be sent
		 */
	})

	it('#purchase a contract without a validator. send double the expected lumerin', async function() {
			let ini;
			let contractAddress;
			let mutex;
			let hashrateContract;
			let contractState;
			let purchaseBlock;
			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

		console.log('calling purchase')
			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, false, true, true, 1, doubleLumerin=2
			).then(r => ini = r)
			hashrateContract = ini.i0

			await tools.getBlock(web3).then(r => purchaseBlock = parseInt(r))
			await tools.waitForBlock(10, purchaseBlock, web3).then(r => mutex = r)

			await tools.contractSendFunction(
				hashrateContract.methods.setContractCloseOut, 
				buyerAddress
			).then(r => closeOutBlock = parseInt(r["blockNumber"]))

			await tools.contractCallFunction(token.methods.balanceOf, [sellerAddress])
					.then(r => sellerLumerinAfter =parseInt(r))
			await tools.contractCallFunction(token.methods.balanceOf, [buyerAddress])
					.then(r => buyerLumerinAfter =parseInt(r))
			await tools.contractCallFunction(token.methods.balanceOf, [contractAddress])
					.then(r => contractLumerin =parseInt(r))
			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))

			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))


			await tools.contractCallFunction(hashrateContract.methods.contractState)
					.then(r => contractState =parseInt(r))

			assert.equal(contractState, '3', `contract is not in a closed state: contract state: ${contractState}`)
			assert.equal(contractLumerin, '0', 'contract is still funded')
		/*
		 * write tests to ensure that overpayment is 
		 * sent where it is supposed to be sent
		 */
	})

	it('#purchase a contract and verify that data is encrypted successfully', async function() {
				//steps for test
			//1. purchase a contract
			//2. wait for the duration of the contract
			//3. call the contract closeout function
			//4. check to see if the contract is in a "complete" state
			//5. check to see if the contract is no longer funded
			//6. check to see if the seller has the lumeirn tokens
			let ini;
			let contractAddress;
			let hashrateContract;
			let purchaseBlock;
		let poolData;
			await tools.contractCallFunction(webfacing.methods.getListOfContracts).then(
				r => contractAddress = r)
			contractAddress = contractAddress[contractAddress.length -1]

			await tools.genericPurchaseContract(
			web3, ledger, buyerAddress, sellerAddress, contractAddress, token, 0, true
			).then(r => ini = r)

			await tools.getBlock(web3).then(r => purchaseBlock = parseInt(r))

			hashrateContract = ini.i0

			await tools.waitForBlock(3, purchaseBlock, web3).then(r => mutex = r)

		//change to get encrypted data
			await tools.contractCallFunction(hashrateContract.methods.encryptedPoolData).then(
				r => poolData = r)
		//buy a contract
		//check to see if the encrypted data is encrypted
		let decryptedData
		await encryption.decrypt(poolData, "7c22ec64023216056a39e91d90f83ac4e296f27c56c9773220e6dab940e6ffe9").then(r => decryptedData = r)
		assert.notEqual(poolData, "127.0.0.1|8000|Kodee is in arkansas", "the pool data is not encrypted")
		//decrypt using sellers private key
		assert.equal(decryptedData, "127.0.0.1|8000|Kodee is in arkansas", `encryption failed, result is ${decryptedData}`)
	})
})
