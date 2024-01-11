//@ts-check
const { expect } = require("chai");
const ethers = require("hardhat");
const Web3 = require("web3");
const { encrypt } = require('ecies-geth')
const { Lumerin, CloneFactory, Implementation } = require("../build-js/dist");
const { LocalTestnetAddresses, RandomEthAddress, ZERO_ADDRESS } = require("./utils");
const { remove0xPrefix, trimRight64Bytes } = require("../lib/utils");
const { Wallet } = require("ethers");


describe("Contract purchase", function () {
  const {
    lumerinAddress,
    cloneFactoryAddress,
    owner,
    seller,
    buyer,
    validatorAddr,
    validatorPrivateKey,
    sellerPrivateKey,
  } = LocalTestnetAddresses;

  /** @type {import("web3").default} */
  // @ts-ignore
  const web3 = new Web3(ethers.config.networks.localhost.url)
  const cf = CloneFactory(web3, cloneFactoryAddress)
  const lumerin = Lumerin(web3, lumerinAddress)
  let fee = ""
  let hrContractAddr = ""

  const price = String(1_000)
  const speed = String(1_000_000)
  const length = String(3600)
  const validatorURL = "stratum+tcp://validator.lumerin.io:3333"
  const destURL = "stratum+tcp://account.worker:pwd@brains.pool.io:3333"

  before(async () => {
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, price).send({ from: buyer })
    await lumerin.methods.transfer(buyer, "10000").send({ from: owner })
    await cf.methods.setAddToWhitelist(seller).send({ from: owner })
    fee = await cf.methods.marketplaceFee().call()

    const receipt = await cf.methods.setCreateNewRentalContractV2(price, "0", speed, length, "0", cloneFactoryAddress, "123").send({ from: seller, value: fee })
    hrContractAddr = receipt.events?.contractCreated.returnValues._address;
  })

  it("should purchase with cloud validator", async function () {
    const sellerWallet = new Wallet(sellerPrivateKey)
    const sellerPubKey = remove0xPrefix(sellerWallet.publicKey);

    const validatorWallet = new Wallet(validatorPrivateKey)
    const validatorPubKey = remove0xPrefix(validatorWallet.publicKey);

    const encValidatorURL = await encrypt(Buffer.from(sellerPubKey, "hex"), Buffer.from(validatorURL))
    const encDestURL = await encrypt(Buffer.from(validatorPubKey, "hex"), Buffer.from(destURL))

    const impl = Implementation(web3, hrContractAddr)
    const { _version } = await impl.methods.terms().call()

    await cf.methods.setPurchaseRentalContractV2(hrContractAddr, validatorAddr, encValidatorURL.toString('hex'), encDestURL.toString('hex'), _version)
      .send({ from: buyer, value: fee })

    const actValidatorURL = await impl.methods.encryptedValidatorURL().call()
    const actDestURL = await impl.methods.encryptedDestURL().call()
    const actValidatorAddr = await impl.methods.validator().call()

    expect(actValidatorURL).equal(encValidatorURL.toString('hex'))
    expect(actDestURL).equal(encDestURL.toString('hex'))
    expect(actValidatorAddr).equal(validatorAddr)

    await impl.methods.setContractCloseOut("0").send({ from: buyer })
  })


  it("should purchase with v1", async function () {
    const sellerWallet = new Wallet(sellerPrivateKey)
    const sellerPubKey = remove0xPrefix(sellerWallet.publicKey);

    const encValidatorURL = await encrypt(Buffer.from(sellerPubKey, "hex"), Buffer.from(validatorURL))

    const impl = Implementation(web3, hrContractAddr)
    const { _version } = await impl.methods.terms().call()

    await cf.methods.setPurchaseRentalContract(hrContractAddr, encValidatorURL.toString('hex'), _version)
      .send({ from: buyer, value: fee })


    const actValidatorURL = await impl.methods.encryptedValidatorURL().call()
    const actDestURL = await impl.methods.encryptedDestURL().call()
    const actValidatorAddr = await impl.methods.validator().call()

    expect(actValidatorURL).equal(encValidatorURL.toString('hex'))
    expect(actDestURL).equal("")
    expect(actValidatorAddr).equal(ZERO_ADDRESS)

    await impl.methods.setContractCloseOut("0").send({ from: buyer })
  })
})
