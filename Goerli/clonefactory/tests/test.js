//@ts-check
let { expect } = require("chai");
let { ethers } = require("hardhat");
let { time } = require("@nomicfoundation/hardhat-network-helpers");

async function sleep(sleepTime) {
  return new Promise((resolve) => setTimeout(resolve, sleepTime));
}

describe("marketplace", function () {
  this.timeout(600 * 1000);
  let purchase_price = 100;
  let contract_length = 100;
  let seller, withPOE, withoutPOE;
  let Implementation;
  let cloneFactory;
  let lumerin;
  let poe;
  let testContract;

  before(async function () {
    [seller, withPOE, withPOE1, withPOE2, withoutPOE] =
      await ethers.getSigners();
    // UNCOMMENT TO HELP WITH TEST ENVIRONMENT SETUP
    // console.log("seller address:", seller.address);
    // console.log("withPOE address:", withPOE.address);
    // console.log("withPOE1 address:", withPOE1.address);
    // console.log("withPOE2 address:", withPOE2.address);
    // console.log("withoutPOE address:", withoutPOE.address);

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

    // console.log("clone factory: ", cloneFactory.address);

    //transfer POE to required addresses
    for (addr of [withPOE, withPOE1, withPOE2]) {
      let tx = await poe.transfer(addr.address, 1);
      await tx.wait();
    }

    testContract = await Implementation.attach(
      process.env.TEST_CONTRACT_ADDRESS
    );
  });

  //account with POE token creates contract
  it("should create a contract", async function () {
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
  it("should fail contract creation", async function () {
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
  it("should purchase a contract", async function () {
    //buyer calls purchase function on clone factory

    let contract = await purchaseContracts(1, withPOE);
    expect(await contract.buyer()).to.equal(withPOE.address);
  });

  //account without POE token fails to buy a contract
  it("should failContractPurchase", async function () {
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

  describe("hash power contract", function () {
    it("should close out and distribute full price to seller minus fees", async function () {
      await testCloseout(
        3,
        (await testContract.length()) * 60 * 60,
        withPOE,
        withoutPOE
      );
    });

    it("should close out and not distribute funds", async function () {
      await testCloseout(
        2,
        (await testContract.length()) * 60 * 60,
        withPOE,
        withoutPOE
      );
    });

    it("should not close out and distribute funds approx. 50% to seller", async function () {
      const results = await testCloseout(
        1,
        ((await testContract.length()) / 2) * 60 * 60,
        withPOE,
        withoutPOE
      );
      // console.log(results);
    });

    it("should close out and distribute funds approx. 50/50", async function () {
      let contractRunDuration = (await testContract.length()) / 2;

      const results = await testCloseout(
        0,
        contractRunDuration * 60 * 60,
        withPOE,
        withoutPOE,
        withoutPOE
      );
    });

    async function testCloseout(
      closeoutType,
      closeoutAfterSeconds,
      seller,
      buyer,
      closer = seller
    ) {
      let sellerAddress = seller.address;

      let contractPrice = Number(await testContract.price());

      let sellerBalance = await lumerin.balanceOf(sellerAddress);
      let buyerBalance = await lumerin.balanceOf(buyer.address);

      // // buy the test contract for tracability in hardhat
      await purchaseContracts(1, buyer, testContract.address);

      // verify contract status "running"
      let contractState = await testContract.contractState();
      // contract state should be 1 (running)
      expect(contractState).to.equal(1);

      //verify contract balance
      let contractBalance = await lumerin.balanceOf(testContract.address);
      expect(contractBalance).to.equal(contractPrice);
      // wait for contract to expire
      await time.increase(closeoutAfterSeconds);

      await closeContract(testContract, closer, closeoutType);

      //wait for the contract to emit "contractClosed" event
      let closedEvents = await testContract.queryFilter("contractClosed");
      expect(closedEvents.length).to.be.greaterThanOrEqual(1);

      // verify contract status "available"
      let contractStateAfterCloseout = await testContract.contractState();
      expect(contractStateAfterCloseout).to.equal(0);

      //verify wallet balances after payout completes
      let sellerBalanceAfterCloseout = await lumerin.balanceOf(sellerAddress);
      let buyerBalanceAfterCloseout = await lumerin.balanceOf(buyer.address);
      let contractBalanceAfterCloseout = await lumerin.balanceOf(
        testContract.address
      );

      expect(contractBalanceAfterCloseout).to.equal(0);

      // There will be some difference between the expected payout and the actual payout given latency in the transaction
      // For the purposes of this test, pass if the percent difference between expected and actual payout is less than 1%
      const contractLength = await testContract.length();
      const contractCompletionRatio =
        closeoutAfterSeconds / (contractLength * 60 * 60);
      const expectedSellerPayout = contractCompletionRatio * contractPrice;
      const sellerPayoutDiff =
        expectedSellerPayout - (sellerBalanceAfterCloseout - sellerBalance);
      const sellerPayoutPercentError =
        (sellerPayoutDiff / expectedSellerPayout) * 100;

      expect(sellerPayoutPercentError).to.be.lessThan(1);

      const expectedBuyerPayout =
        contractPrice - contractCompletionRatio * contractPrice;
      const buyerPayoutDiff =
        expectedBuyerPayout - (buyerBalanceAfterCloseout - buyerBalance);
      const buyerPayoutPercentError =
        (buyerPayoutDiff / expectedBuyerPayout) * 100;

      expect(buyerPayoutPercentError).to.be.lessThan(1);

      return {
        sellerBalanceAfterCloseout,
        buyerBalanceAfterCloseout,
        contractBalanceAfterCloseout,
        sellerBalance,
        buyerBalance,
      };
    }
    
    //deploys a new clone factory
    //seller creates 10 hashrate contracts
    //buyer buys all 10
    //seller closes out all 10 after contract duration
    //confirm buyer can see all 10
    it("should track closeout with buyer and seller information", async function () {
      //create 10 contracts
      for (let count = 0; count < 10; count++) {
        let contractCreate = await cloneFactory
          .connect(seller)
          .setCreateNewRentalContract(1, 1, 1, 1, lumerin.address, "123");
        await contractCreate.wait();
      }

      let contracts = {};
      let purchasedContracts = {};

      //get list of contracts
      let contractAddresses = await cloneFactory.getContractList();

      for (let contract of contractAddresses) {
        let contractInstance = await Implementation.attach(contract);

        contracts[contract] = contractInstance;

        let shouldPurchase = await tryIncreaseAllowanceForContract(
          contractInstance,
          withPOE
        );

        if (shouldPurchase) {
          let purchaseContract = await cloneFactory
            .connect(withPOE)
            .setPurchaseRentalContract(contract, "123");
          await purchaseContract.wait();

          // wait for contract to expire
          await time.increase((await contractInstance.length()) * 60 * 60);
        }

        purchasedContracts[contract] = shouldPurchase;
      }

      contractCloseoutPromises = [];
      //close out all contracts with option 3
      for (let contract of contractAddresses) {
        if (purchasedContracts[contract]) {
          // force a block to be mined

          const contractInstance = contracts[contract];

          await closeContract(withPOE, contractInstance);

          let closedEvents = await contractInstance.queryFilter(
            "contractClosed"
          );

          expect(closedEvents.length).to.be.greaterThanOrEqual(1);

          let buyerHistory = await contractInstance.buyerHistory(
            withPOE.address,
            0
          );
          expect(buyerHistory.length).to.be.greaterThanOrEqual(1);

          // check the value of the funds transferred to the seller
          let sellerHistory = await contractInstance.sellerHistory(0);

          expect(sellerHistory.length).to.be.greaterThanOrEqual(1);
        }
      }

      //create an object where the key is the buyer address, and the value is a list of contract addresses

      // for (let contract of contractAddresses) {
      //   if (purchasedContracts[contract]) {

      //   }
      // }
    });

    //deploys a new clone factory
    //seller creates 10 hashrate contracts
    //buyer buys all 10 twice
    //seller closes out all 10 after contract duration
    //confirm buyer can see only 10
    it("should confirmCloseoutTrackingDouble", async function () {});

    //deploys a new clone factory
    //seller creates 10 hashrate contracts
    //buyer buys all 10 twice
    //seller closes out all 10 after contract duration
    //confirm buyer can see only 10
    it("should confirmCloseoutTrackingSeperateBuyers", async function () {});
  });
  async function closeContract(contractInstance, closer, closeoutType = 3) {
    await ethers.provider.poll();

    let closeout = await contractInstance
      .connect(closer)
      .setContractCloseOut(closeoutType);

    await closeout.wait();
  }

  async function tryIncreaseAllowanceForContract(contract1, owner) {
    let state = await contract1.contractState();

    if (state == 0) {
      let price = BigInt(await contract1.price());
      let requiredAmount = price + price / BigInt(100);

      let transfer = await lumerin
        .connect(seller)
        .transfer(owner.address, requiredAmount);
      await transfer.wait();

      let allowanceIncrease1 = await lumerin
        .connect(owner)
        .increaseAllowance(cloneFactory.address, requiredAmount);
      await allowanceIncrease1.wait();

      return true;
    }

    return false;
  }

  async function purchaseContracts(count, buyerAddress, contractAddress) {
    let contracts = await cloneFactory.getContractList();

    let contract,
      contractNumber = 0;

    if (contractAddress) {
      ({ contract, contractNumber } = await attachToContractAndIncrement(
        contractAddress,
        contractNumber
      ));
    }

    // find a contract that is in state 0
    for (let i = 0; i < contracts.length; i++) {
      if (contractNumber == count) {
        break;
      }

      contractAddress = contracts[i];

      ({ contract, contractNumber } = await attachToContractAndIncrement(
        contractAddress,
        contractNumber
      ));
    }

    await tryIncreaseAllowanceForContract(contract, buyerAddress);

    let purchaseContract = await cloneFactory
      .connect(buyerAddress)
      .setPurchaseRentalContract(contractAddress, "123");
    await purchaseContract.wait();
    //seller closes out the contract and collects the lumerin tokens
    return contract;
  }

  async function attachToContractAndIncrement(contractAddress, contractNumber) {
    let contract = await Implementation.attach(contractAddress);
    let state = await contract.contractState();
    if (state == 0) {
      contractNumber++;
    }
    return { contract, contractNumber };
  }
});
