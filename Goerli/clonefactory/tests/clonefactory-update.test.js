//@ts-check
const { expect } = require("chai");
const Web3 = require("web3");
const { DeployCloneFactory, DeployLumerin, CreateContract, ApproveSeller, UpdateCloneFactory, UpdateImplementation } = require("../lib/deploy");
const { config } = require("hardhat");
const { CloneFactory, Implementation } = require("../build-js/dist")
const { Wallet } = require("ethers");

describe("Clonefactory update", function () {
    /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(config.networks.localhost.url)
  const deployerPkey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  const priceDecimalLMR = (10**8).toString();

  let lumerinAddr, cloneFactoryAddr, createdContractAddr = "";

  it("should deploy a new clonefactory", async function () {
    ({address: lumerinAddr} = await DeployLumerin(deployerPkey));
    ({address: cloneFactoryAddr} = await DeployCloneFactory(lumerinAddr, deployerPkey));

    const cloneFactory = CloneFactory(web3, cloneFactoryAddr);
    const list = await cloneFactory.methods.getContractList().call();
    expect(list).to.be.empty;
  });

  it("should approve a seller", async function () {
    const sellerAddr = new Wallet(deployerPkey).address
    await ApproveSeller(sellerAddr, CloneFactory(web3, cloneFactoryAddr), deployerPkey);
    
    const cf = CloneFactory(web3, cloneFactoryAddr);
    const isWhitelisted = await cf.methods.checkWhitelist(sellerAddr).call()

    expect(isWhitelisted).to.be.true;
  })

  it("should create contract", async function () {
    const cf = CloneFactory(web3, cloneFactoryAddr);
    const {address, gasUsed} = await CreateContract(priceDecimalLMR, (30*60).toString(), "10000", cf, deployerPkey);
    createdContractAddr = address;
    const contractsList = await cf.methods.getContractList().call()
    expect(contractsList).to.include(createdContractAddr)

    const contract = Implementation(web3, createdContractAddr);
    const actualPrice = await contract.methods.price().call();
    expect(actualPrice).to.equal(priceDecimalLMR);
  })

  it("should update a clonefactory", async function () {
    await UpdateCloneFactory("CloneFactory2", cloneFactoryAddr, deployerPkey);
  });

  it("should verify clonefactory state after update (whitelist)", async function () {
    const sellerAddr = new Wallet(deployerPkey).address

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
    await UpdateImplementation("Implementation2", cloneFactoryAddr, deployerPkey);
  });

  it("should verify contract state after implementation update", async function () {
    const contract = Implementation(web3, createdContractAddr);
    const actualPrice = await contract.methods.price().call();
    expect(actualPrice).to.equal(priceDecimalLMR);
  })

  // SHOULD EXPORT GAS FEE REPORT

  // COMPLETIONS SHOULD WORK
});



