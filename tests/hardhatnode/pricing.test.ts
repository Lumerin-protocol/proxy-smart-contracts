import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { viem } from "hardhat";

describe("Contract pricing", function () {
  it("should calculate correct price based on hashrate and duration", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { owner, seller } = accounts;

    // Set up mining parameters
    const difficulty = config.oracle.difficulty;
    const blockReward = config.oracle.blockReward;
    const btcPrice = config.oracle.btcPrice;

    // Set up contract parameters
    const speed = 1000000000000n; // 1 TH/s
    const length = 3600n; // 1 hour
    const profitTarget = 10; // 10% profit target

    // Create contract
    const txHash = await contracts.cloneFactory.write.setCreateNewRentalContractV2(
      [0n, 0n, speed, length, profitTarget, seller.account.address, "123"],
      { account: seller.account }
    );

    const receipt = await accounts.pc.waitForTransactionReceipt({ hash: txHash });
    const hrContractAddr = receipt.logs[0].address;
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Calculate expected price
    // rewardPerTHinBTC = blockReward * TERA / difficulty / DIFFICULTY_TO_HASHRATE_FACTOR
    // priceInToken = rewardPerTHinBTC * btcPrice * speed * length
    // finalPrice = priceInToken * (100 + profitTarget) / 100
    const TERA = 10n ** 12n;
    const DIFFICULTY_TO_HASHRATE_FACTOR = 2n ** 32n;
    const rewardPerTHinBTC = (blockReward * TERA) / difficulty / DIFFICULTY_TO_HASHRATE_FACTOR;
    const priceInToken = rewardPerTHinBTC * btcPrice * speed * length;
    const expectedPrice = (priceInToken * BigInt(100 + profitTarget)) / 100n;

    // Get actual price
    const [actualPrice, fee] = await impl.read.priceAndFee();

    // Verify price calculation
    expect(actualPrice).to.equal(expectedPrice);
  });

  it("should handle zero profit target correctly", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { seller } = accounts;

    // Set up mining parameters
    const difficulty = config.oracle.difficulty;
    const blockReward = config.oracle.blockReward;
    const btcPrice = config.oracle.btcPrice;

    // Set up contract parameters with zero profit target
    const speed = 1000000000000n;
    const length = 3600n;
    const profitTarget = 0;

    // Create contract
    const txHash = await contracts.cloneFactory.write.setCreateNewRentalContractV2(
      [0n, 0n, speed, length, profitTarget, seller.account.address, "123"],
      { account: seller.account }
    );

    const receipt = await accounts.pc.waitForTransactionReceipt({ hash: txHash });
    const hrContractAddr = receipt.logs[0].address;
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Calculate expected price (should be same as priceInToken since profit target is 0)
    const TERA = 10n ** 12n;
    const DIFFICULTY_TO_HASHRATE_FACTOR = 2n ** 32n;
    const rewardPerTHinBTC = (blockReward * TERA) / difficulty / DIFFICULTY_TO_HASHRATE_FACTOR;
    const expectedPrice = rewardPerTHinBTC * btcPrice * speed * length;

    // Get actual price
    const [actualPrice, fee] = await impl.read.priceAndFee();

    // Verify price calculation
    expect(actualPrice).to.equal(expectedPrice);
  });

  it("should handle negative profit target correctly", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { hashrateOracle, btcPriceOracleMock } = contracts;
    const { owner, seller } = accounts;

    // Set up mining parameters
    const difficulty = config.oracle.difficulty;
    const blockReward = config.oracle.blockReward;
    const btcPrice = config.oracle.btcPrice;

    // Set up contract parameters with negative profit target
    const speed = 1000000000000n;
    const length = 3600n;
    const profitTarget = -5; // -5% profit target

    // Create contract
    const txHash = await contracts.cloneFactory.write.setCreateNewRentalContractV2(
      [0n, 0n, speed, length, profitTarget, seller.account.address, "123"],
      { account: seller.account }
    );

    const receipt = await accounts.pc.waitForTransactionReceipt({ hash: txHash });
    const hrContractAddr = receipt.logs[0].address;
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Calculate expected price
    const TERA = 10n ** 12n;
    const DIFFICULTY_TO_HASHRATE_FACTOR = 2n ** 32n;
    const rewardPerTHinBTC = (blockReward * TERA) / difficulty / DIFFICULTY_TO_HASHRATE_FACTOR;
    const priceInToken = rewardPerTHinBTC * btcPrice * speed * length;
    const expectedPrice = (priceInToken * BigInt(100 + profitTarget)) / 100n;

    // Get actual price
    const [actualPrice, fee] = await impl.read.priceAndFee();

    // Verify price calculation
    expect(actualPrice).to.equal(expectedPrice);
  });
});
