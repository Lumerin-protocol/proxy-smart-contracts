import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { getAddress, parseEventLogs, parseUnits } from "viem";
import { catchError } from "../lib";
import { ZERO_ADDRESS } from "../utils";
import { viem } from "hardhat";

describe("Hashrate oracle", function () {
  it("should initialize with correct values", async function () {
    const hashrateOracle = await viem.deployContract("HashrateOracle", [ZERO_ADDRESS]);

    // Check initial values
    expect(await hashrateOracle.read.getDifficulty()).to.equal(0n);
    expect(await hashrateOracle.read.getBlockReward()).to.equal(0n);
  });

  it("should allow owner to set difficulty", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;

    // Set difficulty
    const difficulty = 1000n;
    await hashrateOracle.write.setDifficulty([difficulty], { account: owner.account });
    expect(await hashrateOracle.read.getDifficulty()).to.equal(difficulty);
  });

  it("should allow owner to set block reward and difficulty", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;

    // Set block reward
    const blockReward = parseUnits("6.25", 8);
    await hashrateOracle.write.setBlockReward([blockReward], { account: owner.account });
    expect(await hashrateOracle.read.getBlockReward()).to.equal(blockReward);

    // Set difficulty
    const difficulty = 1000n;
    await hashrateOracle.write.setDifficulty([difficulty], { account: owner.account });
    expect(await hashrateOracle.read.getDifficulty()).to.equal(difficulty);
  });

  it("should not allow non-owner to set difficulty", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const nonOwner = accounts.buyer;

    // Try to set difficulty as non-owner
    await catchError(contracts.hashrateOracle.abi, "OwnableUnauthorizedAccount", async () => {
      await hashrateOracle.write.setDifficulty([1000n], { account: nonOwner.account });
    });

    // Try to set block reward as non-owner
    await catchError(contracts.hashrateOracle.abi, "OwnableUnauthorizedAccount", async () => {
      await hashrateOracle.write.setBlockReward([parseUnits("6.25", 8)], {
        account: nonOwner.account,
      });
    });
  });

  it("should not allow setting zero difficulty", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;

    // Try to set zero difficulty
    await catchError(contracts.hashrateOracle.abi, "ValueCannotBeZero", async () => {
      await hashrateOracle.write.setDifficulty([0n], { account: owner.account });
    });
  });

  it("should not allow setting zero block reward", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;

    // Try to set zero block reward
    await catchError(contracts.hashrateOracle.abi, "ValueCannotBeZero", async () => {
      await hashrateOracle.write.setBlockReward([0n], { account: owner.account });
    });
  });

  it("should calculate correct reward per TH in BTC", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;

    // Set test values
    const difficulty = 1000000000000n; // 1T difficulty
    const blockReward = parseUnits("6.25", 8); // 6.25 BTC in satoshis
    await hashrateOracle.write.setDifficulty([difficulty], { account: owner.account });
    await hashrateOracle.write.setBlockReward([blockReward], { account: owner.account });

    // Calculate expected reward per TH
    const expectedReward = (blockReward * BigInt(10 ** 12)) / (difficulty * BigInt(2 ** 32));
    expect(await hashrateOracle.read.getRewardPerTHinBTC()).to.equal(expectedReward);
  });

  it("should calculate correct reward per TH in token", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;

    // Set test values
    const difficulty = 1000000000000n; // 1T difficulty
    const blockReward = parseUnits("6.25", 8); // 6.25 BTC in satoshis
    await hashrateOracle.write.setDifficulty([difficulty], { account: owner.account });
    await hashrateOracle.write.setBlockReward([blockReward], { account: owner.account });

    // Get reward in token
    const rewardInToken = await hashrateOracle.read.getRewardPerEHinToken();
    const rewardInBTC = await hashrateOracle.read.getRewardPerEHinBTC();

    // The reward in token should be reward in BTC multiplied by BTC price
    // Since we're using a mock oracle with price 100, the reward should be 100x
    expect(rewardInToken).to.equal(rewardInBTC * BigInt(100));
  });

  it("should emit DifficultyUpdated when values are updated", async function () {
    const { accounts, contracts } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;
    const pc = accounts.pc;

    // Set difficulty and check event
    const difficulty = 1000n;
    const difficultyTx = await hashrateOracle.write.setDifficulty([difficulty], {
      account: owner.account,
    });
    const difficultyReceipt = await pc.waitForTransactionReceipt({ hash: difficultyTx });
    const [difficultyEvent] = parseEventLogs({
      abi: hashrateOracle.abi,
      logs: difficultyReceipt.logs,
      eventName: "DifficultyUpdated",
    });
    expect(difficultyEvent.args.newDifficulty).to.equal(difficulty);
  });

  it("should emit BlockRewardUpdated when values are updated", async function () {
    const { accounts, contracts } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;
    const pc = accounts.pc;

    // Set block reward and check event
    const blockReward = parseUnits("6.25", 8);
    const blockRewardTx = await hashrateOracle.write.setBlockReward([blockReward], {
      account: owner.account,
    });
    const blockRewardReceipt = await pc.waitForTransactionReceipt({ hash: blockRewardTx });
    const [blockRewardEvent] = parseEventLogs({
      abi: hashrateOracle.abi,
      logs: blockRewardReceipt.logs,
      eventName: "BlockRewardUpdated",
    });
    expect(blockRewardEvent.args.newBlockReward).to.equal(blockReward);
  });

  it("should not emit events when values are not changed", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;
    const pc = accounts.pc;

    // Set initial values
    await hashrateOracle.write.setDifficulty([1000n], { account: owner.account });
    await hashrateOracle.write.setBlockReward([parseUnits("6.25", 8)], { account: owner.account });

    // Set same values again and check no events are emitted
    const difficultyTx = await hashrateOracle.write.setDifficulty([1000n], {
      account: owner.account,
    });
    const difficultyReceipt = await pc.waitForTransactionReceipt({ hash: difficultyTx });
    const difficultyEvents = parseEventLogs({
      abi: hashrateOracle.abi,
      logs: difficultyReceipt.logs,
      eventName: "DifficultyUpdated",
    });
    expect(difficultyEvents.length).to.equal(0);

    const blockRewardTx = await hashrateOracle.write.setBlockReward([parseUnits("6.25", 8)], {
      account: owner.account,
    });
    const blockRewardReceipt = await pc.waitForTransactionReceipt({ hash: blockRewardTx });
    const blockRewardEvents = parseEventLogs({
      abi: hashrateOracle.abi,
      logs: blockRewardReceipt.logs,
      eventName: "BlockRewardUpdated",
    });
    expect(blockRewardEvents.length).to.equal(0);
  });

  it("should allow owner to transfer ownership", async function () {
    const { accounts, contracts } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;
    const newOwner = accounts.buyer;
    const pc = accounts.pc;

    // Transfer ownership
    const transferTx = await hashrateOracle.write.transferOwnership([newOwner.account.address], {
      account: owner.account,
    });
    const transferReceipt = await pc.waitForTransactionReceipt({ hash: transferTx });
    const [ownershipEvent] = parseEventLogs({
      abi: hashrateOracle.abi,
      logs: transferReceipt.logs,
      eventName: "OwnershipTransferred",
    });

    expect(ownershipEvent.args.previousOwner).to.equal(getAddress(owner.account.address));
    expect(ownershipEvent.args.newOwner).to.equal(getAddress(newOwner.account.address));
    expect(await hashrateOracle.read.owner()).to.equal(getAddress(newOwner.account.address));
  });

  it("should not allow non-owner to transfer ownership", async function () {
    const { accounts, contracts } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const nonOwner = accounts.buyer;
    const newOwner = accounts.seller;

    await catchError(contracts.hashrateOracle.abi, "OwnableUnauthorizedAccount", async () => {
      await hashrateOracle.write.transferOwnership([newOwner.account.address], {
        account: nonOwner.account,
      });
    });
  });

  it("should allow owner to renounce ownership", async function () {
    const { accounts, contracts } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const owner = accounts.owner;
    const pc = accounts.pc;

    // Renounce ownership
    const renounceTx = await hashrateOracle.write.renounceOwnership({
      account: owner.account,
    });
    const renounceReceipt = await pc.waitForTransactionReceipt({ hash: renounceTx });
    const [ownershipEvent] = parseEventLogs({
      abi: hashrateOracle.abi,
      logs: renounceReceipt.logs,
      eventName: "OwnershipTransferred",
    });

    expect(ownershipEvent.args.previousOwner).to.equal(getAddress(owner.account.address));
    expect(ownershipEvent.args.newOwner).to.equal(ZERO_ADDRESS);
    expect(await hashrateOracle.read.owner()).to.equal(ZERO_ADDRESS);
  });

  it("should not allow non-owner to renounce ownership", async function () {
    const { accounts, contracts } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;
    const nonOwner = accounts.buyer;

    await catchError(contracts.hashrateOracle.abi, "OwnableUnauthorizedAccount", async () => {
      await hashrateOracle.write.renounceOwnership({
        account: nonOwner.account,
      });
    });
  });
});
