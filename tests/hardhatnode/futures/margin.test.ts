import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployFuturesFixture } from "./fixtures";
import { catchError } from "../../lib";

async function positionWithMarginFixture() {
  const data = await loadFixture(deployFuturesFixture);
  const { contracts, accounts, config } = data;
  const { futures } = contracts;
  const { seller, buyer } = accounts;

  const entryPricePerDay = await futures.read.getMarketPrice();
  const margin = entryPricePerDay * 2n;
  const deliveryDate = config.deliveryDates[0];

  // Add margin for both participants
  await futures.write.addMargin([margin], { account: seller.account });
  await futures.write.addMargin([margin], { account: buyer.account });

  // Create a position by matching orders
  await futures.write.createOrder([entryPricePerDay, deliveryDate, "", -1], {
    account: seller.account,
  });
  await futures.write.createOrder([entryPricePerDay, deliveryDate, "", 1], {
    account: buyer.account,
  });

  return {
    ...data,
    entryPricePerDay,
    margin,
    deliveryDate,
  };
}

describe("Futures - getMinMargin", function () {
  it("should return larger value when buyer is at loss", async function () {
    const { contracts, accounts } = await loadFixture(positionWithMarginFixture);
    const { futures, hashrateOracle } = contracts;
    const { buyer, seller } = accounts;

    const buyerMargin = await futures.read.getMinMargin([buyer.account.address]);
    const sellerMargin = await futures.read.getMinMargin([seller.account.address]);

    expect(sellerMargin === buyerMargin).to.be.true; // at market price only

    const marketPricePerDay = await futures.read.getMarketPrice();
    const hashesForBTC = await hashrateOracle.read.getHashesForBTC();
    await hashrateOracle.write.setHashesForBTC([(hashesForBTC.value * 110n) / 100n]);
    const newMarketPricePerDay = await futures.read.getMarketPrice();

    expect(newMarketPricePerDay < marketPricePerDay).to.be.true;
    const buyerMargin2 = await futures.read.getMinMargin([buyer.account.address]);
    const sellerMargin2 = await futures.read.getMinMargin([seller.account.address]);

    expect(buyerMargin2 > buyerMargin).to.be.true;
    expect(sellerMargin2 < sellerMargin).to.be.true;
  });

  it("should return smaller value when buyer is at profit", async function () {
    const { contracts, accounts } = await loadFixture(positionWithMarginFixture);
    const { futures, hashrateOracle } = contracts;
    const { buyer, seller } = accounts;

    const buyerMargin = await futures.read.getMinMargin([buyer.account.address]);
    const sellerMargin = await futures.read.getMinMargin([seller.account.address]);

    expect(sellerMargin === buyerMargin).to.be.true; // at market price only

    const marketPricePerDay = await futures.read.getMarketPrice();
    const hashesForBTC = await hashrateOracle.read.getHashesForBTC();
    await hashrateOracle.write.setHashesForBTC([(hashesForBTC.value * 90n) / 100n]);
    const newMarketPricePerDay = await futures.read.getMarketPrice();

    expect(newMarketPricePerDay > marketPricePerDay).to.be.true;
    const buyerMargin2 = await futures.read.getMinMargin([buyer.account.address]);
    const sellerMargin2 = await futures.read.getMinMargin([seller.account.address]);
    expect(buyerMargin2 < buyerMargin).to.be.true;
    expect(sellerMargin2 > sellerMargin).to.be.true;
  });

  it("effective margin can go negative for expensive sell", async function () {
    const { contracts, accounts } = await loadFixture(positionWithMarginFixture);
    const { futures } = contracts;

    const marketPricePerDay = await futures.read.getMarketPrice();

    const buyerMargin = await futures.read.getMinMarginForPosition([marketPricePerDay * 100n, -1n]);
    expect(buyerMargin < 0n).to.be.true;
  });

  it("party cant withdraw so balance is less than effective margin", async function () {
    const { contracts, accounts, margin } = await loadFixture(positionWithMarginFixture);
    const { futures } = contracts;
    const { buyer } = accounts;
    const currentBalance = await futures.read.balanceOf([buyer.account.address]);
    await catchError(futures.abi, "InsufficientMarginBalance", async () => {
      await futures.write.removeMargin([currentBalance], { account: buyer.account.address });
    });

    const buyerMargin = await futures.read.getMinMargin([buyer.account.address]);
    const availableToWithdraw = currentBalance - buyerMargin;
    await futures.write.removeMargin([availableToWithdraw], { account: buyer.account.address });

    const newBalance = await futures.read.balanceOf([buyer.account.address]);
    expect(newBalance).to.equal(buyerMargin);
  });

  it("orders with positive effective margin should be considered for effective margin", async function () {
    const { contracts, accounts, deliveryDate } = await loadFixture(positionWithMarginFixture);
    const { futures } = contracts;
    const { buyer } = accounts;

    const marketPricePerDay = await futures.read.getMarketPrice();
    // making sure buyer has excessive margin
    await futures.write.addMargin([marketPricePerDay * 10n], { account: buyer.account });

    const effectiveMargin = await futures.read.getMinMargin([buyer.account.address]);
    await futures.write.createOrder([marketPricePerDay, deliveryDate, "", -1], {
      account: buyer.account,
    });
    const effectiveMargin2 = await futures.read.getMinMargin([buyer.account.address]);
    expect(effectiveMargin2 > effectiveMargin).to.be.true;
  });

  it("orders with negative effective margin should not be considered for effective margin", async function () {
    const { contracts, accounts, deliveryDate } = await loadFixture(positionWithMarginFixture);
    const { futures } = contracts;
    const { buyer } = accounts;
    const marketPricePerDay = await futures.read.getMarketPrice();
    const effectiveMargin = await futures.read.getMinMargin([buyer.account.address]);
    await futures.write.createOrder([marketPricePerDay * 100n, deliveryDate, "", -1], {
      account: buyer.account,
    });
    const effectiveMargin2 = await futures.read.getMinMargin([buyer.account.address]);
    expect(effectiveMargin2 === effectiveMargin).to.be.true;
  });

  it("party cant withdraw more than deposited collateral even if effective margin is negative", async function () {
    const { contracts, accounts, deliveryDate } = await loadFixture(positionWithMarginFixture);
    const { futures } = contracts;
    const { buyer, seller } = accounts;
    const marketPricePerDay = await futures.read.getMarketPrice();

    // create very profitable sell order
    await futures.write.createOrder([marketPricePerDay * 100n, deliveryDate, "", -1], {
      account: seller.account,
    });

    // match very profitable order
    await futures.write.addMargin([marketPricePerDay * 1000n], { account: buyer.account });
    await futures.write.createOrder([marketPricePerDay * 100n, deliveryDate, "", 1], {
      account: buyer.account,
    });

    // check effective margin is negative (pnl is larger than maintenance margin)
    const effectiveMargin = await futures.read.getMinMargin([seller.account.address]);
    expect(effectiveMargin < 0n).to.be.true;

    const balance = await futures.read.balanceOf([seller.account.address]);
    await catchError(futures.abi, "ERC20InsufficientBalance", async () => {
      await futures.write.removeMargin([balance + 1n], { account: seller.account });
    });

    // party can withdraw full deposited collateral balance
    await futures.write.removeMargin([balance], { account: seller.account });
  });
});
