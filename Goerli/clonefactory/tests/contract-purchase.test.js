//@ts-check
const { expect } = require("chai");
const ethers = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist");
const { LocalTestnetAddresses } = require("./utils");

describe("Contract purchase", function () {
  const {
    lumerinAddress,
    cloneFactoryAddress,
    owner,
    seller,
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

  before(async () => {
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
  })
});