import { expect } from "chai";
import ethers from "hardhat";
import Web3 from "web3";
import { Lumerin, CloneFactory, Implementation } from "../../build-js/dist";
import { AdvanceBlockTime, LocalTestnetAddresses, expectIsError } from "../utils";

describe("Contract closeout", function () {
  const { lumerinAddress, cloneFactoryAddress, owner, seller, buyer } = LocalTestnetAddresses;

  const web3 = new Web3(ethers.config.networks.localhost.url);
  const cf = CloneFactory(web3, cloneFactoryAddress);
  const lumerin = Lumerin(web3, lumerinAddress);
  let fee = "";

  const price = String(1_000);
  const speed = String(1_000_000);
  const length = String(3600);

  before(async () => {
    await lumerin.methods.increaseAllowance(cloneFactoryAddress, "10000").send({ from: buyer });
    await lumerin.methods.transfer(buyer, "10000").send({ from: owner });
    await cf.methods.setAddToWhitelist(seller).send({ from: owner });
    fee = await cf.methods.marketplaceFee().call();
  });

  it("should verify closeout type 3 for 100% completion", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "0", speed, length, "0", cloneFactoryAddress, "123")
      .send({ from: seller, value: fee });
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContract(hrContractAddr, "abc", "0")
      .send({ from: buyer, value: fee });
    const sellerBalance = Number(await lumerin.methods.balanceOf(seller).call());

    await AdvanceBlockTime(web3, Number(length));

    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.setContractCloseOut("3").send({ from: seller, value: fee });

    const sellerBalanceAfter = Number(await lumerin.methods.balanceOf(seller).call());
    const deltaSellerBalance = sellerBalanceAfter - sellerBalance;

    expect(deltaSellerBalance).equal(Number(price));
  });

  it("should disallow closeout type 3 for buyer", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "3", speed, length, "0", cloneFactoryAddress, "123")
      .send({ from: seller, value: fee });
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContract(hrContractAddr, "abc", "0")
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, Number(length));

    const impl = Implementation(web3, hrContractAddr);
    try {
      await impl.methods.setContractCloseOut("3").send({ from: buyer, value: fee });
      expect.fail("should not allow closeout type 3 for buyer");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("only the seller can closeout AND withdraw after contract term");
    }
  });

  it("should reqiure fee for closeout type 3", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "3", speed, length, "0", cloneFactoryAddress, "123")
      .send({ from: seller, value: fee });
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContract(hrContractAddr, "abc", "0")
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, Number(length));

    const impl = Implementation(web3, hrContractAddr);
    try {
      await impl.methods.setContractCloseOut("3").send({ from: seller, value: 0 });
      expect.fail("should require fee");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("Insufficient ETH provided for marketplace fee");
    }
  });
});
