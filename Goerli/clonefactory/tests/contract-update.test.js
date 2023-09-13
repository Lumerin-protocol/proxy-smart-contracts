//@ts-check
const { expect } = require("chai");
const ethers  = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist");
const { ToString } = require("./utils");

describe.only("Contract terms update", function () {
  const lumerinAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
  const cloneFactoryAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"

  const owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
  const seller = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  const buyer = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

  const price = ToString(1 * 10**8);
  const newPrice = ToString(2 * 10**8);

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(ethers.config.networks.localhost.url)
  const cf = CloneFactory(web3, cloneFactoryAddress)
  let hrContractAddr = ""
  let fee = ""

  before(async ()=>{
    const lumerin = Lumerin(web3, lumerinAddress)
    await lumerin.methods.transfer(buyer, ToString(10* 10**8)).send({from: owner})
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, ToString(10* 10**8)).send({from: buyer})
    await lumerin.methods.transfer(seller,  ToString(10* 10**8)).send({from: owner})
    await cf.methods.setAddToWhitelist(seller).send({from: owner})
    fee = await cf.methods.marketplaceFee().call()
  })

  it("should create contract and check its status", async function(){
    const receipt = await cf.methods.setCreateNewRentalContract(price, "0", "1", "3600", cloneFactoryAddress, "123").send({from: seller, value: fee})
    hrContractAddr = receipt.events?.contractCreated.returnValues._address;
    const impl = Implementation(web3, hrContractAddr)
    const newData = await impl.methods.futureTerms().call()
    const data = await impl.methods.terms().call()

    expect(newData._length).equal('0')
    expect(newData._price).equal('0')
    expect(newData._limit).equal('0')
    expect(newData._speed).equal('0')
    expect(data._price).equal(price);
  })

  it('should prohibit updating if caller is not a seller', async function(){
    try{
      await cf.methods.setUpdateContractInformation(hrContractAddr, newPrice, '1', '1', '1').send({ from: buyer })
      expect.fail("should throw error")
    } catch(e){
      expect(e.message).includes("you are not authorized")
    }
  })

  it("should update contract and emit event without futureTerms update", async function() {
    const receipt = await cf.methods.setUpdateContractInformation(hrContractAddr, newPrice, '2', '3', '4').send({from: seller})

    const impl = Implementation(web3, hrContractAddr)
    const futureTerms = await impl.methods.futureTerms().call()
    const data = await impl.methods.getPublicVariables().call()

    expect(futureTerms._price).equal('0')
    expect(data._price).equal(newPrice);
    expect(data._limit).equal('2');
    expect(data._speed).equal('3');
    expect(data._length).equal('4');

    const events = await impl.getPastEvents('purchaseInfoUpdated', {fromBlock: receipt.blockNumber, toBlock: "latest"})
    const isEventFound = events.find((e)=>
      e.returnValues._address === hrContractAddr
    )

    expect(isEventFound).not.undefined
  })


  it("should store futureTerms for contract and should not emit update event if contract is running", async function(){
    const price = ToString(2 * 10**8);
    const newPrice = ToString(3 * 10**8);
    await cf.methods.setPurchaseRentalContract(hrContractAddr, '').send({from: buyer, value: fee});
    const receipt = await cf.methods.setUpdateContractInformation(hrContractAddr,  newPrice, '22', '33', '44').send({from: seller})
    const impl = Implementation(web3, hrContractAddr)
    const futureTerms = await impl.methods.futureTerms().call()
    const data = await impl.methods.getPublicVariables().call()

    expect(futureTerms._price).equal(newPrice);
    expect(futureTerms._limit).equal('22');
    expect(futureTerms._speed).equal('33');
    expect(futureTerms._length).equal('44');

    expect(data._price).equal(price);
    expect(data._limit).equal('2');
    expect(data._speed).equal('3');
    expect(data._length).equal('4');


    const events = await impl.getPastEvents('purchaseInfoUpdated', {fromBlock: receipt.blockNumber, toBlock: "latest"})
    const isEventFound = !!events.find((e)=>
      e.returnValues._address === hrContractAddr
    )

    expect(isEventFound).to.be.false;
  })

  it("should apply futureTerms after contract closed and emit event", async function(){
    const newPrice = ToString(3 * 10**8);
    const impl = Implementation(web3, hrContractAddr)
    const receipt = await impl.methods.setContractCloseOut("0").send({from: buyer})

    const futureTerms = await impl.methods.futureTerms().call()

    expect(futureTerms._price).equal('0');
    expect(futureTerms._length).equal('0');
    expect(futureTerms._limit).equal('0');
    expect(futureTerms._speed).equal('0');

    const data = await impl.methods.getPublicVariables().call()
    expect(data._price).equal(newPrice);
    expect(data._limit).equal('22');
    expect(data._speed).equal('33');
    expect(data._length).equal('44');

    const events = await impl.getPastEvents('purchaseInfoUpdated', {fromBlock: receipt.blockNumber, toBlock: "latest"})
    const isEventFound = events.find((e)=>
      e.returnValues._address === hrContractAddr
    )

    expect(isEventFound).not.undefined
  })
})
