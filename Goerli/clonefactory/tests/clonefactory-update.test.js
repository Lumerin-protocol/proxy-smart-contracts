//@ts-check
const { expect } = require("chai");
const Web3 = require("web3");
const { DeployCloneFactory, DeployLumerin, CreateContract, ApproveSeller, UpdateCloneFactory, UpdateImplementation } = require("../lib/deploy");
const { config, ethers } = require("hardhat");
const { CloneFactory, Implementation } = require("../build-js/dist")
const { Wallet } = require("ethers");

// TODO: generate gas usage report for this file
describe("Clonefactory update", function () {
    /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(config.networks.localhost.url)
  const deployerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  const priceDecimalLMR = (10**8).toString();

  web3.eth.accounts.wallet.create(0).add(
    web3.eth.accounts.privateKeyToAccount(deployerPrivateKey)
  )

  let lumerinAddr, cloneFactoryAddr, createdContractAddr = "";

  it("should deploy a new clonefactory", async function () {
    ({address: lumerinAddr} = await DeployLumerin(deployerPrivateKey));
    ({address: cloneFactoryAddr} = await DeployCloneFactory(lumerinAddr, deployerPrivateKey));

    const cloneFactory = CloneFactory(web3, cloneFactoryAddr);
    const list = await cloneFactory.methods.getContractList().call();
    expect(list).to.be.empty;
  });

  it("should approve a seller", async function () {
    const sellerAddr = new Wallet(deployerPrivateKey).address
    await ApproveSeller(sellerAddr, CloneFactory(web3, cloneFactoryAddr), sellerAddr);
    
    const cf = CloneFactory(web3, cloneFactoryAddr);
    const isWhitelisted = await cf.methods.checkWhitelist(sellerAddr).call()

    expect(isWhitelisted).to.be.true;
  })

  it("should create contract", async function () {


    const cf = CloneFactory(web3, cloneFactoryAddr);
    const fee = await cf.methods.marketplaceFee().call()
    const { address } = await CreateContract(priceDecimalLMR, (30*60).toString(), "10000", cf, new Wallet(deployerPrivateKey), fee);
    createdContractAddr = address;
    const contractsList = await cf.methods.getContractList().call()
    expect(contractsList).to.include(createdContractAddr)

    const contract = Implementation(web3, createdContractAddr);
    const terms = await contract.methods.terms().call();
    expect(terms._price).to.equal(priceDecimalLMR);
  })

  it("should update a clonefactory", async function () {
    await UpdateCloneFactory("CloneFactoryTest", cloneFactoryAddr, deployerPrivateKey);
  });

  it("should verify clonefactory actually updated", async function () {
    const CloneFactoryTest = await ethers.getContractFactory("CloneFactoryTest");
    const result = await CloneFactoryTest.attach(cloneFactoryAddr).doesNothing();
    expect(result).to.equal(true);
  })

  it("should verify clonefactory state after update (whitelist)", async function () {
    const sellerAddr = new Wallet(deployerPrivateKey).address

    const cf = CloneFactory(web3, cloneFactoryAddr);
    const isWhitelisted = await cf.methods.checkWhitelist(sellerAddr).call()
    
    expect(isWhitelisted).to.be.true;
  });

  it("should verify clonefactory state after update (implementations)", async function () {
    const cf = CloneFactory(web3, cloneFactoryAddr);
    const contractsList = await cf.methods.getContractList().call()
    
    expect(contractsList).to.include(createdContractAddr)
  });

  it("should update an implementation", async function () {
    await UpdateImplementation("ImplementationTest", cloneFactoryAddr, deployerPrivateKey);
  });

  it("should verify implementation actually updated", async function () {
    const ImplementationTest = await ethers.getContractFactory("ImplementationTest");
    const result = await ImplementationTest.attach(createdContractAddr).doesNothing();
    expect(result).to.equal(true);
  })

  it("should verify contract state after implementation update", async function () {
    const contract = Implementation(web3, createdContractAddr);
    const terms = await contract.methods.terms().call();
    expect(terms._price).to.equal(priceDecimalLMR);
  })
});



