import { expect } from "chai"
import ethers from "hardhat"
import Web3 from "web3"
import { encrypt } from 'ecies-geth'
import { Lumerin, CloneFactory, Implementation } from "../build-js/dist"
import { LocalTestnetAddresses, ZERO_ADDRESS } from "./utils"
import { remove0xPrefix } from "../lib/utils"
import { Wallet } from "ethers"

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

    const history_before = await impl.methods.getHistory('0', '100').call()
    expect(history_before.length).equal(0)

    await cf.methods.setPurchaseRentalContractV2(hrContractAddr, validatorAddr, encValidatorURL.toString('hex'), encDestURL.toString('hex'), _version)
      .send({ from: buyer, value: fee })

    const actValidatorURL = await impl.methods.encrValidatorURL().call()
    const actDestURL = await impl.methods.encrDestURL().call()
    const actValidatorAddr = await impl.methods.validator().call()
    const history_after = await impl.methods.getHistory('0', '100').call()

    expect(actValidatorURL).equal(encValidatorURL.toString('hex'))
    expect(actDestURL).equal(encDestURL.toString('hex'))
    expect(actValidatorAddr).equal(validatorAddr)
    expect(history_after.length).equal(1)
    expect(history_after[0]._buyer).equal(buyer)

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


    const actValidatorURL = await impl.methods.encrValidatorURL().call()
    const actDestURL = await impl.methods.encrDestURL().call()
    const actValidatorAddr = await impl.methods.validator().call()

    expect(actValidatorURL).equal(encValidatorURL.toString('hex'))
    expect(actDestURL).equal("")
    expect(actValidatorAddr).equal(ZERO_ADDRESS)

    await impl.methods.setContractCloseOut("0").send({ from: buyer })
  })
})
