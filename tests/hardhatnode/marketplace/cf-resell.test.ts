import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "../fixtures-2";
import { getAddress, zeroAddress } from "viem";
import { viem } from "hardhat";
import { expect } from "chai";
import { getTxDeltaBalance, getTxDeltaTime, getTxTimestamp } from "../../lib";
import { getFullResellChain } from "../../../scripts/lib/resell";

describe("Resell", () => {
  it("should be able to resell a contract", async () => {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { cloneFactory, usdcMock } = contracts;
    const { buyer, seller, buyer2, pc } = accounts;
    const hrContract = await viem.getContractAt(
      "Implementation",
      config.cloneFactory.contractAddresses[0]
    );

    // check price
    console.log("first purchase buyer ", buyer.account.address);
    const [price, fee] = await hrContract.read.priceAndFee();

    const purchaseTx = await cloneFactory.write.setPurchaseRentalContractV2(
      [hrContract.address, zeroAddress, "", "", 0, true, false, 10n],
      { account: buyer.account.address }
    );

    // check state of the contract is available
    const state = await hrContract.read.contractState();
    expect(state).to.be.equal(0);

    const terms = await hrContract.read.terms().then((t) => {
      const [speed, length, version] = t;
      return { speed, length, version };
    });

    console.log("");
    console.log("terms", terms);
    console.log("price", price);
    console.log("fee", fee);
    console.log("timestamp", await getTxTimestamp(pc, purchaseTx));
    console.log("");

    // check that the seller updated to a buyer (buyer is going to resell the contract)
    expect(await hrContract.read.seller()).to.be.equal(getAddress(buyer.account.address));

    // check sell terms
    const resellTerms = await getResellTerms(hrContract.address, 1n);

    expect(resellTerms._resellProfitTarget).to.be.equal(10);
    expect(resellTerms._account).to.be.equal(getAddress(buyer.account.address));
    expect(resellTerms._price).to.be.equal(price);
    expect(resellTerms._fee).to.be.equal(fee);
    // expect(resellTerms._startTime).to.be.equal(1000000000000000000);
    // expect(resellTerms._encrDestURL).to.be.equal("");
    // expect(resellTerms._encrValidatorURL).to.be.equal("");

    // check new price and fee, it should be 10% from the mining price
    const [newPrice, newFee] = await hrContract.read.priceAndFee();
    const expectedPrice = (((price * 100000n) / 105n) * 110n) / 100000n;
    const expectedFee = (((fee * 100000n) / 105n) * 110n) / 100000n;
    expect(newPrice - expectedPrice < 10n).to.be.true;
    expect(newFee - expectedFee < 10n).to.be.true;

    console.log("\nsecond purchase buyer2 ", buyer2.account.address);

    const [newPrice2, newFee2] = await hrContract.read.priceAndFee();
    //
    //
    const buyResellTx = await cloneFactory.write.setPurchaseRentalContractV2(
      [hrContract.address, zeroAddress, "", "", 0, true, false, 15n],
      { account: buyer2.account.address }
    );
    console.log("");
    console.log("newPrice2", newPrice2);
    console.log("newFee2", newFee2);
    console.log("timestamp2", await getTxTimestamp(pc, buyResellTx));
    console.log("");
    // check that the contract is now owned by the buyer2
    expect(await hrContract.read.seller()).to.be.equal(getAddress(buyer2.account.address));

    // close the contract by the buyer2
    const tc = await viem.getTestClient();
    const purchaseDurationSeconds = 30 * 60;
    await tc.increaseTime({ seconds: purchaseDurationSeconds });

    //
    //
    console.log("\nclose early");
    //
    //
    const closeEarlyTx = await hrContract.write.closeEarly([0], {
      account: buyer2.account.address,
    });

    // check the contract seller now
    expect(await hrContract.read.seller()).to.be.equal(getAddress(buyer.account.address));

    const contractRuntime = await getTxDeltaTime(pc, buyResellTx, closeEarlyTx);
    const hashesForToken = await contracts.hashrateOracle.read.getHashesforToken();
    const basePrice = (terms.speed * contractRuntime) / hashesForToken;
    const expectedReward = basePrice + (basePrice * 10n) / 100n;
    const buyerReward = await getTxDeltaBalance(pc, closeEarlyTx, buyer.account.address, usdcMock);

    expect(buyerReward).to.be.equal(expectedReward);

    const expectedSellerReward = basePrice + (basePrice * 5n) / 100n;
    const sellerReward = await getTxDeltaBalance(
      pc,
      closeEarlyTx,
      seller.account.address,
      usdcMock
    );

    expect(sellerReward).to.be.equal(expectedSellerReward);

    await tc.increaseTime({ seconds: 10 });

    // close again
    console.log("close early again");

    const closeAgainTx = await hrContract.write.closeEarly([0], {
      account: buyer.account.address,
    });

    const contractRuntime2 = await getTxDeltaTime(pc, closeEarlyTx, closeAgainTx);
    const buyer2DeltaBalance = await getTxDeltaBalance(
      pc,
      closeAgainTx,
      buyer2.account.address,
      usdcMock
    );
    const buyerDeltaBalance = await getTxDeltaBalance(
      pc,
      closeAgainTx,
      buyer.account.address,
      usdcMock
    );
    const sellerDeltaBalance = await getTxDeltaBalance(
      pc,
      closeAgainTx,
      seller.account.address,
      usdcMock
    );

    const _expectedSellerDeltaBalance = (terms.speed * contractRuntime2) / hashesForToken;
    const expectedSellerDeltaBalance =
      _expectedSellerDeltaBalance + (_expectedSellerDeltaBalance * 5n) / 100n;

    expect(sellerDeltaBalance).to.be.equal(expectedSellerDeltaBalance);
    expect(buyer2DeltaBalance).to.be.equal(0n);
    expect(buyerDeltaBalance > 0n).to.be.true;
  });
});

it("should auto close and resolve payments to everyone", async () => {
  const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
  const { cloneFactory, usdcMock } = contracts;
  const { buyer, buyer2, seller } = accounts;
  const hrContract = await viem.getContractAt(
    "Implementation",
    config.cloneFactory.contractAddresses[0]
  );

  const [price] = await hrContract.read.priceAndFee();
  const priceWithProfit1 = price + (price * 10n) / 100n; // 110%
  const priceWithProfit2 = price + (price * 15n) / 100n; // 115%

  const sellerBalance = await usdcMock.read.balanceOf([seller.account.address]);
  const buyerBalance = await usdcMock.read.balanceOf([buyer.account.address]);
  const buyer2Balance = await usdcMock.read.balanceOf([buyer2.account.address]);

  await cloneFactory.write.setPurchaseRentalContractV2(
    [hrContract.address, zeroAddress, "", "", 0, true, false, priceWithProfit1],
    { account: buyer.account.address }
  );

  // check state of the contract is available
  const state = await hrContract.read.contractState();
  expect(state).to.be.equal(0);

  await cloneFactory.write.setPurchaseRentalContractV2(
    [hrContract.address, zeroAddress, "", "", 0, true, false, priceWithProfit2],
    { account: buyer2.account.address }
  );

  const tc = await viem.getTestClient();
  const contractLength = 3600;
  await tc.increaseTime({ seconds: contractLength + 1 });

  await hrContract.write.claimFunds({
    account: buyer2.account.address,
  });

  const sellerBalanceAfter = await usdcMock.read.balanceOf([seller.account.address]);
  const buyerBalanceAfter = await usdcMock.read.balanceOf([buyer.account.address]);
  const buyer2BalanceAfter = await usdcMock.read.balanceOf([buyer2.account.address]);

  expect(sellerBalanceAfter).to.be.equal(sellerBalance + price - 1n);
  expect(buyerBalanceAfter).to.be.equal(buyerBalance - price + priceWithProfit1);
  expect(buyer2BalanceAfter).to.be.equal(buyer2Balance - priceWithProfit1);
});

it("should track resell chain", async () => {
  const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
  const { cloneFactory, usdcMock, lumerinToken } = contracts;
  const { buyer, seller, buyer2, pc } = accounts;
  const hrContract = await viem.getContractAt(
    "Implementation",
    config.cloneFactory.contractAddresses[2]
  );

  // Get initial price and fee
  const [sellPrice, initialFee] = await hrContract.read.priceAndFee();
  const initialTimestamp = BigInt(0); // We'll use 0 as baseline since we're testing relative timestamps

  // === FIRST PURCHASE (Initial Purchase) ===
  console.log("=== FIRST PURCHASE ===");
  const firstResellPrice = sellPrice + 1n;
  await cloneFactory.write.setPurchaseRentalContractV2(
    [hrContract.address, zeroAddress, "", "", 0, true, false, firstResellPrice],
    { account: buyer.account.address }
  );

  // Check that resell chain has grown
  let resellChain = await getFullResellChain(hrContract.address);

  expect(resellChain.length).to.be.greaterThan(0);

  // Verify the latest resell chain entry (our new purchase)
  const latestEntry = resellChain[resellChain.length - 1];
  expect(latestEntry._account).to.be.equal(getAddress(buyer.account.address));
  expect(latestEntry._seller).to.be.equal(getAddress(buyer.account.address));
  expect(latestEntry._validator).to.be.equal(zeroAddress);
  expect(latestEntry._price).to.be.equal(sellPrice);
  expect(latestEntry._fee).to.be.equal(initialFee);
  expect(latestEntry._isResellable).to.be.equal(true);
  expect(latestEntry._resellPrice).to.be.equal(firstResellPrice);
  expect(latestEntry._resellProfitTarget).to.be.equal(0); // This is 0, not 10
  expect(latestEntry._isResellToDefaultBuyer).to.be.false; // This is true, not false
  expect(Number(latestEntry._startTime)).to.be.greaterThan(Number(initialTimestamp));
  expect(latestEntry._lastSettlementTime).to.be.equal(latestEntry._startTime);

  // Check that seller is now the buyer
  expect(await hrContract.read.seller()).to.be.equal(getAddress(buyer.account.address));

  // === SECOND PURCHASE (First Resell) ===
  console.log("=== SECOND PURCHASE (First Resell) ===");
  const [priceAfterFirst, feeAfterFirst] = await hrContract.read.priceAndFee();
  expect(priceAfterFirst).to.be.equal(firstResellPrice);

  const secondResellPrice = priceAfterFirst + 1n;

  await cloneFactory.write.setPurchaseRentalContractV2(
    [hrContract.address, zeroAddress, "", "", 0, true, false, secondResellPrice],
    { account: buyer2.account.address }
  );

  // Check that resell chain has grown by 1 entry
  resellChain = await getFullResellChain(hrContract.address);
  expect(resellChain.length).to.be.eq(3);

  // Verify the new resell chain entry (our second purchase)
  const newEntryIndex = resellChain.length - 1;
  const newEntry = resellChain[newEntryIndex];

  expect(newEntry._account).to.be.equal(getAddress(buyer2.account.address));
  expect(newEntry._seller).to.be.equal(getAddress(buyer2.account.address));
  expect(newEntry._validator).to.be.equal(zeroAddress);
  expect(newEntry._price).to.be.equal(priceAfterFirst);
  expect(newEntry._fee).to.be.equal(feeAfterFirst);
  expect(newEntry._isResellable).to.be.equal(true);
  expect(newEntry._resellPrice).to.be.equal(secondResellPrice);
  expect(newEntry._resellProfitTarget).to.be.equal(0); // This is 0, not 15
  expect(newEntry._isResellToDefaultBuyer).to.be.false; // This is true, not false
  expect(Number(newEntry._startTime)).to.be.greaterThan(Number(latestEntry._startTime));
  expect(newEntry._lastSettlementTime).to.be.equal(newEntry._startTime);

  // Check that seller is now buyer2
  expect(await hrContract.read.seller()).to.be.equal(getAddress(buyer2.account.address));
});

function getHrContract(addr: `0x${string}`) {
  return viem.getContractAt("Implementation", addr);
}

async function getResellTerms(addr: `0x${string}`, index: bigint) {
  const contract = await getHrContract(addr);
  const terms = await contract.read.resellChain([index]);
  const [
    _account,
    // purchase terms
    _validator,
    _price,
    _fee,
    _startTime,
    _encrDestURL,
    _encrValidatorURL,
    _lastSettlementTime, // timestamp when the contract was settled last time
    // resell terms
    _isResellable,
    _resellProfitTarget,
  ] = terms;
  return {
    _account,
    // purchase terms
    _validator,
    _price,
    _fee,
    _startTime,
    _encrDestURL,
    _encrValidatorURL,
    _lastSettlementTime, // timestamp when the contract was settled last time
    // resell terms
    _isResellable,
    _resellProfitTarget,
  };
}
