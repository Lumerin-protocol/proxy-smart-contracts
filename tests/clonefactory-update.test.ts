import { expect } from "chai"
import Web3 from "web3"
import { DeployCloneFactory, DeployLumerin, CreateContract, ApproveSeller, UpdateCloneFactory, UpdateImplementation } from "../lib/deploy"
import { config, ethers } from "hardhat"
import { CloneFactory, Implementation } from "../build-js/dist"
import { Wallet } from "ethers"
import { LocalTestnetAddresses } from "./utils"

// TODO: generate gas usage report for this file
describe("Clonefactory update", function () {
  const web3 = new Web3(config.networks.localhost.url);
  const deployerPrivateKey = LocalTestnetAddresses.deployerPrivateKey;
  const priceDecimalLMR = (10 ** 8).toString();
  const feeRecipientAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

  web3.eth.accounts.wallet.create(0).add(
    web3.eth.accounts.privateKeyToAccount(deployerPrivateKey)
  )

  let lumerinAddr = "";
  let cloneFactoryAddr="";
  let createdContractAddr = "";

  it("should deploy a new clonefactory", async () => {
    ({ address: lumerinAddr } = await DeployLumerin(deployerPrivateKey));
    ({ address: cloneFactoryAddr } = await DeployCloneFactory(lumerinAddr, deployerPrivateKey, feeRecipientAddress));

    const cloneFactory = CloneFactory(web3, cloneFactoryAddr);
    const list = await cloneFactory.methods.getContractList().call();
    expect(list).to.be.empty;
  });

  it("should approve a seller", async () => {
    const sellerAddr = new Wallet(deployerPrivateKey).address
    await ApproveSeller(sellerAddr, CloneFactory(web3, cloneFactoryAddr), sellerAddr);

    const cf = CloneFactory(web3, cloneFactoryAddr);
    const isWhitelisted = await cf.methods.checkWhitelist(sellerAddr).call()

    expect(isWhitelisted).to.be.true;
  })

  it("should create contract", async function () {
    const cf = CloneFactory(web3, cloneFactoryAddr);
    const fee = await cf.methods.marketplaceFee().call()
    const { address } = await CreateContract(priceDecimalLMR, (30 * 60).toString(), "10000", cf, new Wallet(deployerPrivateKey), fee);
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



