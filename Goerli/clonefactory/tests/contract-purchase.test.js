//@ts-check
const { expect } = require("chai");
const ethers = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist");
const { LocalTestnetAddresses, RandomEthAddress } = require("./utils");

describe("Contract purchase", function () {
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
  const limit = String(0)
  const speed = String(1_000_000)
  const length = String(3600)
  const version = String(0)

  before(async () => {
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, "10000").send({ from: buyer })
    await lumerin.methods.transfer(buyer, "10000").send({ from: owner })

    await cf.methods.setAddToWhitelist(seller).send({ from: owner })
    fee = await cf.methods.marketplaceFee().call()
  })

  it("should test legacy setCreateNewRentalContract", async function () {
    const receipt = await cf.methods.setCreateNewRentalContract(price, "0", speed, length, cloneFactoryAddress, "123").send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    const impl = Implementation(web3, hrContractAddr)
    const terms = await impl.methods.getPublicVariables().call()
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

    expect(terms).to.include({
      _price: price,
      _limit: limit,
      _speed: speed,
      _length: length,
      _encryptedPoolData: "",
      _hasFutureTerms: false,
      _isDeleted: false,
      _startingBlockTimestamp: "0",
      _state: "0",
      _buyer: ZERO_ADDRESS,
      _version: "0",
    })
    expect(terms._seller.toLowerCase()).to.equal(seller.toLowerCase())

    const { _profitTarget } = await impl.methods.terms().call()
    expect(_profitTarget).to.equal("0")

    const history = await impl.methods.getHistory("0", "10").call()
    expect(history.length).to.equal(0)

    const futureTerms = await impl.methods.futureTerms().call()
    expect(futureTerms).to.deep.include({
      _price: "0",
      _limit: "0",
      _speed: "0",
      _length: "0",
    })
  });

  it('should purchase contract', async () => {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "0", speed, String(length), version, cloneFactoryAddress, "123")
      .send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    const stateBefore = await Implementation(web3, hrContractAddr).methods.contractState().call()
    expect(stateBefore).to.equal("0")

    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", version).send({ from: buyer, value: fee })

    const stateAfter = await Implementation(web3, hrContractAddr).methods.contractState().call()
    expect(stateAfter).to.equal("1")
  })

  it('should emit "contractPurchased" on purchase', async () => {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "0", speed, String(length), version, cloneFactoryAddress, "123")
      .send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    const events = await cf.getPastEvents("contractPurchased", { fromBlock: receipt.blockNumber, toBlock: "latest" })
    const isEmitted = events.some((e) => e.returnValues._address === hrContractAddr);
    expect(isEmitted).to.be.false

    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", version).send({ from: buyer, value: fee })

    const events2 = await cf.getPastEvents("contractPurchased", { fromBlock: receipt.blockNumber, toBlock: "latest" })
    const isEmitted2 = events2.some((e) => e.returnValues._address === hrContractAddr);
    expect(isEmitted2).to.be.true
  })

  it('should fail purchase of contract which clonefactory doesnt know about', async () => {
    const hrContractAddr = RandomEthAddress()

    try {
      await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", version).send({ from: buyer, value: fee })
      expect.fail("purchase should fail")
    } catch (err) {
      expect(err.message).to.contain("unknown contract address")
    }
  })

  it('should fail purchase of deleted contract', async () => {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "0", speed, String(length), version, cloneFactoryAddress, "123")
      .send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods.setContractDeleted(hrContractAddr, true).send({ from: seller })

    try {
      await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", version).send({ from: buyer, value: fee })
    } catch (err) {
      expect(err.message).to.contain("cannot purchase deleted contract")
    }
  })

  it('should fail purchase if fee is not paid', async () => {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "0", speed, String(length), version, cloneFactoryAddress, "123")
      .send({ from: seller, value: fee })
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    try {
      await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc", version).send({ from: buyer })
    } catch (err) {
      expect(err.message).to.contain("Insufficient ETH provided for marketplace fee")
    }
  })
});
