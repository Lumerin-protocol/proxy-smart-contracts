//@ts-check
const { expect } = require("chai");
const ethers  = require("hardhat");
const Web3 = require("web3");
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist")
const { ToString, WaitBlockchain, ToLMNDecimals } = require('./utils')

describe("Implementation tests", function () {
  let implementationContractAddress = null;
  
  const lumerinAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
  const cloneFactoryAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
  
  const from ="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
  const buyerAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  const sellerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

  const contractDuration = 10 * 3600;
  const contractPrice = ToLMNDecimals(0.001)
  const addLMNAmount = ToLMNDecimals(1000)
  const marketplaceFee = 0.01;

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(ethers.config.networks.localhost.url) 
  const cloneFactoryInstance = CloneFactory(web3, cloneFactoryAddress)
  const lumerinInstance = Lumerin(web3, lumerinAddress);

  const pubKey = "test-public-key"
  const encryptedPoolData = "test-encrypted-data"

  it('should deploy contract', async function(){
    await cloneFactoryInstance.methods.setAddToWhitelist(sellerAddress).send({ from })
    const tx = await cloneFactoryInstance.methods.setCreateNewRentalContract(
      String(contractPrice), "0", "10000", String(contractDuration), cloneFactoryAddress, pubKey
    ).send({ from: sellerAddress })
    implementationContractAddress = tx?.events?.[0].address
    expect(implementationContractAddress).to.be.not.null
  })

  it('should close at end and pay correct funds/fees', async function(){
    await TestChargesPayoutsFees(1)
  })

  it('should close after 90% time and pay correct funds/fees', async function(){
    await TestChargesPayoutsFees(0.9)
  })

  it('should close after 50% time and pay correct funds/fees', async function(){
    await TestChargesPayoutsFees(0.5)
  })

  it('should close after 1% time and pay correct funds/fees', async function(){
    await TestChargesPayoutsFees(0.1)
  })

  it('should close after 0.1% time and receive correct amount of the funds', async function(){
    await TestChargesPayoutsFees(0.01)
  })

  /**
   * 
   * @param {number} elapsedFraction should be less than 1
   */
  async function TestChargesPayoutsFees(elapsedFraction){
    if (elapsedFraction <= 0 || elapsedFraction > 1) {
      throw new Error("elapsedFraction should be within 0..1 interval")
    }
  
    await lumerinInstance.methods.transfer(buyerAddress, ToString(addLMNAmount)).send({ from })
    await lumerinInstance.methods.increaseAllowance(cloneFactoryAddress, String(addLMNAmount)).send({ from: buyerAddress })
    
    const initialBuyerBalance = Number(await lumerinInstance.methods.balanceOf(buyerAddress).call());
    const initialSellerBalance = Number(await lumerinInstance.methods.balanceOf(sellerAddress).call());
    const initialFeeRecipientBalance = Number(await lumerinInstance.methods.balanceOf(from).call());
  
    const implementationInstance = Implementation(web3, implementationContractAddress)
  
    const tx = await cloneFactoryInstance.methods.setPurchaseRentalContract(
      implementationContractAddress, encryptedPoolData, 
    ).send({ from: buyerAddress });
    const startTime = (await web3.eth.getBlock(tx.blockHash)).timestamp
    
    // simulating time in blockchain
    // removing one second for better rounding
    await WaitBlockchain(web3, contractDuration*elapsedFraction - 1) 
  
    const tx2 = await implementationInstance.methods.setContractCloseOut("0").send({ from: buyerAddress })
    const endTime = (await web3.eth.getBlock(tx2.blockHash)).timestamp
  
    console.log("elapsed blockchain time", Number(endTime)- Number(startTime), "total time", contractDuration)
  
    const sellerBalance = Number(await lumerinInstance.methods.balanceOf(sellerAddress).call());
    const buyerBalance = Number(await lumerinInstance.methods.balanceOf(buyerAddress).call());
    const feeRecipientBalance = Number(await lumerinInstance.methods.balanceOf(from).call());
    
    const deltaBuyerBalance = buyerBalance - initialBuyerBalance;
    const deltaSellerBalance = sellerBalance - initialSellerBalance;
    const deltaFeeRecipientBalance = feeRecipientBalance - initialFeeRecipientBalance;
  
    console.log("delta of balance: buyer", deltaBuyerBalance, "seller", deltaSellerBalance, "fee recipient", deltaFeeRecipientBalance)
    
    const partialPrice = contractPrice * elapsedFraction;
    const actBuyerFee = (Math.abs(deltaBuyerBalance) - partialPrice) / partialPrice;
    const actSellerFee = (partialPrice - Math.abs(deltaSellerBalance)) / partialPrice;
    const actMarketplaceFee = Math.abs(deltaFeeRecipientBalance) / partialPrice;
    
    console.log("actual fees: buyer", actBuyerFee, "seller", actSellerFee, "marketplace", actMarketplaceFee)

    const expectedBuyerCharge = partialPrice * (1 + marketplaceFee);
    const expectedSellerPayout = partialPrice * (1 - marketplaceFee);
    const expectedFeeCharge = partialPrice * (2 * marketplaceFee);
  
    const allowance = 0.001;
    
    expect(actSellerFee).approximately(marketplaceFee, allowance, "invalid seller fee")
    expect(deltaSellerBalance).approximately(expectedSellerPayout, allowance*expectedSellerPayout, "invalid seller payout")
    
    expect(actBuyerFee).approximately(marketplaceFee, allowance, "invalid buyer fee")
    expect(-deltaBuyerBalance).approximately(expectedBuyerCharge, allowance*expectedBuyerCharge, "invalid buyer charge")
    
    expect(actMarketplaceFee).approximately(marketplaceFee*2, allowance, "invalid marketplace fee")
    expect(deltaFeeRecipientBalance).approximately(expectedFeeCharge, allowance*partialPrice, "invalid fee amount")
  }
})

