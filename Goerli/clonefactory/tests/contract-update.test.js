//@ts-check
const { expect } = require("chai");
const ethers = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist");
const { ToString, LocalTestnetAddresses } = require("./utils");

describe("Contract terms update", function () {
  const {
    lumerinAddress,
    cloneFactoryAddress,
    owner,
    seller,
    buyer,
  } = LocalTestnetAddresses;

  const price = ToString(1 * 10 ** 8);
  const newPrice = ToString(2 * 10 ** 8);

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(ethers.config.networks.localhost.url)
  const cf = CloneFactory(web3, cloneFactoryAddress)
  let hrContractAddr = ""
  let fee = ""

  before(async () => {
    const lumerin = Lumerin(web3, lumerinAddress)
    await lumerin.methods.transfer(buyer, ToString(10 * 10 ** 8)).send({ from: owner })
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, ToString(10 * 10 ** 8)).send({ from: buyer })
    await lumerin.methods.transfer(seller, ToString(10 * 10 ** 8)).send({ from: owner })
    await cf.methods.setAddToWhitelist(seller).send({ from: owner })
    fee = await cf.methods.marketplaceFee().call()
  })

  it("should create contract and check its status", async function () {
    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "0", "1", "3600", "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    hrContractAddr = receipt.events?.contractCreated.returnValues._address;
    const impl = Implementation(web3, hrContractAddr)
    const newData = await impl.methods.futureTerms().call()
    const data = await impl.methods.terms().call()

    expect(newData._length).equal('0')
    expect(newData._price).equal('0')
    expect(newData._limit).equal('0')
    expect(newData._speed).equal('0')
    expect(newData._version).equal('0')
    expect(data._price).equal(price);
    expect(data._version).equal('0');
  })

  it('should prohibit updating if caller is not a seller', async function () {
    try {
      await cf.methods.setUpdateContractInformation(hrContractAddr, newPrice, '1', '1', '1', '0').send({ from: buyer })
      expect.fail("should throw error")
    } catch (e) {
      expect(e.message).includes("you are not authorized")
    }
  })

  it("should update contract and emit event without futureTerms update", async function () {
    const receipt = await cf.methods.setUpdateContractInformation(hrContractAddr, newPrice, '2', '3', '4', '0').send({ from: seller })

    const impl = Implementation(web3, hrContractAddr)
    const futureTerms = await impl.methods.futureTerms().call()
    const data = await impl.methods.getPublicVariablesV2().call()

    expect(futureTerms._price).equal('0');
    expect(futureTerms._version).equal('0');
    expect(data._terms._price).equal(newPrice);
    expect(data._terms._limit).equal('2');
    expect(data._terms._speed).equal('3');
    expect(data._terms._length).equal('4');
    expect(data._terms._version).equal('1');

    const events = await impl.getPastEvents('purchaseInfoUpdated', { fromBlock: receipt.blockNumber, toBlock: "latest" })
    const isEventFound = events.find((e) =>
      e.returnValues._address === hrContractAddr
    )

    expect(isEventFound).not.undefined
  })


  it("should store futureTerms for contract and should not emit update event if contract is running", async function () {
    const price = ToString(2 * 10 ** 8);
    const newPrice = ToString(3 * 10 ** 8);
    await cf.methods.setPurchaseRentalContract(hrContractAddr, '', "1").send({ from: buyer, value: fee });
    const receipt = await cf.methods.setUpdateContractInformation(hrContractAddr, newPrice, '22', '33', '44', '0').send({ from: seller })
    const impl = Implementation(web3, hrContractAddr)
    const futureTerms = await impl.methods.futureTerms().call()
    const data = await impl.methods.getPublicVariablesV2().call()

    expect(futureTerms._price).equal(newPrice);
    expect(futureTerms._limit).equal('22');
    expect(futureTerms._speed).equal('33');
    expect(futureTerms._length).equal('44');
    expect(futureTerms._version).equal('2');

    expect(data._terms._price).equal(price);
    expect(data._terms._limit).equal('2');
    expect(data._terms._speed).equal('3');
    expect(data._terms._length).equal('4');
    expect(data._terms._version).equal('1');


    const events = await impl.getPastEvents('purchaseInfoUpdated', { fromBlock: receipt.blockNumber, toBlock: "latest" })
    const isEventFound = !!events.find((e) =>
      e.returnValues._address === hrContractAddr
    )

    expect(isEventFound).to.be.false;
  })

  it("should apply futureTerms after contract closed and emit event", async function () {
    const newPrice = ToString(3 * 10 ** 8);
    const impl = Implementation(web3, hrContractAddr)
    const receipt = await impl.methods.setContractCloseOut("0").send({ from: buyer })

    const futureTerms = await impl.methods.futureTerms().call()

    expect(futureTerms._price).equal('0');
    expect(futureTerms._length).equal('0');
    expect(futureTerms._limit).equal('0');
    expect(futureTerms._speed).equal('0');
    expect(futureTerms._version).equal('0');

    const data = await impl.methods.getPublicVariablesV2().call()
    expect(data._terms._price).equal(newPrice);
    expect(data._terms._limit).equal('22');
    expect(data._terms._speed).equal('33');
    expect(data._terms._length).equal('44');
    expect(data._terms._version).equal('2');

    const events = await impl.getPastEvents('purchaseInfoUpdated', { fromBlock: receipt.blockNumber, toBlock: "latest" })
    const isEventFound = events.find((e) =>
      e.returnValues._address === hrContractAddr
    )

    expect(isEventFound).not.undefined
  });

  it("should restrict purchasing of previous version of contract", async function () {
    try {
      await cf.methods.setPurchaseRentalContract(hrContractAddr, '', "1").send({ from: buyer, value: fee });
      expect.fail("should not allow purchase previous contract version")
    } catch (err) {
      expect(err.message).includes("cannot purchase, contract terms were updated")
    }
  })
})
