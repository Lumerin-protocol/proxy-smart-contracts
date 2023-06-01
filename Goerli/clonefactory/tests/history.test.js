//@ts-check
const { expect } = require("chai");
const ethers  = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist");
const { AdvanceBlockTime } = require("./utils");

describe("Contract delete", function () {
  const lumerinAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
  const cloneFactoryAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"

  const owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
  const seller = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  const buyer = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(ethers.config.networks.localhost.url)
  const cf = CloneFactory(web3, cloneFactoryAddress)
  let hrContractAddr = ""

  const price = String(1_000)
  const speed = String(1_000_000)
  const length = String(3600)

  before(async ()=>{
    const lumerin = Lumerin(web3, lumerinAddress)
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, "10000").send({from: buyer})
    await lumerin.methods.transfer(buyer, "10000").send({from: owner})
    await cf.methods.setAddToWhitelist(seller).send({from: owner})
  })

  it("should create contract and check its history", async function(){
    const receipt = await cf.methods.setCreateNewRentalContract(price, "0", speed, length, cloneFactoryAddress, "123").send({from: seller})
    hrContractAddr = receipt.events?.contractCreated.returnValues._address;
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("0", "100").call()

    expect(data.length).equal(0)
  })

  it("should add history entry on bad closeout", async function(){
    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc").send({from: buyer})
    
    const impl = Implementation(web3, hrContractAddr)
    await impl.methods.setContractCloseOut("0").send({from: buyer})
    const data = await impl.methods.getHistory("0", "100").call()

    expect(data.length).equal(1)
    expect(data[0]?._goodCloseout).equal(false)
  })

  it("should add history entry on good closeout", async function(){
    const receipt = await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc").send({from: buyer})
    const { timestamp: purchaseTime } = await web3.eth.getBlock(receipt.blockNumber);

    await AdvanceBlockTime(web3, 3600)
    const impl = Implementation(web3, hrContractAddr)
    await impl.methods.setContractCloseOut("3").send({from: buyer})
    
    const data = await impl.methods.getHistory("0", "100").call()
    const entry = data.find(entry => entry._purchaseTime == purchaseTime)

    expect(entry).not.undefined
    expect(entry?._goodCloseout).equal(true)
  })

  it("should verify other fields", async function(){
    const receipt = await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc").send({from: buyer})
    const { timestamp: purchaseTime } = await web3.eth.getBlock(receipt.blockNumber);
    
    const impl = Implementation(web3, hrContractAddr)
    const receipt2 = await impl.methods.setContractCloseOut("0").send({from: buyer})
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

  it("should paginate history: limit less than total number of elements", async function(){
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("0", "1").call()

    expect(data.length).equal(1)
  })

  it("should paginate history: limit more than total number of elements", async function(){
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("0", "100").call()

    expect(data.length).equal(3)
  })

  it("should paginate history: offset less than total number of elements", async function(){
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("1", "1").call()

    expect(data.length).equal(1)
  })

  it("should paginate history: offset more than total number of elements", async function(){
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getHistory("100", "1").call()

    expect(data.length).equal(0)
  })

  it("should paginate history: verify entries", async function(){
    const impl = Implementation(web3, hrContractAddr)

    const [entry1] = await impl.methods.getHistory("0", "1").call()
    const [entry2] = await impl.methods.getHistory("1", "1").call()
    const entries  = await impl.methods.getHistory("0", "2").call()

    expect(entries.length).equal(2)
    expect(entry1).deep.equal(entries[0])
    expect(entry2).deep.equal(entries[1])
    expect(entry1._purchaseTime).not.equal(entry2._purchaseTime)
  })

  it("should return correct stats", async function(){
    const impl = Implementation(web3, hrContractAddr)
    const stats = await impl.methods.getStats().call()

    expect(stats._successCount).equal("1")
    expect(stats._failCount).equal("2")
  })
})
