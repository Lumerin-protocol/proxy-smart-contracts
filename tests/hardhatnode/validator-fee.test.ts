import { expect } from "chai";
import { LocalTestnetAddresses, expectIsError } from "../utils";
import { testEarlyCloseout } from "../actions";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployAllFixture } from "./fixtures";
import { CloneFactory, Implementation, Lumerin } from "../../build-js/src";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// These tests expect written for hardhat network
// e.g. `yarn hardhat --network hardhat test tests/validator-fee.test.ts`
describe("Validator fee", function () {
  const { buyer, validatorAddr } = LocalTestnetAddresses;

  for (const progress of [0, 0.01, 0.1, 0.5, 0.75]) {
    it(`should verify balances after ${progress * 100}% early closeout`, async function () {
      const data = await loadFixture(deployAllFixture);

      await testEarlyCloseout(
        progress,
        data.fee,
        data.cfg.sellerAddr,
        buyer,
        validatorAddr,
        data.cloneFactoryAddr,
        data.lumerinTokenAddr,
        data.web3
      );
    });
  }

  it("should fail early closeout when progress of the contract is 100%", async function () {
    const data = await loadFixture(deployAllFixture);
    const progress = 1;

    try {
      await testEarlyCloseout(
        progress,
        data.fee,
        data.cfg.sellerAddr,
        buyer,
        validatorAddr,
        data.cloneFactoryAddr,
        data.lumerinTokenAddr,
        data.web3
      );
      expect.fail("should not allow early closeout when progress is 100%");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("the contract is not in the running state");
    }
  });

  it("claimFundsValidator - should collect validator fee after contract is auto-closed", async function () {
    const { web3, cloneFactoryAddr, lumerinTokenAddr, hrContracts, cfg } = await loadFixture(
      deployAllFixture
    );
    const { buyer, validatorAddr } = LocalTestnetAddresses;

    const cf = CloneFactory(web3, cloneFactoryAddr);
    const lmr = Lumerin(web3, lumerinTokenAddr);
    const hrContractAddr = hrContracts[0];
    const hrContractData = await Implementation(web3, hrContractAddr)
      .methods.getPublicVariablesV2()
      .call();

    const validatorFee = Math.round(Number(hrContractData._terms._price) * cfg.validatorFeeRate);
    const priceWithValidatorFee = Number(hrContractData._terms._price) + validatorFee;
    await lmr.methods
      .approve(cloneFactoryAddr, String(priceWithValidatorFee))
      .send({ from: buyer });
    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "encryptedValidatorURL",
        "encryptedDestURL",
        0
      )
      .send({ from: buyer, value: cfg.marketplaceFee.toString() });

    await time.increase(Number(hrContractData._terms._length));

    // make sure the contract is auto-closed
    const impl = Implementation(web3, hrContractAddr);
    const hrContractData2 = await impl.methods.getPublicVariablesV2().call();
    expect(hrContractData2._state).to.equal("0");

    // claim funds by seller
    const sellerBalanceBefore = Number(await lmr.methods.balanceOf(cfg.sellerAddr).call());
    await impl.methods
      .claimFunds()
      .send({ from: cfg.sellerAddr, value: cfg.marketplaceFee.toString() });
    const sellerBalanceAfter = Number(await lmr.methods.balanceOf(cfg.sellerAddr).call());
    const deltaSellerBalance = sellerBalanceAfter - sellerBalanceBefore;
    expect(deltaSellerBalance).to.equal(Number(hrContractData._terms._price));

    // claim funds by validator
    const validatorBalanceBefore = Number(await lmr.methods.balanceOf(validatorAddr).call());
    await impl.methods.claimFundsValidator().send({ from: validatorAddr });
    const validatorBalanceAfter = Number(await lmr.methods.balanceOf(validatorAddr).call());
    const deltaValidatorBalance = validatorBalanceAfter - validatorBalanceBefore;
    expect(deltaValidatorBalance).to.equal(validatorFee);

    // check lmr balance of the contract
    const contractBalance = Number(await lmr.methods.balanceOf(hrContractAddr).call());
    expect(contractBalance).to.equal(0);
  });

  it("claimFundsValidator - should not withdraw validator fee for ongoing contracts", async function () {
    const { web3, cloneFactoryAddr, lumerinTokenAddr, hrContracts, cfg } = await loadFixture(
      deployAllFixture
    );
    const { buyer, validatorAddr } = LocalTestnetAddresses;

    const cf = CloneFactory(web3, cloneFactoryAddr);
    const lmr = Lumerin(web3, lumerinTokenAddr);
    const hrContractAddr = hrContracts[0];
    const hrContractData = await Implementation(web3, hrContractAddr)
      .methods.getPublicVariablesV2()
      .call();

    const validatorFee = Math.round(Number(hrContractData._terms._price) * cfg.validatorFeeRate);
    const priceWithValidatorFee = Number(hrContractData._terms._price) + validatorFee;

    // PURCHASE 1
    await lmr.methods
      .approve(cloneFactoryAddr, String(priceWithValidatorFee))
      .send({ from: buyer });
    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "encryptedValidatorURL",
        "encryptedDestURL",
        0
      )
      .send({ from: buyer, value: cfg.marketplaceFee.toString() });

    await time.increase(Number(hrContractData._terms._length));

    // make sure the contract is auto-closed
    const impl = Implementation(web3, hrContractAddr);
    const hrContractData2 = await impl.methods.getPublicVariablesV2().call();
    expect(hrContractData2._state).to.equal("0");

    // PURCHASE 2
    await lmr.methods
      .approve(cloneFactoryAddr, String(priceWithValidatorFee))
      .send({ from: buyer });
    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "encryptedValidatorURL",
        "encryptedDestURL",
        0
      )
      .send({ from: buyer, value: cfg.marketplaceFee.toString() });

    // claim funds by validator
    const validatorBalanceBefore = Number(await lmr.methods.balanceOf(validatorAddr).call());
    await impl.methods.claimFundsValidator().send({ from: validatorAddr });
    const validatorBalanceAfter = Number(await lmr.methods.balanceOf(validatorAddr).call());
    const deltaValidatorBalance = validatorBalanceAfter - validatorBalanceBefore;

    // should claim the validator fee only for first purchase
    expect(deltaValidatorBalance).to.equal(validatorFee);
  });

  it("claimFundsValidator - should error if no funds or address is wrong", async function () {
    const { web3, hrContracts } = await loadFixture(deployAllFixture);
    const { validatorAddr } = LocalTestnetAddresses;
    const hrContractAddr = hrContracts[0];

    try {
      await Implementation(web3, hrContractAddr)
        .methods.claimFundsValidator()
        .send({ from: validatorAddr });
      expect.fail("should not allow to claim funds if no funds");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("no funds to withdraw");
    }
  });

  it("claimFundsValidator - should account for multiple validators", async function () {
    const { web3, cloneFactoryAddr, lumerinTokenAddr, hrContracts, cfg } = await loadFixture(
      deployAllFixture
    );
    const { buyer, validatorAddr, validator2Addr } = LocalTestnetAddresses;

    const cf = CloneFactory(web3, cloneFactoryAddr);
    const lmr = Lumerin(web3, lumerinTokenAddr);
    const hrContractAddr = hrContracts[0];
    const hrContractData = await Implementation(web3, hrContractAddr)
      .methods.getPublicVariablesV2()
      .call();

    const validatorFee = Math.round(Number(hrContractData._terms._price) * cfg.validatorFeeRate);
    const priceWithValidatorFee = Number(hrContractData._terms._price) + validatorFee;

    // purchase 1 with validator 1
    await lmr.methods
      .approve(cloneFactoryAddr, String(priceWithValidatorFee))
      .send({ from: buyer });
    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validatorAddr,
        "encryptedValidatorURL",
        "encryptedDestURL",
        0
      )
      .send({ from: buyer, value: cfg.marketplaceFee.toString() });

    // wait for completion
    await time.increase(Number(hrContractData._terms._length));

    // purchase 2 with validator 2
    await lmr.methods
      .approve(cloneFactoryAddr, String(priceWithValidatorFee))
      .send({ from: buyer });
    await cf.methods
      .setPurchaseRentalContractV2(
        hrContractAddr,
        validator2Addr,
        "encryptedValidatorURL",
        "encryptedDestURL",
        0
      )
      .send({ from: buyer, value: cfg.marketplaceFee.toString() });

    // wait for completion
    await time.increase(Number(hrContractData._terms._length));

    // claim funds by validator 1
    const validatorBalanceBefore = Number(await lmr.methods.balanceOf(validatorAddr).call());
    await Implementation(web3, hrContractAddr)
      .methods.claimFundsValidator()
      .send({ from: validatorAddr });
    const validatorBalanceAfter = Number(await lmr.methods.balanceOf(validatorAddr).call());
    const deltaValidatorBalance = validatorBalanceAfter - validatorBalanceBefore;
    expect(deltaValidatorBalance).to.equal(validatorFee);

    // claim funds by validator 2
    const validator2BalanceBefore = Number(await lmr.methods.balanceOf(validator2Addr).call());
    await Implementation(web3, hrContractAddr)
      .methods.claimFundsValidator()
      .send({ from: validator2Addr });
    const validator2BalanceAfter = Number(await lmr.methods.balanceOf(validator2Addr).call());
    const deltaValidator2Balance = validator2BalanceAfter - validator2BalanceBefore;
    expect(deltaValidator2Balance).to.equal(validatorFee);
  });
});
