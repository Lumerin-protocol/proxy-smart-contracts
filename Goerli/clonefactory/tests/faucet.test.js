//@ts-check
const { expect } = require("chai");
const ethers  = require("hardhat");
const Web3 = require("web3");
// const { Faucet, Lumerin } = require("../build-js/dist")
// const { RandomEthAddress, RandomIPAddress, ToString, AdvanceBlockTime } = require('./utils')

// describe("Faucet", function () {
//   const lumerinAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
//   const faucetAddress = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512"
//   const claiment = RandomEthAddress()
//   const ipAddress = RandomIPAddress()
//   const from ="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
//   const ethWallet = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

//   /** @type {import("web3").default} */
//   const web3 = new Web3(ethers.config.networks.localhost.url)
//   const lumerinInstance = Lumerin(web3, lumerinAddress)
//   const faucetInstance = Faucet(web3, faucetAddress)

//   before(async ()=>{
//     // load balance to faucet
//     await lumerinInstance.methods.transfer(
//       faucetAddress, 
//       ToString(1000*10**8),
//     ).send({from})

//     await web3.eth.sendTransaction({
//       from: ethWallet,
//       to: faucetAddress,
//       value: ToString(1000*10**18),
//     })
//   })

//   it("should send correct amount of lmr and eth", async function(){
//     await faucetInstance.methods.supervisedClaim(claiment, ipAddress).send({ from })

//     const claimentLMNBalance = Number(await lumerinInstance.methods.balanceOf(claiment).call())
//     const claimentETHBalance = Number(await web3.eth.getBalance(claiment))

//     expect(claimentLMNBalance).equals(10 * 10**8)
//     expect(claimentETHBalance).equals(0.05 * 10**18)
//   })

//   it("should disallow for the same eth address within 24 hours", async function(){
//     try{
//       await faucetInstance.methods.supervisedClaim(claiment, "192.144.1.1").send({ from })
//       expect.fail("transaction should fail")
//     } catch(err){
//       expect(err.message).includes("you need to wait before claiming")
//     }
//   })

//   it("should disallow for the same ip address within 24 hours", async function(){
//     try{
//       await faucetInstance.methods.supervisedClaim(RandomEthAddress(), ipAddress).send({ from })
//       expect.fail("transaction should fail")
//     } catch(err){
//       expect(err.message).includes("you need to wait before claiming")
//     }
//   })

//   it("should allow for the new wallet and ip address", async function(){
//     await faucetInstance.methods.supervisedClaim(RandomEthAddress(), RandomIPAddress()).send({ from })
//   })

//   it('should allow when 24 hours elapse', async function(){
//     await AdvanceBlockTime(web3, 32*3600)
//
//     await faucetInstance.methods.supervisedClaim(claiment, ipAddress).send({ from })
//   })

//   it('canClaimTokens should disallow after recent claim', async function (){
//     const res = await faucetInstance.methods.canClaimTokens(claiment, ipAddress).call({ from })
//     expect(res).to.be.false
//   })

//   it('canClaimTokens should disallow if claiment the same but address different', async function (){
//     const res = await faucetInstance.methods.canClaimTokens(claiment, RandomIPAddress()).call({ from })
//     expect(res).to.be.false
//   })

//   it('canClaimTokens should disallow if address the same but claiment different', async function (){
//     const res = await faucetInstance.methods.canClaimTokens(RandomEthAddress(), ipAddress).call({ from })
//     expect(res).to.be.false
//   })

//   it('canClaimTokens should allow for different claiment and address', async function (){
//     const res = await faucetInstance.methods.canClaimTokens(RandomEthAddress(), RandomIPAddress()).call({ from })
//     expect(res).to.be.true
//   })
// })

