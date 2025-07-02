import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { parseEventLogs } from "viem";

describe("Contract delete", function () {
  it("should create contract and check its status", async function () {
    const { config } = await loadFixture(deployLocalFixture);
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;

    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [
      state,
      terms,
      startingBlockTimestamp,
      buyerAddr,
      sellerAddr,
      encryptedPoolData,
      isDeleted,
    ] = await impl.read.getPublicVariablesV2();

    expect(isDeleted).equal(false);
  });

  it("should prohibit deletion if caller is not a seller", async function () {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const { cloneFactory } = contracts;
    const { buyer } = accounts;
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;

    try {
      await cloneFactory.write.setContractsDeleted([[hrContractAddr], true], {
        account: buyer.account,
      });
      expect.fail("should throw error");
    } catch (err: any) {
      expect(err.message).to.include("you are not authorized");
    }
  });

  it("should delete contract and emit event", async function () {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const { cloneFactory } = contracts;
    const { seller } = accounts;
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;
    const pc = await viem.getPublicClient();

    const hash = await cloneFactory.write.setContractsDeleted([[hrContractAddr], true], {
      account: seller.account,
    });

    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [
      state,
      terms,
      startingBlockTimestamp,
      buyerAddr,
      sellerAddr,
      encryptedPoolData,
      isDeleted,
    ] = await impl.read.getPublicVariablesV2();

    expect(isDeleted).equal(true);

    // Check for event emission
    const receipt = await pc.waitForTransactionReceipt({ hash });
    const events = parseEventLogs({
      logs: receipt.logs,
      abi: cloneFactory.abi,
      eventName: "contractDeleteUpdated",
    });

    const deleteEvent = events.find(
      (e) => e.args._address === hrContractAddr && e.args._isDeleted === true
    );

    expect(deleteEvent).not.to.be.undefined;
  });

  it("should error on second attempt to delete", async function () {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const { cloneFactory } = contracts;
    const { seller } = accounts;
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;

    // First deletion
    await cloneFactory.write.setContractsDeleted([[hrContractAddr], true], {
      account: seller.account,
    });

    // Second deletion should work (no error for duplicate state)
    await cloneFactory.write.setContractsDeleted([[hrContractAddr], true], {
      account: seller.account,
    });
  });

  it("should block purchase if contract deleted", async function () {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const { cloneFactory, usdcMock, lumerinToken } = contracts;
    const { seller, buyer } = accounts;
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;

    // Delete the contract first
    await cloneFactory.write.setContractsDeleted([[hrContractAddr], true], {
      account: seller.account,
    });

    // Get contract terms for approvals
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [, terms] = await impl.read.getPublicVariablesV2();

    // Approve tokens
    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    // Attempt purchase should fail
    try {
      await cloneFactory.write.setPurchaseRentalContractV2(
        [hrContractAddr, buyer.account.address, "", "", terms._version],
        { account: buyer.account }
      );
      expect.fail("should throw error");
    } catch (err: any) {
      expect(err.message).to.include("cannot purchase deleted contract");
    }
  });

  it("should undelete contract and emit event", async function () {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const { cloneFactory } = contracts;
    const { seller } = accounts;
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;
    const pc = await viem.getPublicClient();

    // Delete first
    await cloneFactory.write.setContractsDeleted([[hrContractAddr], true], {
      account: seller.account,
    });

    // Then undelete
    const hash = await cloneFactory.write.setContractsDeleted([[hrContractAddr], false], {
      account: seller.account,
    });

    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [
      state,
      terms,
      startingBlockTimestamp,
      buyerAddr,
      sellerAddr,
      encryptedPoolData,
      isDeleted,
    ] = await impl.read.getPublicVariablesV2();

    expect(isDeleted).equal(false);

    // Check for event emission
    const receipt = await pc.waitForTransactionReceipt({ hash });
    const events = parseEventLogs({
      logs: receipt.logs,
      abi: cloneFactory.abi,
      eventName: "contractDeleteUpdated",
    });

    const undeleteEvent = events.find(
      (e) => e.args._address === hrContractAddr && e.args._isDeleted === false
    );

    expect(undeleteEvent).not.to.be.undefined;
  });

  it("should allow purchase if contract undeleted", async function () {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const { cloneFactory, usdcMock, lumerinToken } = contracts;
    const { seller, buyer } = accounts;
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;

    // Delete and then undelete
    await cloneFactory.write.setContractsDeleted([[hrContractAddr], true], {
      account: seller.account,
    });
    await cloneFactory.write.setContractsDeleted([[hrContractAddr], false], {
      account: seller.account,
    });

    // Get contract terms for approvals
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [state, terms] = await impl.read.getPublicVariablesV2();

    // Approve tokens
    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    // Purchase should succeed
    await cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, buyer.account.address, "", "", terms._version],
      { account: buyer.account }
    );
  });

  it("should allow delete contract if contract is purchased", async function () {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const { cloneFactory, usdcMock, lumerinToken } = contracts;
    const { seller, buyer } = accounts;
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;

    // Purchase the contract first
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [state, terms] = await impl.read.getPublicVariablesV2();

    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    await cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, buyer.account.address, "", "", terms._version],
      { account: buyer.account }
    );

    // Then delete it
    await cloneFactory.write.setContractsDeleted([[hrContractAddr], true], {
      account: seller.account,
    });

    const [
      finalState,
      finalTerms,
      finalStartingBlockTimestamp,
      finalBuyerAddr,
      finalSellerAddr,
      finalEncryptedPoolData,
      finalIsDeleted,
    ] = await impl.read.getPublicVariablesV2();
    expect(finalIsDeleted).equal(true);
  });

  it("should prohibit deletion on the contract instance", async function () {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const { cloneFactory } = contracts;
    const { seller } = accounts;
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;

    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    try {
      await impl.write.setContractDeleted([true], { account: seller.account });
      expect.fail("should throw error");
    } catch (err: any) {
      expect(err.message).to.include("only clonefactory can call this function");
    }
  });

  it("should prohibit deletion from clonefactory owner on contract instance", async function () {
    const { config, accounts } = await loadFixture(deployLocalFixture);
    const { owner } = accounts;
    const [, , hrContractAddr] = config.cloneFactory.contractAddresses;

    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    try {
      await impl.write.setContractDeleted([true], { account: owner.account });
      expect.fail("should throw error");
    } catch (err: any) {
      expect(err.message).to.include("only clonefactory can call this function");
    }
  });
});
