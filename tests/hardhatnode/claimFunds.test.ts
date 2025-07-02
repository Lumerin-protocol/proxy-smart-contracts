import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { expect } from "chai";
import { viem } from "hardhat";
import { getTxDeltaBalance } from "../lib";

describe("Claim funds", function () {
  it("should claim half of the funds after half of the contract duration", async function () {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const [contractAddr] = config.cloneFactory.contractAddresses;
    const { seller, buyer, validator } = accounts;
    const { cloneFactory, usdcMock, lumerinToken } = contracts;

    const impl = await viem.getContractAt("Implementation", contractAddr);
    const pc = await viem.getPublicClient();

    // purchase contract
    const [, terms] = await impl.read.getPublicVariablesV2();
    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });
    await cloneFactory.write.setPurchaseRentalContractV2(
      [contractAddr, validator.account.address, "encryptedValidatorURL", "encryptedDestURL", 0],
      { account: buyer.account }
    );

    // wait til half of the contract duration
    await time.increase(terms._length / 2n);

    // check that seller has received half of the price
    const txhash2 = await impl.write.claimFunds({ account: seller.account });
    const sellerBalanceDelta = await getTxDeltaBalance(
      pc,
      txhash2,
      seller.account.address,
      usdcMock
    );
    expect(Number(sellerBalanceDelta)).to.be.approximately(Number(terms._price / 2n), 100);

    // check that validator has received half of the fee
    const validatorBalanceDelta = await getTxDeltaBalance(
      pc,
      txhash2,
      validator.account.address,
      lumerinToken
    );
    expect(Number(validatorBalanceDelta)).to.be.approximately(Number(terms._fee / 2n), 100);

    // check that contract balance is half of the price
    const contractBalanceDelta = await getTxDeltaBalance(pc, txhash2, contractAddr, usdcMock);
    expect(-Number(contractBalanceDelta)).to.be.approximately(Number(terms._price / 2n), 100);

    // check that contract balance is half of the fee
    const contractBalanceDelta2 = await getTxDeltaBalance(pc, txhash2, contractAddr, lumerinToken);
    expect(-Number(contractBalanceDelta2)).to.be.approximately(Number(terms._fee / 2n), 100);

    // wait till full completion
    await time.increase(terms._length);

    // claim the remaining funds
    const txhash3 = await impl.write.claimFunds({ account: seller.account });

    // check that seller has received half of the price
    const delta2 = await getTxDeltaBalance(pc, txhash3, seller.account.address, usdcMock);
    expect(Number(delta2)).to.be.approximately(Number(terms._price / 2n), 100);

    // check that validator has received half of the fee
    const validatorBalanceDelta2 = await getTxDeltaBalance(
      pc,
      txhash3,
      validator.account.address,
      lumerinToken
    );
    expect(Number(validatorBalanceDelta2)).to.be.approximately(Number(terms._fee / 2n), 100);

    // check contract balances are 0
    const contractBalance = await usdcMock.read.balanceOf([contractAddr]);
    expect(contractBalance).to.be.equal(0n);

    const contractBalance2 = await lumerinToken.read.balanceOf([contractAddr]);
    expect(contractBalance2).to.be.equal(0n);
  });
});
