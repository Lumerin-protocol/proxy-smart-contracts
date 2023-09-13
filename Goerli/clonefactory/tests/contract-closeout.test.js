//@ts-check
const { expect } = require("chai");
const ethers  = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist");
const { AdvanceBlockTime } = require("./utils");

describe("Contract closeout", function () {
  const lumerinAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
  const cloneFactoryAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"

  const owner = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
  const seller = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  const buyer = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(ethers.config.networks.localhost.url)
  const cf = CloneFactory(web3, cloneFactoryAddress)
  const lumerin = Lumerin(web3, lumerinAddress)
  let hrContractAddr = ""
  let fee = ""

  const price = String(1_000)
  const speed = String(1_000_000)
  const length = String(3600)

  before(async ()=>{
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, "10000").send({from: buyer})
    await lumerin.methods.transfer(buyer, "10000").send({from: owner})
    await cf.methods.setAddToWhitelist(seller).send({from: owner})
    fee = await cf.methods.marketplaceFee().call()
  })

  it("should verify balances after 100% completion", async function(){
    const receipt = await cf.methods.setCreateNewRentalContract(price, "3", speed, length, cloneFactoryAddress, "123").send({from: seller, value: fee})
    hrContractAddr = receipt.events?.contractCreated.returnValues._address;
    
    await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc").send({from: buyer, value: fee})
    const sellerBalance = Number(await lumerin.methods.balanceOf(seller).call());

    await AdvanceBlockTime(web3, Number(length))

    const impl = Implementation(web3, hrContractAddr)
    await impl.methods.setContractCloseOut("3").send({from: seller, value: fee})

    const sellerBalanceAfter = Number(await lumerin.methods.balanceOf(seller).call());
    const deltaSellerBalance = sellerBalanceAfter - sellerBalance;

    expect(deltaSellerBalance).equal(Number(price))
  })

  it("should verify balances after 0% early closeout", async function(){
    await testEarlyCloseout(0, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should verify balances after 1% early closeout", async function(){
    await testEarlyCloseout(0.01, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })
  
  it("should verify balances after 10% early closeout", async function(){
    await testEarlyCloseout(0.1, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should verify balances after 50% early closeout", async function(){
    await testEarlyCloseout(0.5, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should verify balances after 75% early closeout", async function(){
    await testEarlyCloseout(0.75, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })

  it("should verify balances after 100% early closeout", async function(){
    await testEarlyCloseout(1, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3)
  })
})

/**
 * 
 * @param {number} progress // 0.0 - 1.0 early closeout contract progress
 * @param {string} fee 
 * @param {string} seller 
 * @param {string} buyer 
 * @param {string} cloneFactoryAddress
 * @param {string} lumerinAddress
 * @param {import("web3").default} web3 
 */
async function testEarlyCloseout(progress, fee, seller, buyer, cloneFactoryAddress, lumerinAddress, web3){
  const cf = CloneFactory(web3, cloneFactoryAddress)
  const lumerin = Lumerin(web3, lumerinAddress);
  const speed = String(1_000_000)
  const length = String(3600)
  const price = String(1_000)

  const receipt = await cf.methods.setCreateNewRentalContract(price, "0", speed, String(length), cloneFactoryAddress, "123").send({from: seller, value: fee})
  const hrContractAddr = receipt.events?.contractCreated.returnValues._address;
  
  await cf.methods.setPurchaseRentalContract(hrContractAddr, "abc").send({from: buyer, value: fee})
  await lumerin.methods.balanceOf(hrContractAddr).call().then(res=>console.log("contract balance", res))

  const sellerBalance = Number(await lumerin.methods.balanceOf(seller).call());
  const buyerBalance = Number(await lumerin.methods.balanceOf(buyer).call());

  await AdvanceBlockTime(web3, progress*Number(length))
  
  // closeout by buyer
  const impl = Implementation(web3, hrContractAddr)
  await impl.methods.setContractCloseOut("0").send({from: buyer, value: fee})
  const buyerBalanceAfter = Number(await lumerin.methods.balanceOf(buyer).call());
  const deltaBuyerBalance = buyerBalanceAfter - buyerBalance;
  const buyerRefundFraction = (1 - progress)
  const buyerRefundAmount = buyerRefundFraction * Number(price)
  expect(deltaBuyerBalance).equal(buyerRefundAmount, "buyer should be " + buyerRefundFraction*100 + "% refunded")

  // claim by seller
  await impl.methods.setContractCloseOut("1").send({from: seller, value: fee})
  const sellerBalanceAfter = Number(await lumerin.methods.balanceOf(seller).call());
  const deltaSellerBalance = sellerBalanceAfter - sellerBalance;
  const sellerClaimFraction = progress
  const sellerClaimAmount = sellerClaimFraction * Number(price);
  expect(deltaSellerBalance).equal(sellerClaimAmount, "seller should collect " + sellerClaimFraction*100 + " of the price")
}