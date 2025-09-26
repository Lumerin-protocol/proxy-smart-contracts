import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "../fixtures-2";
import { zeroAddress } from "viem";
import { expect } from "chai";
import { getTxDeltaBalance } from "../../lib";

it("should purchase and resell to default buyer for the whole duration", async () => {
  const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
  const { cloneFactory, usdcMock, hashrate } = contracts;
  const { buyer, pc, tc } = accounts;
  const [hrContract] = hashrate;

  const [, durationSeconds] = await hrContract.read.terms();
  const [price] = await hrContract.read.priceAndFee();

  const purchaseTx = await cloneFactory.write.setPurchaseRentalContractV2(
    [hrContract.address, zeroAddress, "", "", 0, true, true, 10],
    { account: buyer.account.address }
  );
  const deltaBalance = await getTxDeltaBalance(pc, purchaseTx, buyer.account.address, usdcMock);
  expect(deltaBalance).to.be.equal(-price, "buyer should be charged the price");

  await tc.increaseTime({ seconds: Number(durationSeconds) });

  const defaultBuyerBuyPrice = await hrContract.read.priceV2([
    config.cloneFactory.defaultBuyerProfitTarget,
  ]);
  const claimFundsTx = await hrContract.write.claimFunds();
  const deltaBalance2 = await getTxDeltaBalance(pc, claimFundsTx, buyer.account.address, usdcMock);
  expect(deltaBalance2).to.be.equal(
    defaultBuyerBuyPrice,
    "buyer should be paid the default buyer buy price"
  );
});

it("should purchase and resell to default buyer for the half of the duration", async () => {
  const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
  const { cloneFactory, usdcMock, hashrate } = contracts;
  const { buyer, buyer2, seller, pc, tc, defaultBuyer } = accounts;

  const [hrContract] = hashrate;

  const [, durationSeconds] = await hrContract.read.terms();
  const [price] = await hrContract.read.priceAndFee();
  const defaultBuyerDuration = Number(durationSeconds) / 2;
  const defaultBuyerBuyPrice = await hrContract.read.priceV2([
    config.cloneFactory.defaultBuyerProfitTarget,
  ]);

  console.log("base price", await hrContract.read.priceV2([0]));
  console.log("actual price", price);
  console.log("default buyer buy price (-5%)", defaultBuyerBuyPrice);
  console.log("(+10%)", await hrContract.read.priceV2([10]));
  console.log("(+15%)", await hrContract.read.priceV2([15]));

  const resellProfitTarget = 15;
  const resellPrice = await hrContract.read.priceV2([resellProfitTarget]);

  console.log("firstPurchase");
  await cloneFactory.write.setPurchaseRentalContractV2(
    [hrContract.address, zeroAddress, "", "", 0, true, true, resellProfitTarget],
    { account: buyer.account }
  );

  await tc.increaseTime({ seconds: defaultBuyerDuration });

  console.log("\n\nsecondPurchase");
  const purchase2Tx = await cloneFactory.write.setPurchaseRentalContractV2(
    [hrContract.address, zeroAddress, "", "", 0, true, false, 20],
    { account: buyer2.account }
  );

  const deltaSellerBalance = await getTxDeltaBalance(pc, purchase2Tx, seller, usdcMock);
  expect(deltaSellerBalance).to.be.equal(
    price / 2n,
    "seller should be paid the price for the half-run"
  );

  const deltaBuyerBalance = await getTxDeltaBalance(pc, purchase2Tx, buyer, usdcMock);
  expect(deltaBuyerBalance).to.be.equal(
    defaultBuyerBuyPrice / 2n,
    "buyer should be paid from the default buyer for the half-run"
  );

  const deltaDefaultBuyerBalance = await getTxDeltaBalance(pc, purchase2Tx, defaultBuyer, usdcMock);
  expect(deltaDefaultBuyerBalance).to.be.equal(
    defaultBuyerBuyPrice - defaultBuyerBuyPrice / 2n,
    "default buyer should be refunded the price for the half-run"
  );

  await tc.increaseTime({ seconds: defaultBuyerDuration });

  const settleTx = await hrContract.write.claimFunds();
  const deltaBuyerBalance2 = await getTxDeltaBalance(pc, settleTx, buyer, usdcMock);
  expect(deltaBuyerBalance2).to.be.equal(
    resellPrice / 2n - 1n,
    "reseller should be paid according to its profit target"
  );

  const deltaSellerBalance2 = await getTxDeltaBalance(pc, settleTx, seller, usdcMock);
  expect(deltaSellerBalance2).to.be.equal(
    price / 2n,
    "seller should be paid the price for the last half-run"
  );
});
