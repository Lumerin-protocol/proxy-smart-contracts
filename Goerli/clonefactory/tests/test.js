let { expect } = require("chai");
let { ethers } = require("hardhat");
let sleep = require("sleep");

describe("ContractPurchase", function () {
  this.timeout(600 * 1000);
  let purchase_price = 100;
  let contract_length = 100;
  let seller, withPOE, withoutPOE;
  let Implementation;
  let cloneFactory;
  let lumerin;
  let poe

  before(async function () {
    [seller, withPOE, withPOE1, withPOE2, withoutPOE] = await ethers.getSigners();
    Implementation = await ethers.getContractFactory("Implementation");

    //deploy lumeirn token
    let Lumerin = await ethers.getContractFactory("Lumerin");
    lumerin = await Lumerin.deploy()
    await lumerin.deployed()
    
    //deploy POE token
    let POE = await ethers.getContractFactory("Lumerin");
    poe = await POE.deploy()
    await poe.deployed()

    let CloneFactory = await ethers.getContractFactory("CloneFactory");
    //deploying with the lumerin as the address collecting titans lumerin
    cloneFactory = await CloneFactory.deploy(
      lumerin.address,
      lumerin.address,
      poe.address
    );

    await cloneFactory.deployed();


    //transfer POE to required addresses
    for (addr of [withPOE, withPOE1, withPOE2]) {
      let tx = await poe.transfer(addr.address, 1)
      await tx.wait()
    }
  });


  //seller gives lumerin tokens to withPOE and withoutPOE contracts
  //buyer increases allowance of clone factory prior to contract purchase
  before(async function() {
    let txTokensToWithPOE = await lumerin.connect(seller).transfer(withPOE.address, 1000*10**8);
    await txTokensToWithPOE.wait()
    let txTokensToWithoutPOE = await lumerin.connect(seller).transfer(withoutPOE.address, 1000*10**8);
    await txTokensToWithoutPOE.wait()
    let allowanceIncrease0 = await lumerin
      .connect(withPOE)
      .increaseAllowance(cloneFactory.address, 100);
    await allowanceIncrease0.wait();
    let allowanceIncrease1 = await lumerin
      .connect(withPOE)
      .increaseAllowance(cloneFactory.address, 100);
    await allowanceIncrease1.wait();
  })

  //account with POE token creates contract
  it("create a contract", async function () {
    let contractCreate = await cloneFactory
      .connect(withPOE)
      .setCreateNewRentalContract(
        purchase_price,
        10,
        10,
        contract_length,
        lumerin.address,
        "123",
        "private key"
      );
    await contractCreate.wait();
    let contractsAfter = await cloneFactory.getContractList();
    expect(contractsAfter.length).to.equal(1);
  });

  //account without POE token fails to create a contract
  it("fail contract creation", async function () {
    let contractsBefore = await cloneFactory.getContractList();
    try {
    let contractCreate = await cloneFactory
      .connect(withoutPOE)
      .setCreateNewRentalContract(
        purchase_price,
        10,
        10,
        contract_length,
        lumerin.address,
        "123",
        "private key"
      );
    await contractCreate.wait();
    } catch {}
    let contractsAfter = await cloneFactory.getContractList();
    expect(contractsAfter.length).to.equal(contractsBefore.length);
  });

  //account with POE token buys a contract
  it("purchase a contract", async function () {
    //buyer calls purchase function on clone factory

    let contracts = await cloneFactory.getContractList();
    let contractAddress = contracts[contracts.length - 1];
    let purchaseContract = await cloneFactory
      .connect(withPOE)
      .setPurchaseRentalContract(contractAddress, "123");
    await purchaseContract.wait();
    //seller closes out the contract and collects the lumerin tokens
    let contract1 = await Implementation.attach(contractAddress);
    let contractBuyer = await contract1.buyer()
    expect(contractBuyer).to.equal(withPOE.address)
  });

  //account without POE token fails to buy a contract
  it("failContractPurchase", async function () {
    //buyer calls purchase function on clone factory

    let contracts = await cloneFactory.getContractList();
    let contractAddress = contracts[contracts.length - 1];
    try {
    let purchaseContract = await cloneFactory
      .connect(withoutPOE)
      .setPurchaseRentalContract(contractAddress, "123");
    await purchaseContract.wait();
    } catch {
    }
    //seller closes out the contract and collects the lumerin tokens
    let contract1 = await Implementation.attach(contractAddress);
    let contractBuyer = await contract1.buyer()
    expect(contractBuyer).to.not.equal(withoutPOE.address)
  });

  //deploys a new clone factory
  //seller creates 10 hashrate contracts
  //buyer buys all 10
  //seller closes out all 10 after contract duration
  //confirm buyer can see all 10
  it("confirmCloseoutTracking", async function() {
    Implementation = await ethers.getContractFactory("Implementation");

    //reuse for proof of existance deploy
    let Lumerin = await ethers.getContractFactory("Lumerin");
    lumerin = await Lumerin.deploy();
    await lumerin.deployed()

    //deploying with the lumerin as the address collecting titans lumerin
    let CloneFactory = await ethers.getContractFactory("CloneFactory");
    cloneFactory = await CloneFactory.deploy(
      lumerin.address,
      lumerin.address,
      poe.address
    );
    await cloneFactory.deployed();


    let txTokensToWithPOE = await lumerin.connect(seller).transfer(withPOE.address, 1000*10**8);
    await txTokensToWithPOE.wait()
    let txTokensToWithoutPOE = await lumerin.connect(seller).transfer(withoutPOE.address, 1000*10**8);
    await txTokensToWithoutPOE.wait()
    let allowanceIncrease0 = await lumerin
      .connect(withPOE)
      .increaseAllowance(cloneFactory.address, 100);
    await allowanceIncrease0.wait();
    let allowanceIncrease1 = await lumerin
      .connect(withPOE)
      .increaseAllowance(cloneFactory.address, 100);
    await allowanceIncrease1.wait();

    
    //create 10 contracts
    for (let count = 0; count < 10; count++) {
      let contractCreate = await cloneFactory
        .connect(withPOE)
        .setCreateNewRentalContract(
          1,
          1,
          1,
          1,
          lumerin.address,
          "123"
        );
      await contractCreate.wait();
      }


    //get list of contracts
    let contracts = await cloneFactory.getContractList()
    for (let contract of contracts) {
      let purchaseContract = await cloneFactory
        .connect(withPOE)
        .setPurchaseRentalContract(contract, "123");
      await purchaseContract.wait();
    }

    //wait 10 seconds
    sleep.sleep(10)

    //close out all contracts with option 3
    for (let contract of contracts) {
      let imp = await Implementation.attach(contract);
      let closeout = await imp.connect(withPOE).setContractCloseOut(3)
      await closeout.wait()
    }

    //iterate through each contract in getContractList and look for each 
    //instance of contractClosed event
    //create an object where the key is the buyer address, and the value is a list of contract addresses
    let closedContracts = {}
    for (let contract of contracts) {
      let imp = await Implementation.attach(contract);
      let closedEvents = await imp.queryFilter("contractClosedGood")
      for (let event in closedEvents) {
        console.log(event[0])
      }
    }
    expect(1).to.equal(2)


  })

  //deploys a new clone factory
  //seller creates 10 hashrate contracts
  //buyer buys all 10 twice
  //seller closes out all 10 after contract duration
  //confirm buyer can see only 10
  it("confirmCloseoutTrackingDouble", async function() {
  })

  //deploys a new clone factory
  //seller creates 10 hashrate contracts
  //buyer buys all 10 twice
  //seller closes out all 10 after contract duration
  //confirm buyer can see only 10
  it("confirmCloseoutTrackingSeperateBuyers", async function() {
  })
});
