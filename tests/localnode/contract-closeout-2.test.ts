import { expect } from "chai";
import ethers from "hardhat";
import Web3 from "web3";
import { Lumerin, CloneFactory, Implementation } from "../../build-js/dist";
import { AdvanceBlockTime, LocalTestnetAddresses, ZERO_ADDRESS } from "../utils";

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

  it("should verify closeout type 2 for 100% completion", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "0", speed, length, "0", ZERO_ADDRESS, "123")
      .send({ from: seller, value: fee });
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContract(hrContractAddr, "abc", "0")
      .send({ from: buyer, value: fee });
    const sellerBalance = Number(await lumerin.methods.balanceOf(seller).call());

    await AdvanceBlockTime(web3, Number(length));

    // close by seller after expiration without claim (2)
    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.setContractCloseOut("2").send({ from: seller, value: fee });

    // claim to verify funds are released
    await impl.methods.setContractCloseOut("1").send({ from: seller, value: fee });
    const sellerBalanceAfterClaim = Number(await lumerin.methods.balanceOf(seller).call());
    const deltaSellerBalanceClaim = sellerBalanceAfterClaim - sellerBalance;
    expect(deltaSellerBalanceClaim).equal(Number(price), "seller should collect 100% of the price");
  });

  it("should not reqiure fee for closeout type 2", async function () {
    const receipt = await cf.methods
      .setCreateNewRentalContractV2(price, "3", speed, length, "0", cloneFactoryAddress, "123")
      .send({ from: seller, value: fee });
    const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

    await cf.methods
      .setPurchaseRentalContract(hrContractAddr, "abc", "0")
      .send({ from: buyer, value: fee });
    await AdvanceBlockTime(web3, Number(length));

    const impl = Implementation(web3, hrContractAddr);
    await impl.methods.setContractCloseOut("2").send({ from: seller, value: 0 });
  });
});
