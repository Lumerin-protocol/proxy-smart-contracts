import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { getAddress, parseEventLogs, parseUnits } from "viem";
import { catchError } from "../lib";
import { ZERO_ADDRESS } from "../utils";
import { viem } from "hardhat";

describe("Hashrate oracle", function () {
  it("should initialize with correct values", async function () {
    const decimals = 8;
    const usdcTokenMock = await viem.deployContract(
      "contracts/mocks/LumerinTokenMock.sol:LumerinToken",
      []
    );
    const hashrateOracle = await viem.deployContract(
      "contracts/marketplace/HashrateOracle.sol:HashrateOracle",
      [usdcTokenMock.address, decimals]
    );

    // Check initial values
    expect(await hashrateOracle.read.getDifficulty()).to.equal(0n);
    expect(await hashrateOracle.read.getBlockReward()).to.equal(0n);
    expect(await hashrateOracle.read.oracleDecimals()).to.equal(BigInt(decimals));
    expect(await hashrateOracle.read.tokenDecimals()).to.equal(
      BigInt(await usdcTokenMock.read.decimals())
    );
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
    const { contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;

    const { difficulty, blockReward } = config.oracle;

    // Calculate expected hashes needed to earn 1 BTC using floating point arithmetic
    // Formula: (difficulty * DIFFICULTY_TO_HASHRATE_FACTOR) / blockReward
    const DIFFICULTY_TO_HASHRATE_FACTOR = 2 ** 32;

    // Convert BigInt values to numbers for floating point calculation
    const difficultyFloat = Number(difficulty);
    const blockRewardFloat = Number(blockReward);

    // Calculate using floats
    const expectedHashesFloat =
      (difficultyFloat * DIFFICULTY_TO_HASHRATE_FACTOR) / blockRewardFloat;
    const expectedHashesForBTC = BigInt(Math.floor(expectedHashesFloat));

    const actualHashesForBTC = await hashrateOracle.read.getHashesForBTC();
    expect(actualHashesForBTC).to.equal(expectedHashesForBTC);
  });

  it("should calculate correct reward per TH in token", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const hashrateOracle = contracts.hashrateOracle;

    const { btcPrice, decimals } = config.oracle;

    // Get reward in token
    const hashesForToken = await hashrateOracle.read.getHashesforToken();
    const hashesForBTC = await hashrateOracle.read.getHashesForBTC();

    // oracle has its own decimals
    const btcDecimals = 8;
    const usdcDecimals = 6;
    const resultDecimals = btcDecimals - usdcDecimals + decimals;
    const result = (Number(hashesForBTC) / Number(btcPrice)) * 10 ** resultDecimals;

    expect(Number(hashesForToken)).to.approximately(result, 1);
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
