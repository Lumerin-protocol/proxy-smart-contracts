import { expect } from "chai";
import { expectIsError } from "../utils";
import { testEarlyCloseout } from "../actions";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { viem } from "hardhat";

describe("Validator fee", function () {
  for (const progress of [0, 0.01, 0.1, 0.5, 0.75]) {
    it(`should verify balances after ${progress * 100}% early closeout`, async function () {
      const { accounts, contracts, config } = await loadFixture(deployLocalFixture);

      await testEarlyCloseout(
        progress,
        config.cloneFactory.contractAddresses[0],
        accounts.buyer.account.address,
        accounts.validator.account.address,
        contracts.cloneFactory.address,
        contracts.usdcMock.address,
        contracts.lumerinToken.address
      );
    });
  }

  it("should fail early closeout when progress of the contract is 100%", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const progress = 1;

    try {
      await testEarlyCloseout(
        progress,
        config.cloneFactory.contractAddresses[0],
        accounts.buyer.account.address,
        accounts.validator.account.address,
        contracts.cloneFactory.address,
        contracts.usdcMock.address,
        contracts.lumerinToken.address
      );
      expect.fail("should not allow early closeout when progress is 100%");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("the contract is not in the running state");
    }
  });

  it("claimFundsValidator - should collect validator fee after contract is auto-closed", async function () {
    const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const validatorAddr = accounts.validator.account.address;
    const sellerAddr = accounts.seller.account.address;

    const cf = contracts.cloneFactory;
    const feeToken = contracts.lumerinToken;
    const paymentToken = contracts.usdcMock;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    const hrContractData = await impl.read.getPublicVariablesV2();
    const [price, validatorFee] = await impl.read.priceAndFee();

    await paymentToken.write.approve([cf.address, BigInt(price)], {
      account: buyer,
    });
    await feeToken.write.approve([cf.address, BigInt(validatorFee)], {
      account: buyer,
    });

    await cf.write.setPurchaseRentalContractV2(
      [hrContractAddr, validatorAddr, "encryptedValidatorURL", "encryptedDestURL", 0],
      { account: buyer }
    );

    await time.increase(Number(hrContractData[1]._length));

    // make sure the contract is auto-closed
    const hrContractData2 = await impl.read.getPublicVariablesV2();
    expect(hrContractData2[0]).to.equal(0); // ContractState.Available = 0

    // claim funds by validator
    const validatorBalanceBefore = await feeToken.read.balanceOf([validatorAddr]);
    const sellerBalanceBefore = await paymentToken.read.balanceOf([sellerAddr]);

    await impl.write.claimFunds({ account: sellerAddr });

    const validatorBalanceAfter = await feeToken.read.balanceOf([validatorAddr]);
    const sellerBalanceAfter = await paymentToken.read.balanceOf([sellerAddr]);
    const deltaValidatorBalance = validatorBalanceAfter - validatorBalanceBefore;
    const deltaSellerBalance = sellerBalanceAfter - sellerBalanceBefore;

    expect(deltaValidatorBalance).to.equal(validatorFee);
    expect(deltaSellerBalance).to.equal(price);

    // check lmr balance of the contract
    const contractBalance = await paymentToken.read.balanceOf([hrContractAddr]);
    expect(contractBalance).to.equal(0n);

    // check fee token balance of the contract
    const contractFeeBalance = await feeToken.read.balanceOf([hrContractAddr]);
    expect(contractFeeBalance).to.equal(0n);
  });

  it("should auto claim validator fee on the next purchase", async function () {
    const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const validatorAddr = accounts.validator.account.address;

    const cf = contracts.cloneFactory;
    const paymentToken = contracts.usdcMock;
    const feeToken = contracts.lumerinToken;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    const hrContractData = await impl.read.getPublicVariablesV2();
    const [price, validatorFee] = await impl.read.priceAndFee();

    // PURCHASE 1
    await paymentToken.write.approve([cf.address, BigInt(price)], {
      account: buyer,
    });
    await feeToken.write.approve([cf.address, BigInt(validatorFee)], {
      account: buyer,
    });

    await cf.write.setPurchaseRentalContractV2(
      [hrContractAddr, validatorAddr, "encryptedValidatorURL", "encryptedDestURL", 0],
      { account: buyer }
    );

    await time.increase(Number(hrContractData[1]._length));

    // make sure the contract is auto-closed
    const hrContractData2 = await impl.read.getPublicVariablesV2();
    expect(hrContractData2[0]).to.equal(0); // ContractState.Available = 0

    // PURCHASE 2
    const validatorBalanceBefore = await feeToken.read.balanceOf([validatorAddr]);

    await paymentToken.write.approve([cf.address, BigInt(price)], {
      account: buyer,
    });
    await feeToken.write.approve([cf.address, BigInt(validatorFee)], {
      account: buyer,
    });

    await cf.write.setPurchaseRentalContractV2(
      [hrContractAddr, validatorAddr, "encryptedValidatorURL", "encryptedDestURL", 0],
      { account: buyer }
    );

    const validatorBalanceAfter = await feeToken.read.balanceOf([validatorAddr]);
    const deltaValidatorBalance = validatorBalanceAfter - validatorBalanceBefore;

    // should claim the validator fee only for first purchase
    expect(deltaValidatorBalance).to.equal(validatorFee);
  });

  it("claimFundsValidator - should error if no funds or address is wrong", async function () {
    const { config, accounts } = await loadFixture(deployLocalFixture);
    const validatorAddr = accounts.validator.account.address;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    try {
      await impl.write.claimFundsValidator({ account: validatorAddr });
      expect.fail("should not allow to claim funds if no funds");
    } catch (err) {
      expectIsError(err);
      console.log(err.message);
      expect(err.message).includes("no funds to withdraw");
    }
  });

  it("claimFundsValidator - should correctly claim for multiple contracts", async function () {
    const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const validatorAddr = accounts.validator.account.address;
    const validator2Addr = accounts.validator2.account.address;

    const cf = contracts.cloneFactory;
    const paymentToken = contracts.usdcMock;
    const feeToken = contracts.lumerinToken;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    const hrContractData = await impl.read.getPublicVariablesV2();
    const [price, validatorFee] = await impl.read.priceAndFee();

    // purchase 1 with validator 1
    await paymentToken.write.approve([cf.address, BigInt(price)], {
      account: buyer,
    });
    await feeToken.write.approve([cf.address, BigInt(validatorFee)], {
      account: buyer,
    });

    await cf.write.setPurchaseRentalContractV2(
      [hrContractAddr, validatorAddr, "encryptedValidatorURL", "encryptedDestURL", 0],
      { account: buyer }
    );

    // wait for completion
    await time.increase(Number(hrContractData[1]._length));

    // claim funds by validator 1
    const validatorBalanceBefore = await feeToken.read.balanceOf([validatorAddr]);
    await impl.write.claimFundsValidator({ account: validatorAddr });
    const validatorBalanceAfter = await feeToken.read.balanceOf([validatorAddr]);
    const deltaValidatorBalance = validatorBalanceAfter - validatorBalanceBefore;
    expect(deltaValidatorBalance).to.equal(validatorFee);

    // purchase 2 with validator 2
    await paymentToken.write.approve([cf.address, BigInt(price)], {
      account: buyer,
    });
    await feeToken.write.approve([cf.address, BigInt(validatorFee)], {
      account: buyer,
    });

    await cf.write.setPurchaseRentalContractV2(
      [hrContractAddr, validator2Addr, "encryptedValidatorURL", "encryptedDestURL", 0],
      { account: buyer }
    );

    // wait for completion
    await time.increase(Number(hrContractData[1]._length));

    // claim funds by validator 2
    const validator2BalanceBefore = await feeToken.read.balanceOf([validator2Addr]);
    await impl.write.claimFundsValidator({ account: validator2Addr });
    const validator2BalanceAfter = await feeToken.read.balanceOf([validator2Addr]);
    const deltaValidator2Balance = validator2BalanceAfter - validator2BalanceBefore;
    expect(deltaValidator2Balance).to.equal(validatorFee);
  });
});
