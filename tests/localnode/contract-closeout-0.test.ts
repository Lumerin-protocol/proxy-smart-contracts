import { expect } from "chai";
import ethers from "hardhat";
import Web3 from "web3";
import { Lumerin, CloneFactory, Implementation } from "../../build-js/dist";
import { AdvanceBlockTime, LocalTestnetAddresses, expectIsError } from "../utils";

describe("Contract closeout", function () {
  const { lumerinAddress, cloneFactoryAddress, owner, seller, buyer } = LocalTestnetAddresses;

  const web3 = new Web3(ethers.config.networks.localhost.url);
  const cf = CloneFactory(web3, cloneFactoryAddress);
  const lumerin = Lumerin(web3, lumerinAddress);
  let fee = "";

  const price = String(1_000);
  const speed = String(1_000_000);
  const length = String(3600);

  before(async () => {
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, "10000").send({ from: buyer });
    await lumerin.methods.transfer(buyer, "10000").send({ from: owner });
    await cf.methods.setAddToWhitelist(seller).send({ from: owner });
    fee = await cf.methods.marketplaceFee().call();
  });

  it("should verify balances after 0% early closeout", async function () {
    await testEarlyCloseout(0, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3);
  });

  it("should verify balances after 1% early closeout", async function () {
    await testEarlyCloseout(0.01, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3);
  });

  it("should verify balances after 10% early closeout", async function () {
    await testEarlyCloseout(0.1, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3);
  });

  it("should verify balances after 50% early closeout", async function () {
    await testEarlyCloseout(0.5, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3);
  });

  it("should verify balances after 75% early closeout", async function () {
    await testEarlyCloseout(0.75, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3);
  });

  it("should fail early closeout when progress of the contract is 100%", async function () {
    try {
      await testEarlyCloseout(1, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3);
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("the contract is not in the running state");
    }
  });

  it("should disallow closeout type 0 twice", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "0", speed, length, "0", cloneFactoryAddress, "123")
      .send({ from: seller, value: fee });
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContract(hrContractAddr, "abc", "0")
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, 1);

    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.setContractCloseOut("0").send({ from: buyer, value: fee });
    try {
      await impl.methods.setContractCloseOut("0").send({ from: buyer, value: fee });
      expect.fail("should not allow closeout type 0 twice");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("the contract is not in the running state");
    }
  });

  it("should not reqiure fee for closeout type 0", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "0", speed, length, "0", cloneFactoryAddress, "123")
      .send({ from: seller, value: fee });
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContract(hrContractAddr, "abc", "0")
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, 1);

    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.setContractCloseOut("0").send({ from: buyer, value: 0 });
  });
});

/** @param progress 0.0 - 1.0 early closeout contract progress */
async function testEarlyCloseout(
  progress: number,
  fee: string,
  seller: string,
  buyer: string,
  cloneFactoryAddress: string,
  lumerinAddress: string,
  web3: Web3
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
      "123"
    )
    .send({ from: seller, value: fee });
  const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

  await cf.methods
    .setPurchaseRentalContract(hrContractAddr, "abc", version)
    .send({ from: buyer, value: fee });

  const sellerBalance = Number(await lumerin.methods.balanceOf(seller).call());
  const buyerBalance = Number(await lumerin.methods.balanceOf(buyer).call());
  const cBalance = Number(await lumerin.methods.balanceOf(hrContractAddr).call());
  console.log(sellerBalance, buyerBalance, cBalance);

  await AdvanceBlockTime(web3, progress * Number(length));

  // closeout by buyer
  const impl = Implementation(web3, hrContractAddr);
  await impl.methods.setContractCloseOut("0").send({ from: buyer, value: fee });
  const buyerBalanceAfter = Number(await lumerin.methods.balanceOf(buyer).call());
  const deltaBuyerBalance = buyerBalanceAfter - buyerBalance;
  const buyerRefundFraction = 1 - progress;
  const buyerRefundAmount = buyerRefundFraction * Number(price);
  expect(deltaBuyerBalance).equal(
    buyerRefundAmount,
    `buyer should be ${buyerRefundFraction * 100}% refunded`
  );

  // claim by seller
  await impl.methods.setContractCloseOut("1").send({ from: seller, value: fee });
  const sellerBalanceAfter = Number(await lumerin.methods.balanceOf(seller).call());
  const deltaSellerBalance = sellerBalanceAfter - sellerBalance;
  const sellerClaimFraction = progress;
  const sellerClaimAmount = sellerClaimFraction * Number(price);
  expect(deltaSellerBalance).equal(
    sellerClaimAmount,
    `seller should collect ${sellerClaimFraction * 100} of the price`
  );
}
