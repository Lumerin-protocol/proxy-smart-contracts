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


  it("should verify closeout type 2 for 100% completion", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "0", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    const sellerBalance = Number(await lumerin.methods.balanceOf(seller).call());

    await AdvanceBlockTime(web3, Number(length))

    // close by seller after expiration without claim (2)
    await cf.methods.setContractCloseout(hrContractAddr, "2").send({ from: seller, value: fee })

    const sellerBalanceAfter = Number(await lumerin.methods.balanceOf(seller).call());
    const deltaSellerBalance = sellerBalanceAfter - sellerBalance;

    expect(deltaSellerBalance).equal(Number(0))

    // claim to verify funds are released
    await cf.methods.setContractCloseout(hrContractAddr, "1").send({ from: seller, value: fee })
    const sellerBalanceAfterClaim = Number(await lumerin.methods.balanceOf(seller).call());
    const deltaSellerBalanceClaim = sellerBalanceAfterClaim - sellerBalance;
    expect(deltaSellerBalanceClaim).equal(Number(price), "seller should collect 100% of the price")
  })

  it("should disallow closeout type 2 for incompleted contract", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "3", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    await AdvanceBlockTime(web3, Number(length) / 2)

    try {
      await cf.methods.setContractCloseout(hrContractAddr, "2").send({ from: seller, value: fee })
      expect.fail("should not allow closeout type 2 for incompleted contract")
    } catch (err) {
      expect(err.message).includes("the contract has yet to be carried to term")
    }
  })

  it("should allow closeout type 2 for buyer", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "3", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    await AdvanceBlockTime(web3, Number(length))

    const impl = Implementation(web3, hrContractAddr)
    await cf.methods.setContractCloseout(hrContractAddr, "2").send({ from: buyer, value: fee })
  })

  it("should disallow closeout type 2 twice", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "3", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    await AdvanceBlockTime(web3, Number(length))

    const impl = Implementation(web3, hrContractAddr)
    await cf.methods.setContractCloseout(hrContractAddr, "2").send({ from: buyer, value: fee })
    try {
      await cf.methods.setContractCloseout(hrContractAddr, "2").send({ from: buyer, value: fee })
      expect.fail("should not allow closeout type 2 twice")
    } catch (err) {
      expect(err.message).includes("the contract is not in the running state")
    }
  })

  it("should not reqiure fee for closeout type 2", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "3", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    await AdvanceBlockTime(web3, Number(length))

    await cf.methods.setContractCloseout(hrContractAddr, "2").send({ from: seller, value: 0 })
  })

  it("should emit contractClosed for type 2", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "0", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    const receipt2 = await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    await AdvanceBlockTime(web3, Number(length))

    await cf.methods.setContractCloseout(hrContractAddr, "2").send({ from: seller })

    const events = await cf.getPastEvents("contractClosed", { fromBlock: receipt2.blockNumber, toBlock: "latest" })

    expect(events.length).equal(1)
    expect(events[0].returnValues._address).equal(hrContractAddr)
    expect(events[0].returnValues._closeOutType).equal("2")
  })
})