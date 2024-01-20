//@ts-check
const { expect } = require("chai");
const ethers = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist");
const { AdvanceBlockTime, LocalTestnetAddresses } = require("./utils");

describe("Contract history", function () {
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
  let hrContractAddr = ""
  let fee = ""

  const price = String(1_000)
  const speed = String(1_000_000)
  const length = String(3600)

  before(async () => {
    const lumerin = Lumerin(web3, lumerinAddress)
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, "10000").send({ from: buyer })
    await lumerin.methods.transfer(buyer, "10000").send({ from: owner })
    await cf.methods.setAddToWhitelist(seller).send({ from: owner })
    fee = await cf.methods.marketplaceFee().call()
  })

  it("should create contract and check its history", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "0", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    hrContractAddr = receipt.events?.contractCreated.returnValues._address;
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("0", "100").call()

    expect(data.length).equal(0)
  })

  it("should add history entry on bad closeout", async function () {
    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    await cf.methods.setContractCloseout(hrContractAddr, "0").send({ from: buyer })

    const impl = Implementation(web3, hrContractAddr)
    await cf.methods.setContractCloseout(hrContractAddr, "0").send({ from: buyer })
    const data = await impl.methods.getHistory("0", "100").call()

    expect(data.length).equal(1)
    expect(data[0]?._goodCloseout).equal(false)
  })

  it("should add history entry on good closeout", async function () {
    const receipt = await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    const { timestamp: purchaseTime } = await web3.eth.getBlock(receipt.blockNumber);

    await AdvanceBlockTime(web3, 3600)
    const impl = Implementation(web3, hrContractAddr)
    await cf.methods.setContractCloseout(hrContractAddr, "2").send({ from: seller, value: fee })

    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("0", "100").call()
    const entry = data.find(entry => entry._purchaseTime == purchaseTime)

    expect(entry).not.undefined
    expect(entry?._goodCloseout).equal(true)
  })

  it("should verify other fields", async function () {
    const receipt = await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
    const { timestamp: purchaseTime } = await web3.eth.getBlock(receipt.blockNumber);

    const impl = Implementation(web3, hrContractAddr)
    const receipt2 = await cf.methods.setContractCloseout(hrContractAddr, "0").send({ from: buyer })
    const { timestamp: endTime } = await web3.eth.getBlock(receipt2.blockNumber);
    const data = await impl.methods.getHistory("0", "100").call()

    const entry = data.find(entry => entry._purchaseTime == purchaseTime)

    expect(entry).not.undefined
    expect(entry?._purchaseTime).equal(String(purchaseTime))
    expect(entry?._endTime).equal(String(endTime))
    expect(entry?._price).equal(price)
    expect(entry?._speed).equal(speed)
    expect(entry?._length).equal(length)
    expect(entry?._buyer).equal(buyer)
  })

  it("should paginate history: limit less than total number of elements", async function () {
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("0", "1").call()

    expect(data.length).equal(1)
  })

  it("should paginate history: limit more than total number of elements", async function () {
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("0", "100").call()

    expect(data.length).equal(3)
  })

  it("should paginate history: offset less than total number of elements", async function () {
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("1", "1").call()

    expect(data.length).equal(1)
  })

  it("should paginate history: offset more than total number of elements", async function () {
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("100", "1").call()

    expect(data.length).equal(0)
  })

  it("should paginate history: verify entries", async function () {
    const impl = Implementation(web3, hrContractAddr)

    const [entry1] = await impl.methods.getHistory("0", "1").call()
    const [entry2] = await impl.methods.getHistory("1", "1").call()
    const entries = await impl.methods.getHistory("0", "2").call()

    expect(entries.length).equal(2)
    expect(entry1).deep.equal(entries[0])
    expect(entry2).deep.equal(entries[1])
    expect(entry1._purchaseTime).not.equal(entry2._purchaseTime)
  })

  it("should return correct stats", async function () {
    const impl = Implementation(web3, hrContractAddr)
    const stats = await impl.methods.getStats().call()

    expect(stats._successCount).equal("1")
    expect(stats._failCount).equal("2")
  })
})
