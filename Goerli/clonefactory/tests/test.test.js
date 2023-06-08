//@ts-check
let { expect } = require("chai");
let { config, ethers } = require("hardhat");
let { time } = require("@nomicfoundation/hardhat-network-helpers");
const { Lumerin, Implementation, CloneFactory } = require("../build-js/dist");
const Web3 = require("web3");

describe("marketplace", function () {
  let purchase_price = 100;
  let contract_length = 100;
  let seller, withPOE, withoutPOE;
  let cloneFactory;
  let lumerin;
  let poe;
  let testContract;

  /** @type {import("web3").default} */
  let web3 = new Web3(config.networks.localhost.url);

  before(async function () {
    [seller, withPOE, withoutPOE] = await ethers.getSigners();

    process.env.CLONE_FACTORY_ADDRESS =
      "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    process.env.LUMERIN_TOKEN_ADDRESS =
      "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    process.env.VALIDATOR_ADDRESS =
      "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    console.log({
      CLONE_FACTORY_ADDRESS: process.env.CLONE_FACTORY_ADDRESS,
      LUMERIN_TOKEN_ADDRESS: process.env.LUMERIN_TOKEN_ADDRESS,
      VALIDATOR_ADDRESS: process.env.VALIDATOR_ADDRESS,
    });

    // Implementation = await ethers.getContractFactory("Implementation");

    //deploy lumeirn token
    // let Lumerin = await ethers.getContractFactory("Lumerin");

    let lumerinAttachErr = null;

    try {
      lumerin = Lumerin(web3, process.env.LUMERIN_TOKEN_ADDRESS);
    } catch (e) {
      lumerinAttachErr = e;
      console.log(
        "error attaching to LUMERIN_TOKEN_ADDRESS, deploying new token; error: ",
        e
      );
    }

    // if (lumerinAttachErr) {
    //   lumerin = await Lumerin.deploy();
    //   await lumerin.deployed();
    // }

    //deploy POE token
    // let POE = await ethers.getContractFactory("Lumerin");
    // poe = await POE.deploy();
    // await poe.deployed();

    // let CloneFactory = await ethers.getContractFactory("CloneFactory");

    let cloneFactoryAttachErr = null;
    try {
      cloneFactory = CloneFactory(web3, process.env.CLONE_FACTORY_ADDRESS);
    } catch (e) {
      cloneFactoryAttachErr = e;
      console.log(
        "error attaching to clone factory, deploying new one; error: ",
        e
      );
    }

    if (cloneFactoryAttachErr) {
      //deploying with the lumerin as the address collecting titans lumerin
      // cloneFactory = await CloneFactory.deploy(
      //   lumerin.address,
      //   process.env.VALIDATOR_ADDRESS
      //   //      poe.address
      // );
      // await cloneFactory.deployed();
    }

    let contracts = await cloneFactory.methods.getContractList().call();

    testContract = Implementation(web3, contracts[0]);

    initialTestContractBalance = Number(
      await lumerin.methods.balanceOf(testContract.options.address)
    );
  });

  //account with POE token creates contract
  it("should create a contract", async function () {
    let contractsBefore = await cloneFactory.methods.getContractList().call();

    let contractCreate = await cloneFactory.methods
      .setCreateNewRentalContract(
        purchase_price,
        10,
        10,
        contract_length,
        lumerin.options.address,
        lumerin.options.address //validator placeholder
      )
      .send({ from: seller.address });

    let contractsAfter = await cloneFactory.methods.getContractList().call();

    expect(contractsAfter.length - contractsBefore.length).to.equal(1);
  });

  //account without POE token fails to create a contract
  it("should fail contract creation", async function () {
    let contractsBefore = await cloneFactory.methods.getContractList();
    try {
      let contractCreate = await cloneFactory.methods
        .setCreateNewRentalContract(
          purchase_price,
          10,
          10,
          contract_length,
          lumerin.options.address,
          "123",
          "private key"
        )
        .send({ from: withoutPOE.address });
    } catch {}
    let contractsAfter = await cloneFactory.methods.getContractList();
    expect(contractsAfter.length).to.equal(contractsBefore.length);
  });

  //account with POE token buys a contract
  it("should purchase a contract", async function () {
    //buyer calls purchase function on clone factory

    let contracts = await purchaseContracts(1, withPOE);

    expect(await Object.values(contracts)[0].methods.buyer().call()).to.equal(
      withPOE.address
    );
  });

  //account without POE token fails to buy a contract
  it.skip("should failContractPurchase", async function () {
    //buyer calls purchase function on clone factory

    let contracts = await cloneFactory.methods.getContractList();
    let contractAddress = contracts[contracts.length - 1];
    try {
      let purchaseContract = await cloneFactory
        .setPurchaseRentalContract(contractAddress, "123")
        .send({ from: withoutPOE.address });
    } catch {}
    //seller closes out the contract and collects the lumerin tokens
    let contract1 = await Implementation(web3, contractAddress);
    let contractBuyer = await contract1.buyer();
    expect(contractBuyer).to.not.equal(withoutPOE.address);
  });

  describe("hash power contract", function () {
    let testContract;
    beforeEach(async function () {
      let contracts = await cloneFactory.methods.getContractList().call();

      testContract = Implementation(
        web3,
        contracts[0]
        // process.env.TEST_CONTRACT_ADDRESS
      );
      const status = await testContract.methods.contractState();

      if (status !== 0) {
        await closeContract(testContract, withPOE);
      }
    });

    it("should close out and distribute full price to seller minus fees", async function () {
      await testCloseout(
        3,
        await testContract.methods.length().call(),
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
        await testContract.methods.length().call(),
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
        (await testContract.methods.length().call()) / 2,
        seller,
        withoutPOE,
        Function(),
        assertSellerPayout,
        assertContractWithdawal
      );
      // console.log(results);
    });

    it("should close out and distribute funds approx. 50/50 (buyer balance and contract balance)", async function () {
      let contractRunDuration =
        (await testContract.methods.length().call()) / 2;

      const assertContractWithdawal = (
        contractCompletionRatio,
        contractPrice,
        contractBalanceAfterCloseout,
        contractBalanceAfterPurchase
      ) => {
        const expectedPayout =
          contractPrice - contractCompletionRatio * contractPrice;

        expect(contractBalanceAfterCloseout).to.be.equal(contractBalanceAfterPurchase - expectedPayout);
      };

      const results = await testCloseout(
        0,
        contractRunDuration,
        withPOE,
        withoutPOE,
        assertBuyerPayout,
        Function(),
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
      let contractPrice = Number(await testContract.methods.price().call());
      let sellerBalance = Number(
        await lumerin.methods.balanceOf(sellerAddress).call()
      );
      let buyerBalance = Number(
        await lumerin.methods.balanceOf(buyer.address).call()
      );
      let contractBalanceBeforePurchase = Number(
        await lumerin.methods.balanceOf(testContract.options.address).call()
      );
      expect(contractBalanceBeforePurchase).to.not.NaN;

      // verify contract status "running"
      let contractStateBeforePurchase = Number(
        await testContract.methods.contractState().call()
      );
      console.log("contractStateBeforePurchase: ", contractStateBeforePurchase);
      // contract state should be 1 (running)
      expect(contractStateBeforePurchase).to.equal(0);

      // // buy the test contract for tracability in hardhat
      await purchaseContracts(1, buyer, testContract);

      // verify contract status "running"
      let contractState = await testContract.methods.contractState().call();
      // contract state should be 1 (running)

      expect(contractState).to.not.NaN;
      expect(Number(contractState)).to.equal(1);

      //verify contract balance
      let contractBalanceAfterPurchase = await lumerin.methods
        .balanceOf(testContract.options.address)
        .call();

      expect(contractBalanceAfterPurchase).to.not.NaN;
      expect(Number(contractBalanceAfterPurchase)).to.equal(
        Number(contractBalanceBeforePurchase) + contractPrice
      );

      await closeContract(
        testContract,
        closer,
        closeoutType,
        closeoutAfterSeconds
      );

      //wait for the contract to emit "contractClosed" event
      let closedEvents = await testContract.getPastEvents("contractClosed");

      if (closeoutType != 1) {
        expect(closedEvents.length).to.be.greaterThanOrEqual(1);
      } else {
        expect(closedEvents.length).to.equal(0);
      }
      // verify contract status "available"
      await assertHashrateContractState();

      //verify wallet balances after payout completes
      let sellerBalanceAfterCloseout = await lumerin.methods
        .balanceOf(sellerAddress)
        .call();
      let buyerBalanceAfterCloseout = await lumerin.methods
        .balanceOf(buyer.address)
        .call();
      let contractBalanceAfterCloseout = await lumerin.methods
        .balanceOf(testContract.options.address)
        .call();

      // There will be some difference between the expected payout and the actual payout given latency in the transaction
      // For the purposes of this test, pass if the percent difference between expected and actual payout is less than 1%
      const contractLength = Number(await testContract.methods.length().call());

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
    //
    //TODO: fix test so it doesn't interfere with other deployed contracts
    it.skip("should track closeout with buyer and seller information", async function () {
      const contracts = await purchaseContracts(10, withPOE);

      let contractCloseoutPromises = [];
      //close out all contracts with option 3
      for (let contract in contracts) {
        // force a block to be mined

        const contractInstance = contracts[contract];

        await closeContract(contractInstance, withPOE);

        let closedEvents = await contractInstance.getPastEvents(
          "contractClosed"
        );

        expect(closedEvents.length).to.be.greaterThanOrEqual(1);

        let buyerHistory = await contractInstance.methods
          .buyerHistory(withPOE.address, 0)
          .call();

        expect(buyerHistory._purchaseTime).to.not.NaN;
        expect(parseInt(buyerHistory._purchaseTime)).to.be.greaterThanOrEqual(
          1
        );

        // check the value of the funds transferred to the seller
        let sellerHistory = await contractInstance.methods
          .sellerHistory(0)
          .call();

        expect(sellerHistory._purchaseTime).to.not.NaN;
        expect(parseInt(sellerHistory._purchaseTime)).to.be.greaterThanOrEqual(
          1
        );
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
      let contractStateAfterCloseout = await testContract.methods
        .contractState()
        .call();
      expect(Number(contractStateAfterCloseout)).to.equal(0);
    }

    function assertContractWithdawal(
      contractCompletionRatio,
      contractPrice,
      contractBalanceAfterCloseout,
      contractBalanceAfterPurchase
    ) {
      if (contractBalanceAfterCloseout != 0) {
        const expectedPayout =
          contractPrice - contractCompletionRatio * contractPrice; // 5 lmr
        const buyerPayoutDiff =
          expectedPayout - 
          (contractBalanceAfterPurchase - contractBalanceAfterCloseout); // 5 lmr - (10lmr - 5 lmr)
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
        expect(Number(buyerBalanceAfterCloseout)).to.equal(buyerBalance);
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
    delay = delay || (await contractInstance.methods.length().call());

    // wait for contract to expire
    await time.increase(Number(delay) + 60);

    let closeout = await contractInstance.methods
      .setContractCloseOut(closeoutType)
      .send({ from: closer.address });

    // await closeout.wait();
  }

  async function tryIncreaseAllowanceForContract(contract1, owner) {
    let state = await contract1.methods.contractState().call();

    if (state == 0) {
      let price = BigInt(await contract1.methods.price().call());
      let requiredAmount = price + price / BigInt(100);
      // console.log("wallet balance before transfer - ", owner.address, ": ", await lumerin.balanceOf(owner.address));
      // console.log("lumerin allowance before transfer - ", owner.address, ": ", await lumerin.allowance(owner.address, cloneFactory.address));
      // console.log("lumerin available before transfer: ", await lumerin.totalSupply());
      let transfer = await lumerin.methods
        .transfer(owner.address, requiredAmount)
        .send({ from: seller.address });

      // console.log("wallet balance after transfer - ", owner.address, ": ", await lumerin.balanceOf(owner.address));
      // console.log("lumerin allowance after transfer - ", owner.address, ": ", await lumerin.allowance(owner.address, cloneFactory.address));
      // console.log("lumerin available after transfer: ", await lumerin.totalSupply());

      let allowanceIncrease1 = await lumerin.methods
        .increaseAllowance(cloneFactory.options.address, requiredAmount)
        .send({ from: owner.address });

      return true;
    }

    return false;
  }

  async function purchaseContracts(count, buyer, contractForPurchase) {
    let contract = contractForPurchase,
      contractNumber = 0,
      results = {};

    if (!contract) {
      let contracts = await cloneFactory.methods.getContractList().call();

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

    let purchaseContract = await cloneFactory.methods
      .setPurchaseRentalContract(contract.options.address, "123")
      .send({ from: buyer.address });
  }

  async function attachToContractAndIncrement(contractAddress, contractNumber) {
    let contract = await Implementation(web3, contractAddress);
    let state = await contract.methods.contractState().call();

    if (state == 0) {
      contractNumber++;
    }

    return { contract, contractNumber };
  }
});
