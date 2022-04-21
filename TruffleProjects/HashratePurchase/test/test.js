let assert = require('assert')
let fs = require('fs')
let {
    exec
} = require('child_process')
let Web3 = require('web3') //web3.js library used to interact with blockchain
let sleep = require('sleep')
let tools = require('./tools.js')


//all testing will take place on a fresh contract.eployment
describe('tests to ensure contracts uploaded successfully', function() {
	let network;
	let blockTime;
    let web3, hashrateContractAddress, clonefactory;
    let wallet, sellerAddress, buyerAddress, validatorAddress, token;
    let contractPrice = 100;
    let contractLimit = 100;
    let contractSpeed = 100;
    let contractLength;
    let res;
    this.timeout(60 * 3 * 1000) //maximum wait is 120 seconds, , or 2 minutes before the test times out
	
	before('set network and blocktime', function() {
	network = tools.getConfigParams()["network"]
	blockTime = Number(tools.getConfigParams()["blockTime"]);
	contractLength = blockTime*2
	})


        before('delete meow database', function() {
    if (network == "development") {
            console.log('removing meow database')
            tools.callCommand('rm -rf meow/')
    }
        })

        before('delete build database', function() {
    if (network == "development") {
            console.log('removing build files')
            tools.callCommand('rm -rf build/contracts')
    }
        })

        before(`create a new ganache instance mining a new block every  ${blockTime}seconds`, async function() {
    if (network == "development") {
            //ganache instance at port 8545 saving output to folder called meow
            //dont question why the folder is named meow. Its clear that meow
            //has nothing to do with the smart contracts and should be clear that
            //it was explicitly named for some seemingly reasonable purpose
            console.log('about to create ganache instance')
	    try {
            tools.callCommand(`ganache-cli -i 5777 -p 8545 -s 3 -b ${blockTime} --db ./meow`)
		    sleep.sleep(5)
	    } catch (err) {
		    console.log(err)
	    }
            console.log('created ganache instance')
    }
        })

    before('creating a web3 object', function() {
        console.log('creating web3 object')
        if (network == "development") {
            web3 = new Web3('http://127.0.0.1:8545') //ganache node
        } else {
            web3 = new Web3('http://54.242.38.253:8545') //ropsten node url
        }
    })

    before('create a wallet object', async function() {
	    if (network == "development") {
        await web3.eth.getAccounts().then(r => wallet = r);
	    } else {
        wallet = web3.eth.accounts.wallet
        wallet.add('cf1604735a884467cb57d3d1d7aa343cb1621302e06335becf9dd6048c797d6b')
        wallet.add('2c1fa5dc9748612707be4d48c15fd60b3342ab1a70d0ba1d005cc79e6023e246')
        wallet.add('48de9b9920c844c1c34f8c2b8a113d71d6a0135dc796db5d8019477a579b5a26')
	    }
    })

    before('compile smart contracts using truffle command', function() {
        console.log('compiling contract')
        tools.callCommand('truffle compile')
    })

    before('migrate smart contracts to network', function() {
	if (network == "development") {
        console.log('migrating contracts')
        tools.callCommand('truffle migrate --reset --network development')
        sleep.sleep(blockTime*3+30)
        console.log('migration complete')
	}
    })

    before('create contract objects', function() {
        console.log('creating contract objects')
        clonefactory = tools.createContractObject(web3, 'CloneFactory', network);
        token = tools.createLumerin(web3, network);
        console.log('contract objects created')
    })

    before('set relevant addresses', async function() {
        console.log('setting seller and buyer addresses')
	    if (network == "development") {
        sellerAddress = wallet[0]
        buyerAddress = wallet[1]
        validatorAddress = wallet[2]
	    } else {
        sellerAddress = wallet[0].address
        buyerAddress = wallet[1].address
        validatorAddress = wallet[2].address
	    }
	    console.log(`sellerAddress: ${sellerAddress}`)
	    console.log(`buyerAddress: ${buyerAddress}`)
	    console.log(`validatorAddress: ${validatorAddress}`)
        console.log('seller and buyer addresses set')
    })

    before('send tokens to buyerAddress', async function() {
	if (network == "development") {
        console.log('sending tokens to buyer')
        await tools.contractCallFunction(
            token.methods.balanceOf,
            [sellerAddress]
        ).then(r => sellerTokens = r)
        await tools.contractSendFunction(
            token.methods.transfer,
            sellerAddress,
            [buyerAddress, 1000000]).then(r => res = r)
        console.log('sent tokens to buyer')
	}
    })

    beforeEach('mint a new hashrate contract for the upcoming test', async function() {
        console.log('minting a contract')
        await tools.contractSendFunction(
            clonefactory.methods.setCreateNewRentalContract,
            sellerAddress,
            [contractPrice, contractLimit, contractSpeed, contractLength, validatorAddress, "123"]
        ).then(r => mutex = r)
        console.log('contract minted')
        //sleep.sleep(blockTime*2)
	    console.log('setting address to purchase')
        await tools.contractCallFunction(
            clonefactory.methods.getContractList
        ).then(r => hashrateContractAddress = r[r.length - 1])
	    console.log(hashrateContractAddress)
	    console.log('address set')
    })


    it('#purchase a contract. Closeout after contract completes using option 3',
        async function() {
            /* steps
             * 1. pre-approve clone factory to spend required lumerin
             * 2. call purchase function
             * 3. wait for blocks to pass
             * 4. seller calls closeout after test time
             */
            //obtain the cost in lumerin of a contract
            let contractprice;
            let contractstate;
            let sellerlumerinpre, sellerlumerinpost;
            await tools.getLumerinValue(token, sellerAddress).then(r => sellerlumerinpre = r);
            await tools.getContractPrice(web3, hashrateContractAddress).then(r => contractprice = r)

            //pre-approve clone factory to spend tokens on behalf of buyer
            await tools.preApproveLumerin(token, Number(contractprice), clonefactory._address, buyerAddress).then(r => mutex = r)

            //tell clonefactory to purchase hashrate contract
            await tools.purchaseContract(clonefactory, hashrateContractAddress, buyerAddress).then(r => mutex = r)
            await tools.getContractState(web3, hashrateContractAddress).then(r => contractstate = r)
            assert.equal(String(contractstate), "1", `contract state expected to be 1 after purchase, actual is: ${contractstate}`)
            console.log(`sleeping for ${contractLength+blockTime*2}\n`)
            sleep.sleep(contractLength + blockTime * 2)
            await tools.setContractCloseout(web3, hashrateContractAddress, sellerAddress, 3).then(r => mutex =r)
            await tools.getContractState(web3, hashrateContractAddress).then(r => contractstate = r)
            await tools.getLumerinValue(token, sellerAddress).then(r => sellerlumerinpost = r);
            assert.equal(String(contractstate), "0", `contract state expected to be 0 after closeout, actual is: ${contractstate}`)
            assert.equal(Number(sellerlumerinpre) + Number(contractprice), Number(sellerlumerinpost), `seller is supposed to have ${Number(sellerlumerinpre)+Number(contractprice)} but actually has ${sellerlumerinpost} lumerin`)
        })

    it('#purchase a contract. Closeout after contract completes using option 2',
        async function() {
            /* steps
             * 1. pre-approve clone factory to spend required lumerin
             * 2. call purchase function
             * 3. wait for blocks to pass
             * 4. seller calls closeout after test time
             */
            //obtain the cost in lumerin of a contract
            let contractPrice;
            let contractState;
            let sellerLumerinPre, sellerLumerinPost;
            await tools.getLumerinValue(token, sellerAddress).then(r => sellerLumerinPre = r);
            await tools.getContractPrice(web3, hashrateContractAddress).then(r => contractPrice = r)

            //pre-approve clone factory to spend tokens on behalf of buyer
            await tools.preApproveLumerin(token, Number(contractPrice), clonefactory._address, buyerAddress)

            //tell clonefactory to purchase hashrate contract
            await tools.purchaseContract(clonefactory, hashrateContractAddress, buyerAddress).then(r => mutex = r)
            await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
            assert.equal(String(contractState), "1", `contract state expected to be 1 after purchase, actual is: ${contractState}`)
            sleep.sleep(contractLength + blockTime * 2)
            await tools.setContractCloseout(web3, hashrateContractAddress, sellerAddress, 2).then(console.log)
            await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
            await tools.getLumerinValue(token, sellerAddress).then(r => sellerLumerinPost = r);
            assert.equal(String(contractState), "0", `contract state expected to be 0 after closeout, actual is: ${contractState}`)
            assert.equal(Number(sellerLumerinPre), Number(sellerLumerinPost), `seller is supposed to have ${Number(sellerLumerinPre)} but actually has ${sellerLumerinPost} lumerin`)
        })


    it('#purchase a contract. Closeout 70% of the way done with validator',
        async function() {
            /* steps
             * 1. pre-approve clone factory to spend required lumerin
             * 2. call purchase function
             * 3. wait for 70% of blocks to pass
             * 4. validator calls closeout after 70% of blocks pass
             * 5. confirm that buyer receives 30% of blocks (+/-10%)
             * 6. confirm that seller receives 70% of blocks (+/-10%)
             */
            //obtain the cost in lumerin of a contract
            let contractPrice;
            let contractDuration;
            let contractState;
            await tools.getContractPrice(web3, hashrateContractAddress).then(r => contractPrice = r)
            await tools.getContractDuration(web3, hashrateContractAddress).then(r => contractDuration = r)

            //pre-approve clone factory to spend tokens on behalf of buyer
            await tools.preApproveLumerin(token, Number(contractPrice), clonefactory._address, buyerAddress)

            //tell clonefactory to purchase hashrate contract
            await tools.purchaseContract(clonefactory, hashrateContractAddress, buyerAddress).then(r => mutex = r)
            await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
            assert.equal(String(contractState), "1", `contract state expected to be 1 after purchase, actual is: ${contractState}`)
            sleep.sleep(parseInt(Number(contractDuration) * .7))
            await tools.setContractCloseout(web3, hashrateContractAddress, validatorAddress, 0).then(r => mutex = r)
            await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
            assert.equal(String(contractState), "0", `contract state expected to be 0 after closeout, actual is: ${contractState}`)
            await tools.getContractPrice(web3, hashrateContractAddress).then(r => contractPrice = r)
            await tools.preApproveLumerin(token, Number(contractPrice), clonefactory._address, buyerAddress)
        })

    it('#purchase a contract. Seller fails closeout 70% of the way done',
        async function() {
            /* steps
             * 1. pre-approve clone factory to spend required lumerin
             * 2. call purchase function
             * 3. wait for 70% of blocks to pass
             * 4. seller calls closeout after 70% of blocks pass
             * 5. confirm that contract.id not close out
             */
            //obtain the cost in lumerin of a contract
            let contractPrice;
            let contractDuration;
            let contractState;
            await tools.getContractPrice(web3, hashrateContractAddress).then(r => contractPrice = r)
            await tools.getContractDuration(web3, hashrateContractAddress).then(r => contractDuration = r)

            //pre-approve clone factory to spend tokens on behalf of buyer
            await tools.preApproveLumerin(token, Number(contractPrice), clonefactory._address, buyerAddress)

            //tell clonefactory to purchase hashrate contract
            await tools.purchaseContract(clonefactory, hashrateContractAddress, buyerAddress).then(r => mutex = r)
            await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
            assert.equal(String(contractState), "1", `contract state expected to be 1 after purchase, actual is: ${contractState}`)
            sleep.sleep(parseInt(Number(contractDuration) * .7))
            await tools.setContractCloseout(web3, hashrateContractAddress, sellerAddress, 0, true)
            await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
            assert.equal(String(contractState), "1", `contract state expected to be 1 after closeout failure, actual is: ${contractState}`)
        })

    it('purchase a contract. Buyer changes ciphertext while contract is running', async function() {
        /* steps
         * 1. pre-approve clone factory to spend required lumerin
         * 2. call purchase function
         * 3. update ciphertext
         * 4. confirm that ciphertext is updated
         */
        //obtain the cost in lumerin of a contract
        let contractPrice;
        let contractState;
        let cipherText;
        let newPoolData = "josh knows how to make some dank unit tests";
        await tools.getLumerinValue(token, sellerAddress).then(r => sellerLumerinPre = r);
        await tools.getContractPrice(web3, hashrateContractAddress).then(r => contractPrice = r)
        await tools.getContractDuration(web3, hashrateContractAddress).then(r => contractDuration = r)

        //pre-approve clone factory to spend tokens on behalf of buyer
        await tools.preApproveLumerin(token, Number(contractPrice), clonefactory._address, buyerAddress).then(r => mutex = r)
        //tell clonefactory to purchase hashrate contract
        await tools.purchaseContract(clonefactory, hashrateContractAddress, buyerAddress).then(r => mutex = r)
        await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
        assert.equal(String(contractState), "1", `contract state expected to be 1 after purchase, actual is: ${contractState}`)
        await tools.setUpdatePoolData(web3, hashrateContractAddress, buyerAddress, newPoolData, true)
        await tools.getContractCP(web3, hashrateContractAddress).then(r => cipherText = r)
        assert.equal(cipherText, newPoolData, `contract state expected to be ${newPoolData}  after update, actual is: ${cipherText}`)
    })

    it('generate a contract. Seller updates contract params while contract is available using option 3', async function() {
        /* steps
         * 1. create a cotract
         * 2. update purchase information
         */
        let contractPurchaseInfo;
        await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
        assert.equal(String(contractState), "0", `contract state expected to be 0 before purchase, actual is: ${contractState}`)
        //increase everything from 100 to 101
        sleep.sleep(contractLength + blockTime * 2)
        await tools.setUpdatePurchaseData(web3, hashrateContractAddress, sellerAddress, [101, 101, 101, 101, 3], true)
        await tools.getContractPurchaseInfo(web3, hashrateContractAddress).then(r => contractPurchaseInfo = r)
        assert.equal(contractPurchaseInfo.price, "101", `price expected to be 101, actual is ${contractPurchaseInfo.price}`)
        assert.equal(contractPurchaseInfo.limit, "101", `limit expected to be 101, actual is ${contractPurchaseInfo.limit}`)
        assert.equal(contractPurchaseInfo.speed, "101", `speed expected to be 101, actual is ${contractPurchaseInfo.speed}`)
        assert.equal(contractPurchaseInfo.length, "101", `length expected to be 101, actual is ${contractPurchaseInfo.length}`)
    })

    it('generate a contract. Seller updates contract params while contract is available using option 2', async function() {
        /* steps
         * 1. create a cotract
         * 2. update purchase information
         */
        let contractPurchaseInfo;
        await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
        assert.equal(String(contractState), "0", `contract state expected to be 0 before purchase, actual is: ${contractState}`)
        //increase everything from 100 to 101
        sleep.sleep(contractLength + blockTime * 2)
        await tools.setUpdatePurchaseData(web3, hashrateContractAddress, sellerAddress, [101, 101, 101, 101, 2], true)
        await tools.getContractPurchaseInfo(web3, hashrateContractAddress).then(r => contractPurchaseInfo = r)
        assert.equal(contractPurchaseInfo.price, "101", `price expected to be 101, actual is ${contractPurchaseInfo.price}`)
        assert.equal(contractPurchaseInfo.limit, "101", `limit expected to be 101, actual is ${contractPurchaseInfo.limit}`)
        assert.equal(contractPurchaseInfo.speed, "101", `speed expected to be 101, actual is ${contractPurchaseInfo.speed}`)
        assert.equal(contractPurchaseInfo.length, "101", `length expected to be 101, actual is ${contractPurchaseInfo.length}`)
    })

    it('generate a contract. Seller updates contract params while contract is available using option 3', async function() {
        /* steps
         * 1. create a cotract
         * 2. update purchase information
         */
        let contractPurchaseInfo;
        await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
        assert.equal(String(contractState), "0", `contract state expected to be 0 before purchase, actual is: ${contractState}`)
        //increase everything from 100 to 101
        sleep.sleep(contractLength + blockTime * 2)
        await tools.setUpdatePurchaseData(web3, hashrateContractAddress, sellerAddress, [101, 101, 101, 101, 3], true)
        await tools.getContractPurchaseInfo(web3, hashrateContractAddress).then(r => contractPurchaseInfo = r)
        assert.equal(contractPurchaseInfo.price, "101", `price expected to be 101, actual is ${contractPurchaseInfo.price}`)
        assert.equal(contractPurchaseInfo.limit, "101", `limit expected to be 101, actual is ${contractPurchaseInfo.limit}`)
        assert.equal(contractPurchaseInfo.speed, "101", `speed expected to be 101, actual is ${contractPurchaseInfo.speed}`)
        assert.equal(contractPurchaseInfo.length, "101", `length expected to be 101, actual is ${contractPurchaseInfo.length}`)
    })

    it('generate a contract. Seller fails to update contract params while contract is running', async function() {
        /* steps
         * 1. create a cotract
         * 2. purchase the contract
         * 3. confirm that purchase info is unchanged 
         */
        let contractPurchaseInfo;
        let contractPrice;
        let contractState;
        await tools.getLumerinValue(token, sellerAddress).then(r => sellerLumerinPre = r);
        await tools.getContractPrice(web3, hashrateContractAddress).then(r => contractPrice = r)
        await tools.getContractDuration(web3, hashrateContractAddress).then(r => contractDuration = r)

        //pre-approve clone factory to spend tokens on behalf of buyer
        await tools.preApproveLumerin(token, Number(contractPrice), clonefactory._address, buyerAddress).then(r => mutex = r)

        //tell clonefactory to purchase hashrate contract
        await tools.purchaseContract(clonefactory, hashrateContractAddress, buyerAddress).then(r => mutex = r)
        await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
        assert.equal(String(contractState), "1", `contract state expected to be 1 after purchase, actual is: ${contractState}`)
        //increase everything from 100 to 101
        await tools.setUpdatePurchaseData(web3, hashrateContractAddress, sellerAddress, [101, 101, 101, 101, 3], true)
        await tools.getContractPurchaseInfo(web3, hashrateContractAddress).then(r => contractPurchaseInfo = r)
        assert.equal(contractPurchaseInfo.price, String(contractPrice), `price expected to be ${contractPrice}, actual is ${contractPurchaseInfo.price}`)
        assert.equal(contractPurchaseInfo.speed, String(contractSpeed), `speed expected to be ${contractSpeed}, actual is ${contractPurchaseInfo.speed}`)
        assert.equal(contractPurchaseInfo.length, String(contractLength), `length expected to be ${contractLength}, actual is ${contractPurchaseInfo.length}`)
    })

    it('purchase a contract. Seller cashes out mid contract', async function() {
        /* steps
         * 1. pre-approve clone factory to spend required lumerin
         * 2. call purchase function
         * 3. wait for 1/2 of time to pass
         * 4. seller calls closeout option 1
         */
        //obtain the cost in lumerin of a contract
        let contractPrice;
        let contractDuration;
        let contractState;
        let sellerLumerinPre, sellerLumerinPost;
        await tools.getLumerinValue(token, sellerAddress).then(r => sellerLumerinPre = r);
        await tools.getContractPrice(web3, hashrateContractAddress).then(r => contractPrice = r)
        await tools.getContractDuration(web3, hashrateContractAddress).then(r => contractDuration = r)

        //pre-approve clone factory to spend tokens on behalf of buyer
        await tools.preApproveLumerin(token, Number(contractPrice), clonefactory._address, buyerAddress).then(r => mutex = r)

        //tell clonefactory to purchase hashrate contract
        await tools.purchaseContract(clonefactory, hashrateContractAddress, buyerAddress).then(r => mutex = r)
        await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
        assert.equal(String(contractState), "1", `contract state expected to be 1 after purchase, actual is: ${contractState}`)
        sleep.sleep(parseInt(Number(contractDuration) / 2))
        await tools.setContractCloseout(web3, hashrateContractAddress, sellerAddress, 1)
        sleep.sleep(blockTime * 3)
        await tools.getContractState(web3, hashrateContractAddress).then(r => contractState = r)
        await tools.getLumerinValue(token, sellerAddress).then(r => sellerLumerinPost = r);
        assert.equal(String(contractState), "1", `contract state expected to be 1 after seller cashout, actual is: ${contractState}`)
        assert.equal(Number(sellerLumerinPost) < Number(sellerLumerinPre) + Number(contractPrice), true, "seller has too much lumerin")
        assert.equal(Number(sellerLumerinPost) > Number(sellerLumerinPre), true, "seller has too few lumerin")
    })


    it('purchase a contract. Not enough lumerin is pre-authorized', async function() {
        /* steps
         * 1. dont pre-approve clone factory to spend required lumerin
         * 2. call purchase function
         * 3. confirm that the contract is still in an available state
         */
        //obtain the cost in lumerin of a contract
        let contractprice;
        let contractstate;
        let approvedLumerin;
        await tools.getContractPrice(web3, hashrateContractAddress).then(r => contractprice = r)
        await tools.getContractDuration(web3, hashrateContractAddress).then(r => contractduration = r)

        //ensure that the contract is not authorized to spend any lumerin
        await tools.defundAddress(token, buyerAddress, clonefactory._address)

        //pre-approve clone factory to spend tokens on behalf of buyer
        await tools.preApproveLumerin(token, parseInt(Number(contractprice) * .1), clonefactory._address, buyerAddress).then(r => mutex = r)
        await tools.getPreApprovedAmount(token, buyerAddress, clonefactory._address).then(r => approvedLumerin = r)
        assert.equal(approvedLumerin < contractprice, true, `clonefactory should have less than ${contractprice} approved but is approved for ${approvedLumerin}`)

        //confirm that the contract is currently in state 0
        await tools.getContractState(web3, hashrateContractAddress).then(r => contractstate = r)
        assert.equal(String(contractstate), "0", `contract state expected to be 0 before purchase, actual is: ${contractstate}`)

        //tell clonefactory to purchase hashrate contract
        await tools.purchaseContract(clonefactory, hashrateContractAddress, buyerAddress, true).then(r => mutex = r)
        await tools.getContractState(web3, hashrateContractAddress).then(r => contractstate = r)
        assert.equal(String(contractstate), "0", `contract state expected to be 0 after failed purchase, actual is: ${contractstate}`)
    })

})
