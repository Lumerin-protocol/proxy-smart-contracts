import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { viem } from "hardhat";
import { getAddress, parseEventLogs, zeroAddress } from "viem";
import { deployLocalFixture } from "../fixtures-2";
import { mapResellTerms } from "../../mappers";

describe("Contract create", function () {
  const speed = 1_000_000n;
  const length = 3600n;
  const profitTarget = 10;
  const pubKey = "123";

  it("should create a new contract", async function () {
    const { accounts, contracts } = await loadFixture(deployLocalFixture);
    const { seller, pc } = accounts;
    const { cloneFactory } = contracts;

    // Create new rental contract (using V2 method)
    const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
      [speed, length, profitTarget, pubKey],
      { account: seller.account }
    );

    const receipt = await pc.waitForTransactionReceipt({ hash: txHash });

    // Parse contractCreated event from logs
    const [event] = parseEventLogs({
      logs: receipt.logs,
      abi: cloneFactory.abi,
      eventName: "contractCreated",
    });

    const hrContractAddr = event.args._address;

    // Get the Implementation contract instance
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    const [_speed, _length, _version] = await impl.read.terms();
    const _entry = await impl.read.resellChain([0n]);
    const entry = mapResellTerms(_entry);
    const futureTerms = await impl.read.futureTerms();
    console.log("entry", entry);

    expect(entry._resellPrice).to.equal(0n);
    expect(getAddress(entry._seller)).to.equal(getAddress(seller.account.address));
    expect(entry._startTime).to.equal(0n);
    expect(entry._account).to.equal(getAddress(seller.account.address));
    expect(entry._encrDestURL).to.equal("");
    expect(entry._encrValidatorURL).to.equal("");
    expect(entry._lastSettlementTime).to.equal(0n);
    expect(entry._resellProfitTarget).to.equal(profitTarget);
    expect(entry._isResellable).to.equal(true);
    expect(entry._isResellToDefaultBuyer).to.equal(false);
    expect(futureTerms[0]).to.equal(0n);

    expect(_speed).to.equal(speed);
    expect(_length).to.equal(length);
    expect(entry._resellProfitTarget).to.equal(profitTarget);

    // Get future terms
    expect(futureTerms).to.deep.equal([0n, 0n, 0]);
  });

  describe("Duration validation", function () {
    async function setupDurationTestFixture() {
      const fixtureData = await loadFixture(deployLocalFixture);
      const { cloneFactory } = fixtureData.contracts;
      const { owner } = fixtureData.accounts;

      // Set specific duration limits for testing
      const minDuration = 1800; // 30 minutes
      const maxDuration = 86400; // 24 hours

      await cloneFactory.write.setContractDurationInterval([minDuration, maxDuration], {
        account: owner.account,
      });

      return {
        ...fixtureData,
        minDuration: BigInt(minDuration),
        maxDuration: BigInt(maxDuration),
      };
    }

    it("should create contract with minimum duration", async function () {
      const { accounts, contracts, minDuration } = await loadFixture(setupDurationTestFixture);
      const { seller } = accounts;
      const { cloneFactory } = contracts;

      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [speed, minDuration, profitTarget, pubKey],
        { account: seller.account }
      );

      const receipt = await accounts.pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      expect(event.args._address).to.not.be.undefined;

      // Verify contract was created with correct duration
      const impl = await viem.getContractAt("Implementation", event.args._address);
      const [, length] = await impl.read.terms();
      expect(length).to.equal(minDuration);
    });

    it("should create contract with maximum duration", async function () {
      const { accounts, contracts, maxDuration } = await loadFixture(setupDurationTestFixture);
      const { seller } = accounts;
      const { cloneFactory } = contracts;

      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [speed, maxDuration, profitTarget, pubKey],
        { account: seller.account }
      );

      const receipt = await accounts.pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      expect(event.args._address).to.not.be.undefined;

      // Verify contract was created with correct duration
      const impl = await viem.getContractAt("Implementation", event.args._address);
      const [, length] = await impl.read.terms();
      expect(length).to.equal(maxDuration);
    });

    it("should create contract with valid duration within range", async function () {
      const { accounts, contracts, minDuration, maxDuration } = await loadFixture(
        setupDurationTestFixture
      );
      const { seller } = accounts;
      const { cloneFactory } = contracts;

      const validDuration = (minDuration + maxDuration) / 2n; // middle value

      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [speed, validDuration, profitTarget, pubKey],
        { account: seller.account }
      );

      const receipt = await accounts.pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      expect(event.args._address).to.not.be.undefined;

      // Verify contract was created with correct duration
      const impl = await viem.getContractAt("Implementation", event.args._address);
      const [, length] = await impl.read.terms();
      expect(length).to.equal(validDuration);
    });

    it("should reject contract creation with duration below minimum", async function () {
      const { accounts, contracts, minDuration } = await loadFixture(setupDurationTestFixture);
      const { seller } = accounts;
      const { cloneFactory } = contracts;

      const belowMinDuration = minDuration - 1n;

      try {
        await cloneFactory.write.setCreateNewRentalContractV2(
          [speed, belowMinDuration, profitTarget, pubKey],
          { account: seller.account }
        );
        expect.fail("Should have thrown an error for duration below minimum");
      } catch (error: any) {
        expect(error.message).to.include("contract duration is not within the allowed interval");
      }
    });

    it("should reject contract creation with duration above maximum", async function () {
      const { accounts, contracts, maxDuration } = await loadFixture(setupDurationTestFixture);
      const { seller } = accounts;
      const { cloneFactory } = contracts;

      const aboveMaxDuration = maxDuration + 1n;

      try {
        await cloneFactory.write.setCreateNewRentalContractV2(
          [speed, aboveMaxDuration, profitTarget, pubKey],
          { account: seller.account }
        );
        expect.fail("Should have thrown an error for duration above maximum");
      } catch (error: any) {
        expect(error.message).to.include("contract duration is not within the allowed interval");
      }
    });

    it("should reject contract creation with zero duration when minimum is non-zero", async function () {
      const { accounts, contracts } = await loadFixture(setupDurationTestFixture);
      const { seller } = accounts;
      const { cloneFactory } = contracts;

      try {
        await cloneFactory.write.setCreateNewRentalContractV2([speed, 0n, profitTarget, pubKey], {
          account: seller.account,
        });
        expect.fail("Should have thrown an error for zero duration");
      } catch (error: any) {
        expect(error.message).to.include("contract duration is not within the allowed interval");
      }
    });
  });

  describe("Parameter validation", function () {
    it("should create contract with zero speed", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller, pc } = accounts;
      const { cloneFactory } = contracts;

      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [0n, length, profitTarget, pubKey],
        { account: seller.account }
      );

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      const impl = await viem.getContractAt("Implementation", event.args._address);
      const [speed] = await impl.read.terms();
      expect(speed).to.equal(0n);
    });

    it("should create contract with negative profit target", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller, pc } = accounts;
      const { cloneFactory } = contracts;

      const negativeProfitTarget = -10;

      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [speed, length, negativeProfitTarget, pubKey],
        { account: seller.account }
      );

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      const impl = await viem.getContractAt("Implementation", event.args._address);
      const { _resellProfitTarget } = await impl.read.resellChain([0n]).then(mapResellTerms);
      expect(_resellProfitTarget).to.equal(negativeProfitTarget);
    });

    it("should create contract with large speed value", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller, pc } = accounts;
      const { cloneFactory } = contracts;

      // Use a large but reasonable speed value (1 ZH/s = 10^21 H/s)
      const largeSpeed = 1n * 10n ** 21n;

      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [largeSpeed, length, profitTarget, pubKey],
        { account: seller.account }
      );

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      const impl = await viem.getContractAt("Implementation", event.args._address);
      const [speed] = await impl.read.terms();
      expect(speed).to.equal(largeSpeed);
    });
  });

  describe("Update contract duration validation", function () {
    async function setupUpdateTestFixture() {
      const fixtureData = await loadFixture(deployLocalFixture);
      const { cloneFactory } = fixtureData.contracts;
      const { owner, seller, pc } = fixtureData.accounts;

      // Set specific duration limits for testing
      const minDuration = 1800; // 30 minutes
      const maxDuration = 86400; // 24 hours

      await cloneFactory.write.setContractDurationInterval([minDuration, maxDuration], {
        account: owner.account,
      });

      // Create a contract to update
      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [speed, BigInt(minDuration), profitTarget, pubKey],
        { account: seller.account }
      );

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      return {
        ...fixtureData,
        contractAddress: event.args._address,
        minDuration: BigInt(minDuration),
        maxDuration: BigInt(maxDuration),
      };
    }

    it("should successfully update contract with valid duration", async function () {
      const { accounts, contracts, contractAddress, minDuration, maxDuration } = await loadFixture(
        setupUpdateTestFixture
      );
      const { seller } = accounts;
      const { cloneFactory } = contracts;
      const speed = 1n;

      const validDuration = (minDuration + maxDuration) / 2n;

      await cloneFactory.write.setUpdateContractInformationV2(
        [contractAddress, speed * 2n, validDuration],
        { account: seller.account }
      );

      const impl = await viem.getContractAt("Implementation", contractAddress);
      const [_speed, _length] = await impl.read.terms();
      expect(_length).to.equal(validDuration);
      expect(_speed).to.equal(speed * 2n);
    });

    it("should reject update with duration below minimum", async function () {
      const { accounts, contracts, contractAddress, minDuration } = await loadFixture(
        setupUpdateTestFixture
      );
      const { seller } = accounts;
      const { cloneFactory } = contracts;

      const belowMinDuration = minDuration - 1n;

      try {
        await cloneFactory.write.setUpdateContractInformationV2(
          [contractAddress, speed, belowMinDuration],
          { account: seller.account }
        );
        expect.fail("Should have thrown an error for duration below minimum");
      } catch (error: any) {
        expect(error.message).to.include("contract duration is not within the allowed interval");
      }
    });

    it("should reject update with duration above maximum", async function () {
      const { accounts, contracts, contractAddress, maxDuration } = await loadFixture(
        setupUpdateTestFixture
      );
      const { seller } = accounts;
      const { cloneFactory } = contracts;

      const aboveMaxDuration = maxDuration + 1n;

      try {
        await cloneFactory.write.setUpdateContractInformationV2(
          [contractAddress, speed, aboveMaxDuration],
          { account: seller.account }
        );
        expect.fail("Should have thrown an error for duration above maximum");
      } catch (error: any) {
        expect(error.message).to.include("contract duration is not within the allowed interval");
      }
    });
  });

  describe("Contract state and events", function () {
    it("should emit contractCreated event with correct parameters", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller, pc } = accounts;
      const { cloneFactory } = contracts;

      const customPubKey = "custom-test-pubkey-123";

      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [speed, length, profitTarget, customPubKey],
        { account: seller.account }
      );

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      expect(event.args._pubkey).to.equal(customPubKey);
      expect(event.args._address).to.not.be.undefined;
      expect(event.args._address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should add contract to contract list", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller } = accounts;
      const { cloneFactory } = contracts;

      const contractListBefore = await cloneFactory.read.getContractList();
      const initialLength = contractListBefore.length;

      const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
        [speed, length, profitTarget, pubKey],
        { account: seller.account }
      );

      const receipt = await accounts.pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      const contractListAfter = await cloneFactory.read.getContractList();
      expect(contractListAfter.length).to.equal(initialLength + 1);
      expect(contractListAfter[contractListAfter.length - 1]).to.equal(event.args._address);
    });

    it("should initialize contract in Available state", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller, pc } = accounts;
      const { cloneFactory } = contracts;

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

      const impl = await viem.getContractAt("Implementation", event.args._address);
      const state = await impl.read.contractState();
      expect(state).to.equal(0); // ContractState.Available
    });
  });
});
