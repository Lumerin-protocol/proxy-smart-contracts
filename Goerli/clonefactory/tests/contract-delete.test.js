//@ts-check
const { expect } = require("chai");
const ethers  = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist")

describe("Contract delete", function () {
  const lumerinAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
  const cloneFactoryAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"

  const owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
  const seller = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  const buyer = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(ethers.config.networks.localhost.url)
  const cf = CloneFactory(web3, cloneFactoryAddress)
  let hrContractAddr = ""

  before(async ()=>{
    const lumerin = Lumerin(web3, lumerinAddress)
    console.log("HERERERER 1")
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, "10000").send({from: buyer})
    console.log("HERERERER 2")
    await lumerin.methods.transfer(buyer, "10000").send({from: owner})
    console.log("HERERERER 3")
    console.log("CLONEFACTORY ADDRESS:     ", cloneFactoryAddress)
    await cf.methods.setAddToWhitelist(seller).send({from: owner})
    console.log("HERERERER 4")
  })

  it("should create contract and check its status", async function(){
    const receipt = await cf.methods.setCreateNewRentalContract("1", "0", "1", "3600", cloneFactoryAddress, "123").send({from: seller})
    hrContractAddr = receipt.events?.contractCreated.returnValues._address;
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getPublicVariables().call()

    expect(data._isDeleted).equal(false)
  })

  it('should prohibit deletion if caller is not a seller', async function(){
    try{
      await cf.methods.setContractDeleted(hrContractAddr, true).send({from: buyer})
      expect.fail("should throw error")
    } catch(e){
      expect(e.message).includes("you are not authorized")
    }
  })

  it("should delete contract and emit event", async function(){
    await cf.methods.setContractDeleted(hrContractAddr, true).send({from: seller})
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getPublicVariables().call()

    expect(data._isDeleted).equal(true)

    const events = await cf.getPastEvents("contractDeleteUpdated", {fromBlock: 0, toBlock: "latest"})
    const isEventFound = events.find((e)=>
      e.returnValues._address === hrContractAddr && 
      e.returnValues._isDeleted === true
    )

    expect(isEventFound).not.undefined
  })

  it("should error on second attempt to delete", async function(){
    try{
      await cf.methods.setContractDeleted(hrContractAddr, true).send({from: seller})
      expect.fail("should throw error")
    } catch(e){
      expect(e.message).includes("contract delete state is already set to this value")
    }
  })

  it("should block purchase if contract deleted", async function(){
    try{
      await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc").send({from: buyer})
      expect.fail("should throw error")
    } catch(e){
      expect(e.message).includes("cannot purchase deleted contract")
    }
  })

  it("should undelete contract and emit event", async function(){
    await cf.methods.setContractDeleted(hrContractAddr, false).send({from: seller})
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getPublicVariables().call()

    expect(data._isDeleted).equal(false)

    const events = await cf.getPastEvents("contractDeleteUpdated", {fromBlock: 0, toBlock: "latest"})
    const isEventFound = events.find((e) =>
      e.returnValues._address === hrContractAddr && 
      e.returnValues._isDeleted === false
    )

    expect(isEventFound).not.undefined
  })

  it("should allow purchase if contract undeleted", async function(){
    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc").send({from: buyer})
  })

  it("should allow delete contract if contract is purchased", async function(){
    await cf.methods.setContractDeleted(hrContractAddr, true).send({from: seller})
    const impl = Implementation(web3, hrContractAddr)
    const data = await impl.methods.getPublicVariables().call()

    expect(data._isDeleted).equal(true)
  })

  it("should prohibit deletion on the contract instance", async function(){
    const impl = Implementation(web3, hrContractAddr)
    try{
      await impl.methods.setContractDeleted(true).send({from: seller})
      expect.fail("should throw error")
    } catch(e){
      expect(e.message).includes("this address is not approved to call this function")
    }
  })

  it("should allow deletion from clonefactory owner", async function(){
    const impl = Implementation(web3, hrContractAddr)
    try{
      await impl.methods.setContractDeleted(true).send({from: owner})
      expect.fail("should throw error")
    } catch(e){
      expect(e.message).includes("this address is not approved to call this function")
    }
  })
})
