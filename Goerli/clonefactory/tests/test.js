let { expect } = require("chai");
let { ethers } = require("hardhat");

describe("ContractPurchase", function () {
  this.timeout(600 * 1000);
  let purchase_price = 100;
  let contract_length = 100;
  let seller, withPOE, withoutPOE;
  let Implementation;
  let cloneFactory;
  let lumerin;
  let poe;

  before(async function () {
    [seller, withPOE, withPOE1, withPOE2, withoutPOE] =
      await ethers.getSigners();
    Implementation = await ethers.getContractFactory("Implementation");

    //deploy lumeirn token
    let Lumerin = await ethers.getContractFactory("Lumerin");

    let lumerinAttachErr = null;

    try {
      lumerin = await Lumerin.attach(process.env.LUMERIN_TOKEN_ADDRESS);
    } catch (e) {
      lumerinAttachErr = e;
      console.log(
        "error attaching to LUMERIN_TOKEN_ADDRESS, deploying new token; error: ",
        e
      );
    }

    if (lumerinAttachErr) {
      lumerin = await Lumerin.deploy();
      await lumerin.deployed();
    }

    //deploy POE token
    let POE = await ethers.getContractFactory("Lumerin");
    poe = await POE.deploy();
    await poe.deployed();

    let CloneFactory = await ethers.getContractFactory("CloneFactory");

    let cloneFactoryAttachErr = null;
    try {
      cloneFactory = await CloneFactory.attach(
        process.env.CLONE_FACTORY_ADDRESS
      );
    } catch (e) {
      cloneFactoryAttachErr = e;
      console.log(
        "error attaching to clone factory, deploying new one; error: ",
        e
      );
    }

    if (cloneFactoryAttachErr) {
      //deploying with the lumerin as the address collecting titans lumerin
      cloneFactory = await CloneFactory.deploy(
        lumerin.address,
        process.env.VALIDATOR_ADDRESS
        //      poe.address
      );

      await cloneFactory.deployed();
    }

    //transfer POE to required addresses
    for (addr of [withPOE, withPOE1, withPOE2]) {
      let tx = await poe.transfer(addr.address, 1);
      await tx.wait();
    }
  });

  //seller gives lumerin tokens to withPOE and withoutPOE contracts
  //buyer increases allowance of clone factory prior to contract purchase
  before(async function () {
    loadLouMarinAllowance();
  });

  //account with POE token creates contract
  it("create a contract", async function () {
    let contractsBefore = await cloneFactory.getContractList();

    let contractCreate = await cloneFactory
      .connect(seller)
      .setCreateNewRentalContract(
        purchase_price,
        10,
        10,
        contract_length,
        lumerin.address,
        "123"
      );
    await contractCreate.wait();
    let contractsAfter = await cloneFactory.getContractList();

    expect(contractsAfter.length - contractsBefore.length).to.equal(1);
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
    let contract1 = await Implementation.attach(contractAddress);
    await tryIncreaseAllowanceForContract(contract1, withPOE);

    let purchaseContract = await cloneFactory
      .connect(withPOE)
      .setPurchaseRentalContract(contractAddress, "123");
    await purchaseContract.wait();
    //seller closes out the contract and collects the lumerin tokens
    let contractBuyer = await contract1.buyer();
    expect(contractBuyer).to.equal(withPOE.address);
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
    } catch {}
    //seller closes out the contract and collects the lumerin tokens
    let contract1 = await Implementation.attach(contractAddress);
    let contractBuyer = await contract1.buyer();
    expect(contractBuyer).to.not.equal(withoutPOE.address);
  });

  //deploys a new clone factory
  //seller creates 10 hashrate contracts
  //buyer buys all 10
  //seller closes out all 10 after contract duration
  //confirm buyer can see all 10
  it("confirmCloseoutTracking", async function () {
    let contracts = {};
    let purchasedContracts = {};

    //get contract instances with length of 1
    contracts = await collectTestContractInstances();

    let contractAddresses = Object.keys(contracts);

    if (contractAddresses.length < 10) {
      //create 10 contracts
      await generateTestContracts(10 - contractAddresses.length);

      contracts = await collectTestContractInstances();
    }

    const contractInstances = Object.values(contracts);

    for (let contractInstance of contractInstances) {
      let shouldPurchase = await tryIncreaseAllowanceForContract(
        contractInstance,
        withPOE
      );

      if (shouldPurchase) {
        let purchaseContract = await cloneFactory
          .connect(withPOE)
          .setPurchaseRentalContract(contractInstance.address, "123");

        await purchaseContract.wait();
      }

      purchasedContracts[contractInstance.address] = shouldPurchase;
    }

    contractCloseoutPromises = [];
    //close out all contracts with option 3
    for (let contract of contractInstances) {
      if (purchasedContracts[contract.address]) {
        // force a block to be mined

        await ethers.provider.poll();

        let closeout = await contract.connect(withPOE).setContractCloseOut(3);

        await closeout.wait();

        let closedEvents = await contract.queryFilter("contractClosed");

        expect(closedEvents.length).to.be.greaterThanOrEqual(1);

        let buyerHistory = await contract.buyerTracking(withPOE.address, 0);

        expect(buyerHistory._length).to.be.equal(1);
      }
    }
  });

  //deploys a new clone factory
  //seller creates 10 hashrate contracts
  //buyer buys all 10 twice
  //seller closes out all 10 after contract duration
  //confirm buyer can see only 10
  it("confirmCloseoutTrackingDouble", async function () {});

  //deploys a new clone factory
  //seller creates 10 hashrate contracts
  //buyer buys all 10 twice
  //seller closes out all 10 after contract duration
  //confirm buyer can see only 10
  it("confirmCloseoutTrackingSeperateBuyers", async function () {});

  async function loadLouMarinAllowance() {
    let txTokensToWithPOE = await lumerin
      .connect(seller)
      .transfer(withPOE.address, 1000 * 10 ** 8);
    await txTokensToWithPOE.wait();
    let txTokensToWithoutPOE = await lumerin
      .connect(seller)
      .transfer(withoutPOE.address, 1000 * 10 ** 8);
    await txTokensToWithoutPOE.wait();
    let allowanceIncrease0 = await lumerin
      .connect(withPOE)
      .increaseAllowance(cloneFactory.address, 110);
    await allowanceIncrease0.wait();
    let allowanceIncrease1 = await lumerin
      .connect(withPOE)
      .increaseAllowance(cloneFactory.address, 110);
    await allowanceIncrease1.wait();
  }

  async function collectTestContractInstances() {
    let contracts = {};
    let contractAddresses = await cloneFactory.getContractList();

    for (let contract of contractAddresses) {
      let contractInstance = await Implementation.attach(contract);

      if ((await contractInstance.length()) == 1) {
        contracts[contract] = contractInstance;
      }
    }

    return contracts;
  }

  async function generateTestContracts(contractCount) {
    for (let count = 0; count < contractCount; count++) {
      let contractCreate = await cloneFactory
        .connect(seller)
        .setCreateNewRentalContract(1, 1, 1, 1, lumerin.address, "123");
      await contractCreate.wait();
    }
  }

  async function sleep(sleepTime) {
    return new Promise((resolve) => setTimeout(resolve, sleepTime));
  }

  async function tryIncreaseAllowanceForContract(contract1, owner) {
    let state = await contract1.contractState();

    if (state == 0) {
      let price = BigInt(await contract1.price());

      let allowanceIncrease1 = await lumerin
        .connect(owner)
        .increaseAllowance(cloneFactory.address, price + price / BigInt(100));
      await allowanceIncrease1.wait();

      return true;
    }

    return false;
  }
});
