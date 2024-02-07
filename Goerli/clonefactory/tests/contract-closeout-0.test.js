//@ts-check
const { expect } = require("chai");
const ethers = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist");
const { AdvanceBlockTime, LocalTestnetAddresses } = require("./utils");

describe("Contract closeout", function () {
  const {
    lumerinAddress,
    cloneFactoryAddress,
    owner,
    seller,
    buyer,
  } = LocalTestnetAddresses;

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(ethers.config.networks.localhost.url)
  const cf = CloneFactory(web3, cloneFactoryAddress)
  const lumerin = Lumerin(web3, lumerinAddress)
  let fee = ""

  const price = String(1_000)
  const speed = String(1_000_000)
  const length = String(3600)

  before(async () => {
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, "10000").send({ from: buyer })
    await lumerin.methods.transfer(buyer, "10000").send({ from: owner })
    await cf.methods.setAddToWhitelist(seller).send({ from: owner })
    fee = await cf.methods.marketplaceFee().call()
  })

  it("should verify balances after 0% early closeout", async function () {
    await testEarlyCloseout(0, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should verify balances after 1% early closeout", async function () {
    await testEarlyCloseout(0.01, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should verify balances after 10% early closeout", async function () {
    await testEarlyCloseout(0.1, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should verify balances after 50% early closeout", async function () {
    await testEarlyCloseout(0.5, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should verify balances after 75% early closeout", async function () {
    await testEarlyCloseout(0.75, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should verify balances after 100% early closeout", async function () {
    await testEarlyCloseout(1, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should disallow closeout type 0 twice", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "0", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    await AdvanceBlockTime(web3, Number(length))

    const impl = Implementation(web3, hrContractAddr)
    await impl.methods.setContractCloseOut("0").send({ from: buyer, value: fee })
    try {
      await impl.methods.setContractCloseOut("0").send({ from: buyer, value: fee })
      expect.fail("should not allow closeout type 0 twice")
    } catch (err) {
      // after first closeout the buyer field is set to zero address
      // so the error message is different
      expect(err.message).includes("this account is not authorized to trigger an early closeout")
    }
  })

  it("should not reqiure fee for closeout type 0", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "0", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    await AdvanceBlockTime(web3, Number(length))

    const impl = Implementation(web3, hrContractAddr)
    await impl.methods.setContractCloseOut("0").send({ from: buyer, value: 0 })
  })
})

/**
 * 
 * @param {number} progress // 0.0 - 1.0 early closeout contract progress
 * @param {string} fee 
 * @param {string} seller 
 * @param {string} buyer 
 * @param {string} cloneFactoryAddress
 * @param {string} lumerinAddress
 * @param {import("web3").default} web3 
 */
async function testEarlyCloseout(progress, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3) {
  const cf = CloneFactory(web3, cloneFactoryAddress)
  const lumerin = Lumerin(web3, lumerinAddress);
  const speed = String(1_000_000)
  const length = String(3600)
  const price = String(1_000)
  const version = String(0)

  const receipt = await cf.methods.setCreateNewRentalContractV2(price, "0", speed, String(length), "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
  const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

  await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", version).send({ from: buyer, value: fee })

  const sellerBalance = Number(await lumerin.methods.balanceOf(seller).call());
  const buyerBalance = Number(await lumerin.methods.balanceOf(buyer).call());

  await AdvanceBlockTime(web3, progress * Number(length))

  // closeout by buyer
  const impl = Implementation(web3, hrContractAddr)
  await impl.methods.setContractCloseOut("0").send({ from: buyer, value: fee })
  const buyerBalanceAfter = Number(await lumerin.methods.balanceOf(buyer).call());
  const deltaBuyerBalance = buyerBalanceAfter - buyerBalance;
  const buyerRefundFraction = (1 - progress)
  const buyerRefundAmount = buyerRefundFraction * Number(price)
  expect(deltaBuyerBalance).equal(buyerRefundAmount, "buyer should be " + buyerRefundFraction * 100 + "% refunded")

  // claim by seller
  await impl.methods.setContractCloseOut("1").send({ from: seller, value: fee })
  const sellerBalanceAfter = Number(await lumerin.methods.balanceOf(seller).call());
  const deltaSellerBalance = sellerBalanceAfter - sellerBalance;
  const sellerClaimFraction = progress
  const sellerClaimAmount = sellerClaimFraction * Number(price);
  expect(deltaSellerBalance).equal(sellerClaimAmount, "seller should collect " + sellerClaimFraction * 100 + " of the price")
}
