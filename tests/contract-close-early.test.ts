import { expect } from "chai";
import ethers from "hardhat";
import Web3 from "web3";
import { Lumerin, CloneFactory, Implementation } from "../build-js/dist";
import {
  AdvanceBlockTime,
  CloseReason,
  LocalTestnetAddresses,
  expectIsError,
} from "./utils";

describe("Contract close early", function () {
  const {
    lumerinAddress,
    cloneFactoryAddress,
    owner,
    seller,
    buyer,
    validatorAddr,
    account3,
  } = LocalTestnetAddresses;

  const web3 = new Web3(ethers.config.networks.localhost.url);
  const cf = CloneFactory(web3, cloneFactoryAddress);
  const lumerin = Lumerin(web3, lumerinAddress);
  let fee = "";

  const price = String(1_000);
  const speed = String(1_000_000);
  const length = String(3600);
  const version = String(0);

  before(async () => {
    const topUpLmr = 100 * Number(price);
    await lumerin.methods
      .increaseAllowance(cloneFactoryAddress, String(topUpLmr))
      .send({ from: buyer });
    await lumerin.methods
      .transfer(buyer, String(topUpLmr))
      .send({ from: owner });
    await cf.methods.setAddToWhitelist(seller).send({ from: owner });
    fee = await cf.methods.marketplaceFee().call();
  });

  it("should verify balances after 0% early closeout", async function () {
    await testEarlyCloseout(
      0,
      fee,
      seller,
      buyer,
      cloneFactoryAddress,
      lumerinAddress,
      web3,
    );
  });

  it("should verify balances after 1% early closeout", async function () {
    await testEarlyCloseout(
      0.01,
      fee,
      seller,
      buyer,
      cloneFactoryAddress,
      lumerinAddress,
      web3,
    );
  });

  it("should verify balances after 10% early closeout", async function () {
    await testEarlyCloseout(
      0.1,
      fee,
      seller,
      buyer,
      cloneFactoryAddress,
      lumerinAddress,
      web3,
    );
  });

  it("should verify balances after 50% early closeout", async function () {
    await testEarlyCloseout(
      0.5,
      fee,
      seller,
      buyer,
      cloneFactoryAddress,
      lumerinAddress,
      web3,
    );
  });

  it("should verify balances after 75% early closeout", async function () {
    await testEarlyCloseout(
      0.75,
      fee,
      seller,
      buyer,
      cloneFactoryAddress,
      lumerinAddress,
      web3,
    );
  });

  it("should fail early closeout when progress of the contract is 100%", async function () {
    try {
      await testEarlyCloseout(
        1,
        fee,
        seller,
        buyer,
        cloneFactoryAddress,
        lumerinAddress,
        web3,
      );
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("the contract is not in the running state");
    }
  });

  it("should disallow early closeout called second time", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(
        price,
        "0",
        speed,
        length,
        "0",
        cloneFactoryAddress,
        "123",
      )
      .send({ from: seller, value: fee });
    const hrContractAddr =
      receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "abc",
        "def",
        0,
      )
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, 1);

    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.closeEarly(0).send({ from: buyer });

    try {
      await impl.methods.closeEarly(0).send({ from: buyer });
      expect.fail("should not allow closeout type 0 twice");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("the contract is not in the running state");
    }
  });

  it("should not reqiure fee for earlyCloseout", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(
        price,
        "0",
        speed,
        length,
        "0",
        cloneFactoryAddress,
        "123",
      )
      .send({ from: seller, value: fee });
    const hrContractAddr =
      receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "abc",
        "def",
        0,
      )
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, 1);

    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.closeEarly(0).send({ from: buyer, value: 0 });
  });

  it("should allow earlyCloseout done by buyer", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(
        price,
        "0",
        speed,
        length,
        "0",
        cloneFactoryAddress,
        "123",
      )
      .send({ from: seller, value: fee });
    const hrContractAddr =
      receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "abc",
        "def",
        0,
      )
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, 1);

    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.closeEarly(0).send({ from: buyer, value: 0 });
  });

  it("should allow earlyCloseout done by validator", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(
        price,
        "0",
        speed,
        length,
        "0",
        cloneFactoryAddress,
        "123",
      )
      .send({ from: seller, value: fee });
    const hrContractAddr =
      receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "abc",
        "def",
        0,
      )
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, 1);

    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.closeEarly(0).send({ from: validatorAddr });
  });

  it("should not allow earlyCloseout done by non-buyer or non-validator", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(
        price,
        "0",
        speed,
        length,
        "0",
        cloneFactoryAddress,
        "123",
      )
      .send({ from: seller, value: fee });
    const hrContractAddr =
      receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "abc",
        "def",
        0,
      )
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, 1);

    const impl = Implementation(web3, hrContractAddr);
    try {
      await impl.methods.closeEarly(0).send({ from: account3 });
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes(
        "this account is not authorized to trigger an early closeout",
      );
    }
  });

  it("should not allow earlyCloseout when contract is not in running state", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(
        price,
        "0",
        speed,
        length,
        "0",
        cloneFactoryAddress,
        "123",
      )
      .send({ from: seller, value: fee });
    const hrContractAddr =
      receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "abc",
        "def",
        0,
      )
      .send({ from: buyer, value: fee });

    const impl = Implementation(web3, hrContractAddr);
    try {
      await impl.methods.closeEarly(0).send({ from: buyer });
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("the contract is not in the running state");
    }
  });

  it('should update last history entry to "bad closeout" if early closeout was called', async function () {
    // create
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(
        price,
        "0",
        speed,
        length,
        "0",
        cloneFactoryAddress,
        "123",
      )
      .send({ from: seller, value: fee });
    const hrContractAddr =
      receipt.events?.contractCreated.returnValues._address;

    // purchase
    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "abc",
        "def",
        0,
      )
      .send({ from: buyer, value: fee });

    // check history before closeout
    const impl = Implementation(web3, hrContractAddr);
    const [historyEntryBefore] = await impl.methods.getHistory("0", "1").call();
    expect(historyEntryBefore._goodCloseout).equal(true);

    // close early
    await AdvanceBlockTime(web3, 1);
    await impl.methods.closeEarly(0).send({ from: buyer });

    // check history after closeout
    const [historyEntryAfter] = await impl.methods.getHistory("0", "1").call();
    expect(historyEntryAfter._goodCloseout).equal(false);
  });

  it("should apply future terms", async function () {
    const expTerms = {
      price: String(+price * 2),
      speed: String(+speed * 2),
      length: String(+length * 2),
      version: String(+version + 1),
      profitTarget: String(10),
    };

    // create
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(
        price,
        "0",
        speed,
        length,
        "0",
        cloneFactoryAddress,
        "123",
      )
      .send({ from: seller, value: fee });
    const hrContractAddr =
      receipt.events?.contractCreated.returnValues._address;

    // purchase
    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "abc",
        "def",
        0,
      )
      .send({ from: buyer, value: fee });

    // update terms
    await cf.methods
      .setUpdateContractInformationV2(
        hrContractAddr,
        expTerms.price,
        "0",
        expTerms.speed,
        expTerms.length,
        expTerms.profitTarget,
      )
      .send({ from: seller });

    // close early
    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.closeEarly(0).send({ from: buyer });

    // check terms updated
    const newTerms = await impl.methods.terms().call();
    expect(newTerms).deep.include({
      _length: expTerms.length,
      _limit: "0",
      _price: expTerms.price,
      _profitTarget: expTerms.profitTarget,
      _speed: expTerms.speed,
      _version: expTerms.version,
    });
  });

  it("should emit closedEarly(reason) event", async function () {
    // create
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(
        price,
        "0",
        speed,
        length,
        "0",
        cloneFactoryAddress,
        "123",
      )
      .send({ from: seller, value: fee });
    const hrContractAddr =
      receipt.events?.contractCreated.returnValues._address;

    // purchase
    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "abc",
        "def",
        0,
      )
      .send({ from: buyer, value: fee });

    // close early
    await AdvanceBlockTime(web3, 1);
    const impl = Implementation(web3, hrContractAddr);
    const receiptCloseEarly = await impl.methods
      .closeEarly(CloseReason.ShareTimeout)
      .send({ from: buyer });
    const { closedEarly } = receiptCloseEarly.events as any;
    expect(closedEarly).to.be.an("object");
    expect(closedEarly.returnValues._reason).equal(CloseReason.ShareTimeout);
  });
});

/** @param progress 0.0 - 1.0 early closeout contract progress */
async function testEarlyCloseout(
  progress: number,
  fee: string,
  seller: string,
  buyerOrValidator: string,
  cloneFactoryAddress: string,
  lumerinAddress: string,
  web3: Web3,
) {
  const cf = CloneFactory(web3, cloneFactoryAddress);
  const lumerin = Lumerin(web3, lumerinAddress);
  const speed = String(1_000_000);
  const length = String(3600);
  const price = String(1_000);
  const version = String(0);

  const receipt = await cf.methods
    .setCreateNewRentalContractV2(
      price,
      "0",
      speed,
      String(length),
      "0",
      cloneFactoryAddress,
      "123",
    )
    .send({ from: seller, value: fee });
  const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

  await cf.methods
    .setPurchaseRentalContractV2(
      hrContractAddr,
      buyerOrValidator,
      "abc",
      "def",
      version,
    )
    .send({ from: buyerOrValidator, value: fee });

  const sellerBalance = Number(await lumerin.methods.balanceOf(seller).call());
  const buyerBalance = Number(
    await lumerin.methods.balanceOf(buyerOrValidator).call(),
  );

  await AdvanceBlockTime(web3, progress * Number(length));

  // closeout by buyer
  const impl = Implementation(web3, hrContractAddr);
  await impl.methods.closeEarly(0).send({ from: buyerOrValidator });

  const buyerBalanceAfter = Number(
    await lumerin.methods.balanceOf(buyerOrValidator).call(),
  );
  const deltaBuyerBalance = buyerBalanceAfter - buyerBalance;
  const buyerRefundFraction = 1 - progress;
  const buyerRefundAmount = buyerRefundFraction * Number(price);

  expect(deltaBuyerBalance).equal(
    buyerRefundAmount,
    `buyer should be ${buyerRefundFraction * 100}% refunded`,
  );

  // claim by seller
  await impl.methods.claimFunds().send({ from: seller, value: fee });
  const sellerBalanceAfter = Number(
    await lumerin.methods.balanceOf(seller).call(),
  );
  const deltaSellerBalance = sellerBalanceAfter - sellerBalance;
  const sellerClaimFraction = progress;
  const sellerClaimAmount = sellerClaimFraction * Number(price);
  expect(deltaSellerBalance).equal(
    sellerClaimAmount,
    `seller should collect ${sellerClaimFraction * 100} of the price`,
  );
}
