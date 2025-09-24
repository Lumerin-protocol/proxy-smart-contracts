import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "../fixtures-2";
import { parseEventLogs, zeroAddress } from "viem";

describe("Contract hard delete", function () {
  async function setupContractFixture() {
    const fixtureData = await loadFixture(deployLocalFixture);
    const { accounts, contracts } = fixtureData;
    const { seller, buyer, owner } = accounts;
    const { cloneFactory, usdcMock, lumerinToken } = contracts;
    const pc = await viem.getPublicClient();

    // Create a new contract for testing
    const speed = 1_000_000n; // 1 TH/s in H/s
    const length = 3600n; // 1 hour in seconds
    const profitTarget = 10;
    const pubKey = "test-pubkey-123";

    const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
      [speed, length, profitTarget, pubKey],
      { account: seller.account }
    );

    const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
    const [event] = parseEventLogs({
      logs: receipt.logs,
      abi: cloneFactory.abi,
      eventName: "contractCreated",
    });

    const hrContractAddr = event.args._address;

    return {
      ...fixtureData,
      hrContractAddr,
      speed,
      length,
      profitTarget,
      pubKey,
    };
  }

  it("should hard delete contract by seller", async function () {
    const { accounts, contracts, hrContractAddr } = await loadFixture(setupContractFixture);
    const { seller } = accounts;
    const { cloneFactory } = contracts;

    // Get initial contract list
    const initialContractList = await cloneFactory.read.getContractList();
    const initialLength = initialContractList.length;

    // Find the index of our contract
    const contractIndex = initialContractList.findIndex((addr) => addr === hrContractAddr);
    expect(contractIndex).to.not.equal(-1);

    const contractAddress = initialContractList[contractIndex];

    // Hard delete the contract
    await cloneFactory.write.contractHardDelete([BigInt(contractIndex), contractAddress], {
      account: seller.account,
    });

    // Verify contract is removed from the list
    const finalContractList = await cloneFactory.read.getContractList();
    expect(finalContractList.length).to.equal(initialLength - 1);
    expect(finalContractList).to.not.include(hrContractAddr);

    // Verify contract is marked as deleted
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const isDeleted = await impl.read.isDeleted();
    expect(isDeleted).to.equal(true);
  });

  it("should hard delete contract by owner", async function () {
    const { accounts, contracts, hrContractAddr } = await loadFixture(setupContractFixture);
    const { owner } = accounts;
    const { cloneFactory } = contracts;

    // Get initial contract list
    const initialContractList = await cloneFactory.read.getContractList();
    const initialLength = initialContractList.length;

    // Find the index of our contract
    const contractIndex = initialContractList.findIndex((addr) => addr === hrContractAddr);
    expect(contractIndex).to.not.equal(-1);

    const contractAddress = initialContractList[contractIndex];
    // Hard delete the contract as owner
    await cloneFactory.write.contractHardDelete([BigInt(contractIndex), contractAddress], {
      account: owner.account,
    });

    // Verify contract is removed from the list
    const finalContractList = await cloneFactory.read.getContractList();
    expect(finalContractList.length).to.equal(initialLength - 1);
    expect(finalContractList).to.not.include(hrContractAddr);

    // Verify contract is marked as deleted
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const isDeleted = await impl.read.isDeleted();
    expect(isDeleted).to.equal(true);
  });

  it("should prohibit hard deletion if caller is not seller or owner", async function () {
    const { accounts, contracts, hrContractAddr } = await loadFixture(setupContractFixture);
    const { buyer } = accounts;
    const { cloneFactory } = contracts;

    // Get initial contract list
    const initialContractList = await cloneFactory.read.getContractList();
    const contractIndex = initialContractList.findIndex((addr) => addr === hrContractAddr);
    expect(contractIndex).to.not.equal(-1);

    // Attempt to hard delete as buyer should fail
    const contractAddress = initialContractList[contractIndex];
    try {
      await cloneFactory.write.contractHardDelete([BigInt(contractIndex), contractAddress], {
        account: buyer.account,
      });
      expect.fail("should throw error");
    } catch (err: any) {
      expect(err.message).to.include("you are not authorized");
    }
  });

  it("should reject hard deletion with index out of bounds", async function () {
    const { accounts, contracts } = await loadFixture(setupContractFixture);
    const { seller } = accounts;
    const { cloneFactory } = contracts;

    // Get current contract list length
    const contractList = await cloneFactory.read.getContractList();
    const invalidIndex = contractList.length; // This should be out of bounds

    // Attempt to hard delete with invalid index
    try {
      await cloneFactory.write.contractHardDelete([BigInt(invalidIndex), zeroAddress], {
        account: seller.account,
      });
      expect.fail("should throw error");
    } catch (err: any) {
      expect(err.message).to.include("index out of bounds");
    }
  });

  it("should reject hard deletion if address doesn't match index", async function () {
    const { accounts, contracts } = await loadFixture(setupContractFixture);
    const { seller } = accounts;
    const { cloneFactory } = contracts;

    // Get current contract list length
    const index = 0;

    // Attempt to hard delete with invalid index
    try {
      await cloneFactory.write.contractHardDelete([BigInt(index), zeroAddress], {
        account: seller.account,
      });
      expect.fail("should throw error");
    } catch (err: any) {
      expect(err.message).to.include("contract address mismatch");
    }
  });

  it("should handle hard deletion of the last contract in the array", async function () {
    const { accounts, contracts } = await loadFixture(setupContractFixture);
    const { seller, owner } = accounts;
    const { cloneFactory } = contracts;

    // Get initial contract list
    const initialContractList = await cloneFactory.read.getContractList();
    const lastIndex = initialContractList.length - 1;
    const lastContractAddr = initialContractList[lastIndex];

    // Hard delete the last contract
    await cloneFactory.write.contractHardDelete([BigInt(lastIndex), lastContractAddr], {
      account: owner.account,
    });

    // Verify contract is removed from the list
    const finalContractList = await cloneFactory.read.getContractList();
    expect(finalContractList.length).to.equal(initialContractList.length - 1);
    expect(finalContractList).to.not.include(lastContractAddr);
  });

  it("should handle hard deletion from middle of contract array", async function () {
    const { accounts, contracts } = await loadFixture(setupContractFixture);
    const { seller } = accounts;
    const { cloneFactory } = contracts;

    // Create additional contracts to have multiple contracts
    const pc = await viem.getPublicClient();
    const additionalContracts = [];

    for (let i = 0; i < 2; i++) {
      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [1_000_000n, 3600n, 10, `pubkey-${i}`],
        { account: seller.account }
      );

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });
      additionalContracts.push(event.args._address);
    }

    // Get updated contract list
    const contractList = await cloneFactory.read.getContractList();
    const middleIndex = Math.floor(contractList.length / 2);
    const middleContractAddr = contractList[middleIndex];
    const lastContractAddr = contractList[contractList.length - 1];

    // Hard delete the middle contract
    await cloneFactory.write.contractHardDelete([BigInt(middleIndex), middleContractAddr], {
      account: seller.account,
    });

    // Verify the middle contract is removed and the last contract moved to its position
    const finalContractList = await cloneFactory.read.getContractList();
    expect(finalContractList.length).to.equal(contractList.length - 1);
    expect(finalContractList).to.not.include(middleContractAddr);
    expect(finalContractList[middleIndex]).to.equal(lastContractAddr);
  });

  it("should block purchase of hard deleted contract", async function () {
    const { accounts, contracts, hrContractAddr } = await loadFixture(setupContractFixture);
    const { seller, buyer } = accounts;
    const { cloneFactory, usdcMock, lumerinToken } = contracts;

    // Get initial contract list and hard delete
    const initialContractList = await cloneFactory.read.getContractList();
    const contractIndex = initialContractList.findIndex((addr) => addr === hrContractAddr);
    const contractAddress = initialContractList[contractIndex];

    await cloneFactory.write.contractHardDelete([BigInt(contractIndex), contractAddress], {
      account: seller.account,
    });

    // Attempt purchase should fail
    try {
      await cloneFactory.write.setPurchaseRentalContractV2(
        [hrContractAddr, buyer.account.address, "", "", 0, true, false, 0n],
        { account: buyer.account }
      );
      expect.fail("should throw error");
    } catch (err: any) {
      expect(err.message).to.include("unknown contract address");
    }
  });

  it("should maintain array integrity after multiple hard deletions", async function () {
    const { accounts, contracts } = await loadFixture(setupContractFixture);
    const { seller } = accounts;
    const { cloneFactory } = contracts;

    // Create several additional contracts
    const pc = await viem.getPublicClient();
    const createdContracts = [];

    for (let i = 0; i < 3; i++) {
      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [1_000_000n, 3600n, 10, `pubkey-${i}`],
        { account: seller.account }
      );

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });
      createdContracts.push(event.args._address);
    }

    const initialContractList = await cloneFactory.read.getContractList();
    const initialLength = initialContractList.length;

    // Hard delete contracts one by one from the beginning
    for (let i = 0; i < 2; i++) {
      const currentList = await cloneFactory.read.getContractList();
      // Always delete the first contract to test array shifting
      await cloneFactory.write.contractHardDelete([0n, currentList[0]], {
        account: seller.account,
      });
    }

    // Verify final state
    const finalContractList = await cloneFactory.read.getContractList();
    expect(finalContractList.length).to.equal(initialLength - 2);

    // Verify all remaining contracts are valid and not duplicated
    const uniqueContracts = new Set(finalContractList);
    expect(uniqueContracts.size).to.equal(finalContractList.length);
  });

  it("should handle hard deletion of purchased contract", async function () {
    const { accounts, contracts, hrContractAddr } = await loadFixture(setupContractFixture);
    const { seller, buyer, validator, owner } = accounts;
    const { cloneFactory, usdcMock, lumerinToken } = contracts;

    // Purchase the contract first
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Purchase the contract
    await cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, validator.account.address, "", "", 0, true, false, 0n],
      { account: buyer.account }
    );

    // Hard delete the purchased contract
    const contractList = await cloneFactory.read.getContractList();
    const contractIndex = contractList.findIndex((addr) => addr === hrContractAddr);
    const contractAddress = contractList[contractIndex];

    await cloneFactory.write.contractHardDelete([BigInt(contractIndex), contractAddress], {
      account: owner.account,
    });

    // Verify it's removed from the list and marked as deleted
    const finalContractList = await cloneFactory.read.getContractList();
    expect(finalContractList).to.not.include(hrContractAddr);

    const finalIsDeleted = await impl.read.isDeleted();
    expect(finalIsDeleted).to.equal(true);
  });
});
