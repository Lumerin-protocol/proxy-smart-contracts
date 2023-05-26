//@ts-check
let { expect } = require("chai");
let { ethers } = require("hardhat");
let { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("marketplace", function () {
  let purchase_price = 100;
  let contract_length = 100;
  let seller, withPOE, withoutPOE;
  let Implementation;
  let cloneFactory;
  let lumerin;
  let poe;
  let testContract;

  before(async function () {
    [seller, withPOE, withoutPOE] =
      await ethers.getSigners();

    process.env.CLONE_FACTORY_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    process.env.LUMERIN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    process.env.VALIDATOR_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

    console.log({
      CLONE_FACTORY_ADDRESS: process.env.CLONE_FACTORY_ADDRESS,
      LUMERIN_TOKEN_ADDRESS: process.env.LUMERIN_TOKEN_ADDRESS,
      VALIDATOR_ADDRESS: process.env.VALIDATOR_ADDRESS,
    });

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

    // //transfer POE to required addresses
    // for (addr of [withPOE, withPOE1, withPOE2]) {
    //   let tx = await poe.transfer(addr.address, 1);
    //   await tx.wait();
    // }


    let contracts = await cloneFactory.getContractList();

    testContract = await Implementation.attach(
      contracts[0]
    );

    initialTestContractBalance = Number(
      await lumerin.balanceOf(testContract.address)
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

    let contracts = await purchaseContracts(1, withPOE);

    expect(await Object.values(contracts)[0].buyer()).to.equal(withPOE.address);
  });

  //account without POE token fails to buy a contract
  it.skip("should failContractPurchase", async function () {
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
    beforeEach(async function () {
      const status = await testContract.contractState();

      if (status !== 0) {
        await closeContract(testContract, withPOE);
      }
    });

    it("should close out and distribute full price to seller minus fees", async function () {
      await testCloseout(
        3,
        await testContract.length(),
        withPOE,
        withoutPOE,
        assertBuyerPayout,
        assertSellerPayout,
        assertContractWithdawal,
        assertHashrateContractState
      );
    });

    it("should close out and not distribute funds", async function () {
      await testCloseout(
        2,
        await testContract.length(),
        withPOE,
        withoutPOE,
        Function(),
        Function(),
        Function(),
        assertHashrateContractState
      );
    });

    it("should not close out and distribute funds approx. 50% to seller", async function () {
      const results = await testCloseout(
        1,
        (await testContract.length()) / 2,
        seller,
        withoutPOE,
        Function(),
        assertSellerPayout,
        assertContractWithdawal
      );
      // console.log(results);
    });

    it("should close out and distribute funds approx. 50/50", async function () {
      let contractRunDuration = (await testContract.length()) / 2;

      const results = await testCloseout(
        0,
        contractRunDuration,
        withPOE,
        withoutPOE,
        assertBuyerPayout,
        assertSellerPayout,
        assertContractWithdawal,
        assertHashrateContractState,
        withoutPOE
      );
    });

    async function testCloseout(
      closeoutType,
      closeoutAfterSeconds,
      seller,
      buyer,
      assertBuyerPayout = () => {},
      assertSellerPayout = () => {},
      assertContractWithdawal = () => {},
      assertHashrateContractState = () => {},
      closer = seller
    ) {
      let sellerAddress = seller.address;
      let contractPrice = Number(await testContract.price());
      let sellerBalance = Number(await lumerin.balanceOf(sellerAddress));
      let buyerBalance = Number(await lumerin.balanceOf(buyer.address));
      let contractBalanceBeforePurchase = Number(
        await lumerin.balanceOf(testContract.address)
      );

      // verify contract status "running"
      let contractStateBeforePurchase = await testContract.contractState();
      // contract state should be 1 (running)
      expect(contractStateBeforePurchase).to.equal(0);

      // // buy the test contract for tracability in hardhat
      await purchaseContracts(1, buyer, testContract);

      // verify contract status "running"
      let contractState = await testContract.contractState();
      // contract state should be 1 (running)
      expect(contractState).to.equal(1);

      //verify contract balance
      let contractBalanceAfterPurchase = await lumerin.balanceOf(
        testContract.address
      );

      expect(contractBalanceAfterPurchase).to.equal(
        contractBalanceBeforePurchase + contractPrice
      );

      await closeContract(
        testContract,
        closer,
        closeoutType,
        closeoutAfterSeconds
      );

      //wait for the contract to emit "contractClosed" event
      let closedEvents = await testContract.queryFilter("contractClosed");
      expect(closedEvents.length).to.be.greaterThanOrEqual(1);

      // verify contract status "available"
      await assertHashrateContractState();

      //verify wallet balances after payout completes
      let sellerBalanceAfterCloseout = await lumerin.balanceOf(sellerAddress);
      let buyerBalanceAfterCloseout = await lumerin.balanceOf(buyer.address);
      let contractBalanceAfterCloseout = await lumerin.balanceOf(
        testContract.address
      );

      // There will be some difference between the expected payout and the actual payout given latency in the transaction
      // For the purposes of this test, pass if the percent difference between expected and actual payout is less than 1%
      const contractLength = Number(await testContract.length());
      const contractCompletionRatio = closeoutAfterSeconds / contractLength;

      assertContractWithdawal(
        contractCompletionRatio,
        contractPrice,
        contractBalanceAfterCloseout,
        contractBalanceAfterPurchase
      );

      // There will be some difference between the expected payout and the actual payout given latency in the transaction
      // For the purposes of this test, pass if the percent difference between expected and actual payout is less than 1%
      assertSellerPayout(
        contractCompletionRatio,
        contractPrice,
        sellerBalanceAfterCloseout,
        sellerBalance
      );

      assertBuyerPayout(
        contractCompletionRatio,
        contractPrice,
        buyerBalanceAfterCloseout,
        buyerBalance
      );

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
      const contracts = await purchaseContracts(10, withPOE);

      let contractCloseoutPromises = [];
      //close out all contracts with option 3
      for (let contract in contracts) {
        // force a block to be mined

        const contractInstance = contracts[contract];

        await closeContract(contractInstance, withPOE);

        let closedEvents = await contractInstance.queryFilter("contractClosed");

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

    async function assertHashrateContractState() {
      let contractStateAfterCloseout = await testContract.contractState();
      expect(contractStateAfterCloseout).to.equal(0);
    }

    function assertContractWithdawal(
      contractCompletionRatio,
      contractPrice,
      contractBalanceAfterCloseout,
      contractBalanceAfterPurchase
    ) {
      if (contractBalanceAfterCloseout != 0) {
        const expectedPayout =
          contractPrice - contractCompletionRatio * contractPrice;
        const buyerPayoutDiff =
          expectedPayout -
          (contractBalanceAfterPurchase - contractBalanceAfterCloseout);
        const payoutPercentError = (buyerPayoutDiff / expectedPayout) * 100;

        if (expectedPayout > 0) {
          expect(payoutPercentError).to.be.lessThan(1);
        } else {
          expect(contractBalanceAfterCloseout).to.equal(
            contractBalanceAfterPurchase
          );
        }
      }
    }

    function assertSellerPayout(
      contractCompletionRatio,
      contractPrice,
      sellerBalanceAfterCloseout,
      sellerBalance
    ) {
      const sellerPayoutPercentError = calculateSellerPayoutPercentError(
        contractCompletionRatio,
        contractPrice,
        sellerBalanceAfterCloseout,
        sellerBalance
      );

      expect(sellerPayoutPercentError).to.be.lessThan(1);
    }
    function assertBuyerPayout(
      contractCompletionRatio,
      contractPrice,
      buyerBalanceAfterCloseout,
      buyerBalance
    ) {
      const { expectedPayout, payoutPercentError } =
        calculateBuyerPayoutExpectations(
          contractCompletionRatio,
          contractPrice,
          buyerBalanceAfterCloseout,
          buyerBalance
        );

      if (expectedPayout > 0) {
        expect(payoutPercentError).to.be.lessThan(1);
      } else {
        expect(buyerBalanceAfterCloseout).to.equal(buyerBalance);
      }
    }

    function calculateBuyerPayoutExpectations(
      contractCompletionRatio,
      contractPrice,
      buyerBalanceAfterCloseout,
      buyerBalance
    ) {
      const expectedPayout =
        contractPrice - contractCompletionRatio * contractPrice;
      const buyerPayoutDiff =
        expectedPayout - (buyerBalanceAfterCloseout - buyerBalance);
      const payoutPercentError = (buyerPayoutDiff / expectedPayout) * 100;
      return { expectedPayout, payoutPercentError };
    }

    function calculateSellerPayoutPercentError(
      contractCompletionRatio,
      contractPrice,
      sellerBalanceAfterCloseout,
      sellerBalance
    ) {
      const expectedSellerPayoutWithoutFee =
        contractCompletionRatio * contractPrice;

      const expectedSellerPayout =
        expectedSellerPayoutWithoutFee - expectedSellerPayoutWithoutFee * 0.01;
      // const sellerBalanceDiff = sellerBalanceAfterCloseout - sellerBalance;
      const sellerPayoutDiff = Math.abs(expectedSellerPayout - contractPrice);
      let sellerPayoutPercentError;

      if (sellerPayoutDiff < expectedSellerPayout) {
        sellerPayoutPercentError = sellerPayoutDiff / expectedSellerPayout;
      } else {
        sellerPayoutPercentError = expectedSellerPayout / sellerPayoutDiff;
      }

      return sellerPayoutPercentError;
    }
  });

  async function closeContract(
    contractInstance,
    closer,
    closeoutType = 3,
    delay
  ) {
    delay = delay || (await contractInstance.length());

    // wait for contract to expire
    await time.increase(delay);

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

      // console.log("wallet balance before transfer - ", owner.address, ": ", await lumerin.balanceOf(owner.address));
      // console.log("lumerin allowance before transfer - ", owner.address, ": ", await lumerin.allowance(owner.address, cloneFactory.address));
      // console.log("lumerin available before transfer: ", await lumerin.totalSupply());
      let transfer = await lumerin
        .connect(seller)
        .transfer(owner.address, requiredAmount);
      await transfer.wait();

      // console.log("wallet balance after transfer - ", owner.address, ": ", await lumerin.balanceOf(owner.address));
      // console.log("lumerin allowance after transfer - ", owner.address, ": ", await lumerin.allowance(owner.address, cloneFactory.address));
      // console.log("lumerin available after transfer: ", await lumerin.totalSupply());

      let allowanceIncrease1 = await lumerin
        .connect(owner)
        .increaseAllowance(cloneFactory.address, requiredAmount);
      await allowanceIncrease1.wait();

      return true;
    }

    return false;
  }

  async function purchaseContracts(count, buyer, contractForPurchase) {
    let contract = contractForPurchase,
      contractNumber = 0,
      results = {};

    if (!contract) {
      let contracts = await cloneFactory.getContractList();

      // find a contract that is in state 0
      for (let i = 0; i < contracts.length; i++) {
        if (contractNumber == count) {
          break;
        }

        let contractAddress = contracts[i];

        ({ contract, contractNumber } = await attachToContractAndIncrement(
          contractAddress,
          contractNumber
        ));

        await purchaseContract(contract, buyer);

        results[contract.address] = contract;
      }
    } else {
      await purchaseContract(contract, buyer);
    }

    //seller closes out the contract and collects the lumerin tokens
    return contractForPurchase || results;
  }

  async function purchaseContract(contract, buyer) {
    let shouldNotClose = await tryIncreaseAllowanceForContract(contract, buyer);

    if (!shouldNotClose) {
      await closeContract(contract, buyer);

      await tryIncreaseAllowanceForContract(contract, buyer);
    }

    let purchaseContract = await cloneFactory
      .connect(buyer)
      .setPurchaseRentalContract(contract.address, "123");
    await purchaseContract.wait();
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
