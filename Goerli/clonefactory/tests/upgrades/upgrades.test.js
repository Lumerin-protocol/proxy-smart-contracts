//@ts-check
const { expect } = require("chai");
/**
 * @type {typeof import("web3").default}
 */
// @ts-ignore
const Web3 = require("web3");
const { hoursToSeconds, LMRToLMRWithDecimals } = require("../../lib/utils.js");
const path = require("node:path");
const { Wallet } = require("ethers");
const fs = require("node:fs");
const { LocalTestnetAddresses, AdvanceBlockTime, shellLog, shellBackground, shell } = require("../utils.js");
const { UpdateCloneFactory, UpdateImplementation } = require('../../lib/deploy.js');
const { CloneFactory, Implementation } = require("../../build-js/dist/index.js");

describe("Contract updates test", () => {
  const branchToTestAgainst = process.env.BRANCH_TO_TEST_AGAINST || "dev";
  const testTempDir = "./test-temp";
  const web3 = new Web3("http://localhost:8545");

  let markerplaceFee = "";
  let cloneFactoryAddr = ""
  let lumerinAddr = ""
  /** @type {Map<string, ImplStateSnap>} */
  let oldContracts
  /** @type {Map<string, ImplStateSnap>} */
  let newContracts
  /** @type {import("../utils.js").ShellBackground} */
  let localNode

  const owner = new Wallet(LocalTestnetAddresses.ownerPrivateKey)
  const buyer = new Wallet(LocalTestnetAddresses.buyerPrivateKey)
  const cipher = "abcdefg"

  before(async () => {
    // starts local node in background
    localNode = shellBackground(["yarn hardhat node"], console.log)

    const remoteUrl = process.env.REMOTE_URL || shell("git", "config", "--get", "remote.origin.url");
    console.log(`Testing against branch ${branchToTestAgainst} of ${remoteUrl}`);

    // clones and builds old version of contracts into temp folder
    await shellLog(["rm", "-rf", testTempDir], console.log)
    await shellLog(["mkdir", testTempDir], console.log)
    await shellLog([
      `git clone ${remoteUrl} --depth 1 --branch ${branchToTestAgainst} --single-branch ${testTempDir}`,
      `&&`,
      `rm -rf ${path.join(testTempDir, ".git")}`
    ], console.log)
    await shellLog([
      `cd ${path.join(testTempDir, "Goerli", "clonefactory")}`,
      "&& yarn",
      "&& make compile",
      "&& make build-js",
    ], console.log)

    // deploys old version of contracts
    await shellLog([
      `cd ${path.join(testTempDir, "Goerli", "clonefactory")}`,
      "&& make node-local-deploy"
    ], console.log)

    // collects addresses of old smart-contracts
    cloneFactoryAddr = fs.readFileSync(path.join(testTempDir, "Goerli", "clonefactory", "clonefactory-addr.tmp")).toString().trim()
    lumerinAddr = fs.readFileSync(path.join(testTempDir, "Goerli", "clonefactory", "lumerin-addr.tmp")).toString().trim()
  });

  it("should generate contract state and store it", async function () {
    const { CloneFactory, Implementation, Lumerin } = require("../../test-temp/Goerli/clonefactory/build-js/dist/index.js")
    const cf = CloneFactory(web3, cloneFactoryAddr)
    markerplaceFee = await cf.methods.marketplaceFee().call()
    const lumerin = Lumerin(web3, lumerinAddr)

    await lumerin.methods.transfer(buyer.address, String(LMRToLMRWithDecimals(100000))).send({ from: owner.address })
    await cf.methods.setAddToWhitelist(buyer.address).send({ from: owner.address })

    const addresses = await cf.methods.getContractList().call();

    /** @type {Map<string,ImplStateSnap>} */
    oldContracts = new Map();
    for (const address of addresses) {
      const impl = Implementation(web3, address)
      const { _price, _length, _limit, _speed } = await impl.methods.terms().call();

      // first purchase
      await lumerin.methods.increaseAllowance(cloneFactoryAddr, _price).send({ from: buyer.address })
      await cf.methods.setPurchaseRentalContract(address, cipher, 0).send({ from: buyer.address, value: markerplaceFee })
      await AdvanceBlockTime(web3, hoursToSeconds(1))

      // closeout to generate history entry
      await impl.methods.setContractCloseOut("0").send({ from: buyer.address })
      await AdvanceBlockTime(web3, 30)

      // second purchase
      await lumerin.methods.increaseAllowance(cloneFactoryAddr, _price).send({ from: buyer.address })
      await cf.methods.setPurchaseRentalContract(address, cipher, 0).send({ from: buyer.address, value: markerplaceFee })

      // update old terms to generate future terms
      await AdvanceBlockTime(web3, 30)
      await cf.methods.setUpdateContractInformation(
        address,
        String(Number(_price) + 1),
        String(Number(_limit + 1)),
        String(Number(_speed + 1)),
        String(Number(_length + 1))
      ).send({ from: owner.address, value: markerplaceFee })

      const terms = await impl.methods.getPublicVariables().call();
      const futureTerms = await impl.methods.futureTerms().call();
      const [historyEntry] = await impl.methods.getHistory("0", "1").call()
      const pubKey = await impl.methods.pubKey().call()

      oldContracts.set(address, {
        state: terms._state,
        price: terms._price,
        limit: terms._limit,
        speed: terms._speed,
        length: terms._length,
        startingBlockTimestamp: terms._startingBlockTimestamp,
        buyer: terms._buyer,
        seller: terms._seller,
        encryptedPoolData: terms._encryptedPoolData,
        isDeleted: terms._isDeleted,
        balance: terms._balance,
        hasFutureTerms: terms._hasFutureTerms,
        version: terms._version,
        futurePrice: futureTerms._price,
        futureLimit: futureTerms._limit,
        futureSpeed: futureTerms._speed,
        futureLength: futureTerms._length,
        historyBuyer: historyEntry._buyer,
        historyPrice: historyEntry._price,
        historySpeed: historyEntry._speed,
        historyLength: historyEntry._length,
        pubKey: pubKey,
      })
    }
  })

  it("should perfom an upgrade of old contracts", async function () {
    await UpdateCloneFactory("CloneFactory", cloneFactoryAddr, owner.privateKey, console.log)
    await UpdateImplementation("Implementation", cloneFactoryAddr, owner.privateKey, console.log)
  })

  it("should get new terms", async function () {
    const cf = CloneFactory(web3, cloneFactoryAddr)
    const addresses = await cf.methods.getContractList().call();
    /** @type {Map<string,ImplStateSnap>} */
    newContracts = new Map();
    for (const address of addresses) {
      const impl = Implementation(web3, address)
      const terms = await impl.methods.getPublicVariables().call();
      const futureTerms = await impl.methods.futureTerms().call();
      const [historyEntry] = await impl.methods.getHistory("0", "1").call()
      const pubKey = await impl.methods.pubKey().call()
      newContracts.set(address, {
        state: terms._state,
        price: terms._price,
        limit: terms._limit,
        speed: terms._speed,
        length: terms._length,
        startingBlockTimestamp: terms._startingBlockTimestamp,
        buyer: terms._buyer,
        seller: terms._seller,
        encryptedPoolData: terms._encryptedPoolData,
        isDeleted: terms._isDeleted,
        balance: terms._balance,
        hasFutureTerms: terms._hasFutureTerms,
        version: terms._version,
        futurePrice: futureTerms._price,
        futureLimit: futureTerms._limit,
        futureSpeed: futureTerms._speed,
        futureLength: futureTerms._length,
        historyBuyer: historyEntry._buyer,
        historyPrice: historyEntry._price,
        historySpeed: historyEntry._speed,
        historyLength: historyEntry._length,
        pubKey: pubKey,
      })
    }
  })

  it("should ensure new terms match old terms", async function () {
    expect(oldContracts.keys()).to.be.deep.equal(newContracts.keys())
    expect(oldContracts.values()).to.be.deep.equal(newContracts.values())
    expect(oldContracts).deep.equal(newContracts)
  })

  after(async () => {
    // shell("rm", "-rf", testTempDir)

    if (localNode) {
      localNode.stop()
      await localNode.donePromise.catch(() => { })
    }
    console.log("Done")
  });
})

/**
 * @typedef {Object} ImplStateSnap
 * @property {string} state
 * @property {string} price
 * @property {string} limit
 * @property {string} speed
 * @property {string} length
 * @property {string} startingBlockTimestamp
 * @property {string} buyer
 * @property {string} seller
 * @property {string} encryptedPoolData
 * @property {boolean} isDeleted
 * @property {string} balance
 * @property {boolean} hasFutureTerms
 * @property {string} version
 * @property {string} futurePrice
 * @property {string} futureLimit
 * @property {string} futureSpeed
 * @property {string} futureLength
 * @property {string} historyBuyer
 * @property {string} historyPrice
 * @property {string} historySpeed
 * @property {string} historyLength
 * @property {string} pubKey
 */