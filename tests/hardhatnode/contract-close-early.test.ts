import { expect } from "chai";
import { expectIsError } from "../utils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { viem } from "hardhat";
import { CloseReason } from "../utils";
import { parseEventLogs } from "viem";

describe("Contract close early", function () {
  it("should disallow early closeout called second time", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Purchase contract
    const [price, validatorFee] = await impl.read.priceAndFee();
    // Approve USDC for contract payment
    await contracts.usdcMock.write.approve([contracts.cloneFactory.address, price], {
      account: buyer,
    });
    // Approve LMR for validator fee
    await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, validatorFee], {
      account: buyer,
    });

    await contracts.cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, "0x0000000000000000000000000000000000000000", "abc", "def", 0],
      { account: buyer }
    );

    await time.increase(1);

    // First close early
    await impl.write.closeEarly([0], { account: buyer });

    // Try second close early
    try {
      await impl.write.closeEarly([0], { account: buyer });
      expect.fail("should not allow closeout type 0 twice");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("the contract is not in the running state");
    }
  });

  it("should allow earlyCloseout done by buyer", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Purchase contract
    const [price, validatorFee] = await impl.read.priceAndFee();
    // Approve USDC for contract payment
    await contracts.usdcMock.write.approve([contracts.cloneFactory.address, price], {
      account: buyer,
    });
    // Approve LMR for validator fee
    await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, validatorFee], {
      account: buyer,
    });

    await contracts.cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, "0x0000000000000000000000000000000000000000", "abc", "def", 0],
      { account: buyer }
    );

    await time.increase(1);

    // Close early
    await impl.write.closeEarly([0], { account: buyer });
  });

  it("should allow earlyCloseout done by validator", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const validatorAddr = accounts.validator.account.address;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Purchase contract
    const [price, validatorFee] = await impl.read.priceAndFee();
    // Approve USDC for contract payment
    await contracts.usdcMock.write.approve([contracts.cloneFactory.address, price], {
      account: buyer,
    });
    // Approve LMR for validator fee
    await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, validatorFee], {
      account: buyer,
    });

    await contracts.cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, validatorAddr, "abc", "def", 0],
      { account: buyer }
    );

    await time.increase(1);

    // Close early by validator
    await impl.write.closeEarly([0], { account: validatorAddr });
  });

  it("should not allow earlyCloseout done by non-buyer or non-validator", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const account3 = accounts.validator2.account.address;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Purchase contract
    const [price, validatorFee] = await impl.read.priceAndFee();
    // Approve USDC for contract payment
    await contracts.usdcMock.write.approve([contracts.cloneFactory.address, BigInt(price)], {
      account: buyer,
    });
    // Approve LMR for validator fee
    await contracts.lumerinToken.write.approve(
      [contracts.cloneFactory.address, BigInt(validatorFee)],
      {
        account: buyer,
      }
    );

    await contracts.cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, "0x0000000000000000000000000000000000000000", "abc", "def", 0],
      { account: buyer }
    );

    await time.increase(1);

    try {
      await impl.write.closeEarly([0], { account: account3 });
      expect.fail("should not allow early closeout by unauthorized account");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("this account is not authorized to trigger an early closeout");
    }
  });

  it("should not allow earlyCloseout when contract is not in running state", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Purchase contract
    const [price, validatorFee] = await impl.read.priceAndFee();
    // Approve USDC for contract payment
    await contracts.usdcMock.write.approve([contracts.cloneFactory.address, BigInt(price)], {
      account: buyer,
    });
    // Approve LMR for validator fee
    await contracts.lumerinToken.write.approve(
      [contracts.cloneFactory.address, BigInt(validatorFee)],
      {
        account: buyer,
      }
    );

    await contracts.cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, "0x0000000000000000000000000000000000000000", "abc", "def", 0],
      { account: buyer }
    );

    const [, , , length] = await impl.read.terms();
    await time.increase(length);

    try {
      await impl.write.closeEarly([0], { account: buyer });
      expect.fail("should not allow early closeout when not in running state");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("the contract is not in the running state");
    }
  });

  it('should update last history entry to "bad closeout" if early closeout was called', async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Purchase contract
    const [price, validatorFee] = await impl.read.priceAndFee();
    // Approve USDC for contract payment
    await contracts.usdcMock.write.approve([contracts.cloneFactory.address, BigInt(price)], {
      account: buyer,
    });
    // Approve LMR for validator fee
    await contracts.lumerinToken.write.approve(
      [contracts.cloneFactory.address, BigInt(validatorFee)],
      {
        account: buyer,
      }
    );

    await contracts.cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, "0x0000000000000000000000000000000000000000", "abc", "def", 0],
      { account: buyer }
    );

    // Check history before closeout
    const [historyEntryBefore] = await impl.read.getHistory([0n, 1n]);
    expect(historyEntryBefore._endTime > 0n).is.true;

    // Close early
    await time.increase(1);
    await impl.write.closeEarly([0], { account: buyer });

    // Check history after closeout
    const [historyEntryAfter] = await impl.read.getHistory([0n, 1n]);
    expect(historyEntryAfter._endTime < historyEntryBefore._endTime).is.true;
  });

  it("should apply future terms", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const seller = accounts.seller.account.address;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Purchase contract
    const [price, validatorFee] = await impl.read.priceAndFee();
    // Approve USDC for contract payment
    await contracts.usdcMock.write.approve([contracts.cloneFactory.address, BigInt(price)], {
      account: buyer,
    });
    // Approve LMR for validator fee
    await contracts.lumerinToken.write.approve(
      [contracts.cloneFactory.address, BigInt(validatorFee)],
      { account: buyer }
    );

    await contracts.cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, "0x0000000000000000000000000000000000000000", "abc", "def", 0],
      { account: buyer }
    );

    // Update terms
    const terms = await impl.read.terms();
    const expTerms = {
      speed: terms[2] * 2n,
      length: terms[3] * 2n,
      version: terms[4] + 1,
      profitTarget: terms[5] * 2,
    };

    await contracts.cloneFactory.write.setUpdateContractInformationV2(
      [hrContractAddr, 0n, 0n, expTerms.speed, expTerms.length, expTerms.profitTarget],
      { account: seller }
    );

    // Close early
    await time.increase(1);
    await impl.write.closeEarly([0], { account: buyer });

    // Check terms updated
    const [, , newSpeed, newLength, newVersion, newProfitTarget] = await impl.read.terms();
    expect(newSpeed).to.equal(expTerms.speed);
    expect(newLength).to.equal(expTerms.length);
    expect(newVersion).to.equal(expTerms.version);
    expect(newProfitTarget).to.equal(expTerms.profitTarget);
  });

  it("should emit closedEarly(reason) event", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const buyer = accounts.buyer.account.address;
    const hrContractAddr = config.cloneFactory.contractAddresses[0];
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Purchase contract
    const [price, validatorFee] = await impl.read.priceAndFee();
    await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, BigInt(price)], {
      account: buyer,
    });
    await contracts.usdcMock.write.approve([contracts.cloneFactory.address, BigInt(validatorFee)], {
      account: buyer,
    });

    await contracts.cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, "0x0000000000000000000000000000000000000000", "abc", "def", 0],
      { account: buyer }
    );

    // Close early
    await time.increase(1);
    const hash = await impl.write.closeEarly([Number(CloseReason.ShareTimeout)], {
      account: buyer,
    });
    const receipt = await accounts.pc.waitForTransactionReceipt({ hash });
    const logs = receipt.logs;

    const [closedEarlyEvent] = parseEventLogs({
      abi: impl.abi,
      logs,
      eventName: "closedEarly",
    });

    expect(closedEarlyEvent).to.not.be.undefined;
    expect(closedEarlyEvent?.args._reason).to.equal(CloseReason.ShareTimeout);
  });
});
