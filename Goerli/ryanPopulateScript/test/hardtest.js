let { expect } = require("chai");
let { ethers } = require("hardhat");
let sleep = require('sleep')

let purchase_price = 10

describe("ContractPurchase", function () {
	this.timeout(60*1000);
	let owner, buyer, seller, validator;
	let Implementation
	let cloneFactory
	let lumerin
	
	beforeEach(async function() {
	  [owner, buyer, seller, validator] = await ethers.getSigners()
    Implementation = await ethers.getContractFactory("Implementation");

    let Lumerin = await ethers.getContractFactory("Lumerin");
    lumerin = await Lumerin.deploy();
    lumerin.deployed();

    let CloneFactory = await ethers.getContractFactory("CloneFactory");
    cloneFactory = await CloneFactory.deploy(lumerin.address, lumerin.address);
    await cloneFactory.deployed();
	  ownerBalance = await lumerin.balanceOf(owner.address)

    expect(await lumerin.totalSupply()).to.equal(ownerBalance)
    let lumerintx = await lumerin.transfer(buyer.address, 1000)
    await lumerintx.wait()
    expect(await lumerin.balanceOf(buyer.address)).to.equal(1000)
	  let contractCreate = await cloneFactory.connect(seller).setCreateNewRentalContract(
			  purchase_price,
			  10,
			  10,
			  10,
			  validator.address,
			  "123");
	  contractCreate.wait()

	  //buyer increases allowance of clone factory prior to contract purchase
	  let allowanceIncrease = await lumerin.connect(buyer).increaseAllowance(cloneFactory.address, 1000);
	  await allowanceIncrease.wait()
	    expect(await lumerin.allowance(buyer.address, cloneFactory.address)).to.equal(1000)

	});
	
  it("standard purchase and withdrawl", async function () {
	  //buyer calls purchase function on clone factory

	  let contracts = await cloneFactory.getContractList()
	  let purchaseContract = await cloneFactory.connect(buyer).setPurchaseRentalContract(contracts[0], "123");
	  await purchaseContract.wait()

	  //seller closes out the contract and collects the lumerin tokens
	  ////implementationABI = await hre.artifacts.readArtifact("contracts/Implementation.sol:Implementation")
	  //let contract1 = await new ethers.ContractFactory(implementation.interface, implementationABI.bytecode).attach(contracts[0]);
	  let contract1 = await Implementation.attach(contracts[0]);
	  let sellerBeforeCloseout = await lumerin.balanceOf(seller.address)
	  sleep.sleep(20)
	  let closeOut = await contract1.connect(seller).setContractCloseOut(3);
	  await closeOut.wait()
	  let sellerAfterCloseout = await lumerin.balanceOf(seller.address);
	  expect(Number(sellerAfterCloseout) - Number(sellerBeforeCloseout)).to.equal(purchase_price);
  });

	it("standard purchase and closeout without withdrawl", async function() {
	  //buyer calls purchase function on clone factory

	  let contracts = await cloneFactory.getContractList()
	  let purchaseContract = await cloneFactory.connect(buyer).setPurchaseRentalContract(contracts[0], "123");
	  await purchaseContract.wait()

	  //seller closes out the contract and collects the lumerin tokens
	  //implementationABI = await hre.artifacts.readArtifact("contracts/Implementation.sol:Implementation")
        let contract1 = await Implementation.attach(contracts[0]);
	  let sellerBeforeCloseout = await lumerin.balanceOf(seller.address)
	  sleep.sleep(20)
	  let closeOut = await contract1.connect(seller).setContractCloseOut(2);
	  await closeOut.wait()
	  let sellerAfterCloseout = await lumerin.balanceOf(seller.address);
	  expect(Number(sellerAfterCloseout) - Number(sellerBeforeCloseout)).to.equal(0);

	});
	it("standard purchase, refresh, and repurchase", async function() {
	  //buyer calls purchase function on clone factory

	  let contracts = await cloneFactory.getContractList()
	  let purchaseContract = await cloneFactory.connect(buyer).setPurchaseRentalContract(contracts[0], "123");
	  await purchaseContract.wait()

	  //seller closes out the contract and collects the lumerin tokens
	  //implementationABI = await hre.artifacts.readArtifact("contracts/Implementation.sol:Implementation")
        let contract1 = await Implementation.attach(contracts[0]);
	  let sellerBeforeCloseout = await lumerin.balanceOf(seller.address)
	  sleep.sleep(20)
	  let closeOut = await contract1.connect(seller).setContractCloseOut(2);
	  await closeOut.wait()
	  let sellerAfterCloseout = await lumerin.balanceOf(seller.address);
	  expect(Number(sellerAfterCloseout) - Number(sellerBeforeCloseout)).to.equal(0);
	  purchaseContract = await cloneFactory.connect(buyer).setPurchaseRentalContract(contracts[0], "123");
	  purchaseContract.wait()
		//confirm that the contract has purchase_price *2 assigned to it

	});
	it("standard purchase, refresh, repurchase, and withdraw tokens midway", async function() {
	  //buyer calls purchase function on clone factory

	  let contracts = await cloneFactory.getContractList()
	  let purchaseContract = await cloneFactory.connect(buyer).setPurchaseRentalContract(contracts[0], "123");
	  await purchaseContract.wait()

	  //seller closes out the contract and collects the lumerin tokens
	  //implementationABI = await hre.artifacts.readArtifact("contracts/Implementation.sol:Implementation")
        let contract1 = await Implementation.attach(contracts[0]);
	  let sellerBeforeCloseout = await lumerin.balanceOf(seller.address)
	  sleep.sleep(20)
	  let closeOut = await contract1.connect(seller).setContractCloseOut(2);
	  await closeOut.wait()
		console.log("approaching the second purchase")
	  purchaseContract = await cloneFactory.connect(buyer).setPurchaseRentalContract(contracts[0], "123");
	  await purchaseContract.wait()
	  sleep.sleep(5)
	  closeOut = await contract1.connect(seller).setContractCloseOut(1);
	  closeOut.wait()
	  let sellerAfterCloseout = await lumerin.balanceOf(seller.address);
	  expect(Number(sellerAfterCloseout) - Number(sellerBeforeCloseout)).to.be.within(purchase_price+1, purchase_price*2-1);


	});
	it("contract is purchased, buyer updated routing information", async function() {
	  let contracts = await cloneFactory.getContractList()
	  let purchaseContract = await cloneFactory.connect(buyer).setPurchaseRentalContract(contracts[0], "123");
	  await purchaseContract.wait()

	  //buyer updates the mining information
	  //implementationABI = await hre.artifacts.readArtifact("contracts/Implementation.sol:Implementation")
        let contract1 = await Implementation.attach(contracts[0]);
		let updateInfo = await contract1.connect(buyer).setUpdateMiningInformation("meow")
		await updateInfo.wait()
	});
	it("contract is available, seller updates purchase information and withdraws tokens", async function() {
	//buyer calls purchase function on clone factory

	  let contracts = await cloneFactory.getContractList()
	  let purchaseContract = await cloneFactory.connect(buyer).setPurchaseRentalContract(contracts[0], "123");
	  await purchaseContract.wait()

	  //seller closes out the contract and collects the lumerin tokens
	  //implementationABI = await hre.artifacts.readArtifact("contracts/Implementation.sol:Implementation")
        let contract1 = await Implementation.attach(contracts[0]);
	  let sellerBeforeCloseout = await lumerin.balanceOf(seller.address)
	  sleep.sleep(20)
	  let closeOut = await contract1.connect(seller).setUpdatePurchaseInformation(11,11,11,11,3);
	  await closeOut.wait()
	  let sellerAfterCloseout = await lumerin.balanceOf(seller.address);
	  expect(Number(sellerAfterCloseout) - Number(sellerBeforeCloseout)).to.equal(purchase_price);
	});
	it("contract is available, buyer fails to update routing information", 
		async function() {
	//buyer calls purchase function on clone factory

	  let contracts = await cloneFactory.getContractList()
	  let purchaseContract = await cloneFactory.connect(buyer).setPurchaseRentalContract(contracts[0], "123");
	  await purchaseContract.wait()

	  //seller closes out the contract and collects the lumerin tokens
	  //implementationABI = await hre.artifacts.readArtifact("contracts/Implementation.sol:Implementation")
        let contract1 = await Implementation.attach(contracts[0]);
	  let sellerBeforeCloseout = await lumerin.balanceOf(seller.address)
	  sleep.sleep(20)
	  let closeOut = await contract1.connect(seller).setUpdatePurchaseInformation(11,11,11,11,2);
	  await closeOut.wait()
	  let sellerAfterCloseout = await lumerin.balanceOf(seller.address);
	  expect(Number(sellerAfterCloseout) - Number(sellerBeforeCloseout)).to.equal(0);

	});
	//it("contract is purchased, seller fails to closeout before contract is finished", async function() {});
	//it("standard purchase and closeout without withdrawl", async function() {});
	//it("standard purchase and closeout without withdrawl", async function() {});
	//it("standard purchase and closeout without withdrawl", async function() {});
});

