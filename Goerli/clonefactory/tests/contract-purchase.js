let { expect } = require("chai");
let { ethers } = require("hardhat");

describe.skip("ContractPurchase", function () {
  let { CLONE_FACTORY_ADDRESS, LUMERIN_TOKEN_ADDRESS, VALIDATOR_ADDRESS } =
    process.env;

  console.log({
    CLONE_FACTORY_ADDRESS,
    LUMERIN_TOKEN_ADDRESS,
    VALIDATOR_ADDRESS,
  });
  this.timeout(600 * 1000);
  let purchase_price = 100;
  let contract_length = 100;
  let seller, withPOE, withoutPOE;
  let Implementation;
  let cloneFactory;
  let lumerin;

  before(async function () {
    [seller, withPOE, withoutPOE] = await ethers.getSigners();
    // console.log("seller address: ", seller.address);
    Implementation = await ethers.getContractFactory("Implementation");

    //reuse for proof of existance deploy
    let Lumerin = await ethers.getContractFactory("Lumerin");
    lumerin = await Lumerin.attach(
      // "0x51b1B6D1daCDc3cAADee5520b3beF0828c311d5a"
      process.env.LUMERIN_TOKEN_ADDRESS
    );

    let CloneFactory = await ethers.getContractFactory("CloneFactory");

    let err = null;

    try {
      cloneFactory = await CloneFactory.attach(
        process.env.CLONE_FACTORY_ADDRESS
      );
    } catch (e) {
      err = e;
      console.log(
        "error attaching to clone factory, deploying new one; error: ",
        e
      );
    }

    if (err) {
      console.log("here");
      //deploying with the lumerin as the address collecting titans lumerin
      cloneFactory = await CloneFactory.deploy(
        lumerin.address,
        process.env.VALIDATOR_ADDRESS
      );

      await cloneFactory.deployed();
    }

    console.log("clone factory: ", cloneFactory.address);
  });

  //seller gives lumerin tokens to withPOE and withoutPOE contracts
  //buyer increases allowance of clone factory prior to contract purchase
  before(async function () {
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
      .increaseAllowance(cloneFactory.address, 101);
    await allowanceIncrease0.wait();
    let allowanceIncrease1 = await lumerin
      .connect(withPOE)
      .increaseAllowance(cloneFactory.address, 101);
    await allowanceIncrease1.wait();
  });

  //account with POE token creates contract
  it("create a contract", async function () {
    let contractsBefore = await cloneFactory.getContractList();

    let contractCreate = await cloneFactory
      .connect(withPOE)
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
          "123"
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
});
