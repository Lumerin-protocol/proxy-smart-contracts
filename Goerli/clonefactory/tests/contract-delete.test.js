//@ts-check
const { expect } = require("chai");
const ethers = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist")
const { LocalTestnetAddresses } = require("./utils")

describe("Contract delete", function () {
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

  before(async () => {
    const lumerin = Lumerin(web3, lumerinAddress)
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, "10000").send({ from: buyer })
    await lumerin.methods.transfer(buyer, "10000").send({ from: owner })
    await cf.methods.setAddToWhitelist(seller).send({ from: owner })
    fee = await cf.methods.marketplaceFee().call()
  })

  it("should create contract and check its status", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2("1", "0", "1", "3600", "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    hrContractAddr = receipt.events?.contractCreated.returnValues._address;
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getPublicVariables().call()

    expect(data._isDeleted).equal(false)
  })

  it('should prohibit deletion if caller is not a seller', async function () {
    try {
      await cf.methods.setContractDeleted(hrContractAddr, true).send({ from: buyer })
      expect.fail("should throw error")
    } catch (e) {
      expect(e.message).includes("you are not authorized")
    }
  })

  it("should delete contract and emit events", async function () {
    await cf.methods.setContractDeleted(hrContractAddr, true).send({ from: seller })
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getPublicVariables().call()

    expect(data._isDeleted).equal(true)

    const events = await cf.getPastEvents("contractDeleteUpdated", { fromBlock: 0, toBlock: "latest" })
    const isEventFound = events.find((e) =>
      e.returnValues._address === hrContractAddr &&
      e.returnValues._isDeleted === true
    )
    const events2 = await cf.getPastEvents("contractDeletedOrRestored", { fromBlock: 0, toBlock: "latest" })
    const isNewEventFound = events2.find((e) =>
      e.returnValues._address === hrContractAddr &&
      e.returnValues._isDeleted === true
    )

    expect(isEventFound).not.undefined
    expect(isNewEventFound).not.undefined
  })

  it("should error on second attempt to delete", async function () {
    try {
      await cf.methods.setContractDeleted(hrContractAddr, true).send({ from: seller })
      expect.fail("should throw error")
    } catch (e) {
      expect(e.message).includes("contract delete state is already set to this value")
    }
  })

  it("should block purchase if contract deleted", async function () {
    try {
      await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
      expect.fail("should throw error")
    } catch (e) {
      expect(e.message).includes("cannot purchase deleted contract")
    }
  })

  it("should undelete contract and emit events", async function () {
    await cf.methods.setContractDeleted(hrContractAddr, false).send({ from: seller })
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getPublicVariables().call()

    expect(data._isDeleted).equal(false)

    const events = await cf.getPastEvents("contractDeleteUpdated", { fromBlock: 0, toBlock: "latest" })
    const isEventFound = events.find((e) =>
      e.returnValues._address === hrContractAddr &&
      e.returnValues._isDeleted === false
    )

    const events2 = await cf.getPastEvents("contractDeletedOrRestored", { fromBlock: 0, toBlock: "latest" })
    const isNewEventFound = events2.find((e) =>
      e.returnValues._address === hrContractAddr &&
      e.returnValues._isDeleted === false
    )

    expect(isEventFound).not.undefined
    expect(isNewEventFound).not.undefined
  })

  it("should allow purchase if contract undeleted", async function () {
    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", "0").send({ from: buyer, value: fee })
  })

  it("should allow delete contract if contract is purchased", async function () {
    await cf.methods.setContractDeleted(hrContractAddr, true).send({ from: seller })
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getPublicVariables().call()

    expect(data._isDeleted).equal(true)
  })

  it("should prohibit deletion on the contract instance", async function () {
    const impl = Implementation(web3, hrContractAddr)
    try {
      await impl.methods.setContractDeleted(true).send({ from: seller })
      expect.fail("should throw error")
    } catch (e) {
      expect(e.message).includes("this address is not approved to call this function")
    }
  })

  it("should allow deletion from clonefactory owner", async function () {
    const impl = Implementation(web3, hrContractAddr)
    try {
      await impl.methods.setContractDeleted(true).send({ from: owner })
      expect.fail("should throw error")
    } catch (e) {
      expect(e.message).includes("this address is not approved to call this function")
    }
  })
})
