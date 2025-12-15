import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "../fixtures-2";
import { viem } from "hardhat";

const ZETTA = 10n ** 21n;

describe("Contract pricing", function () {
  it("should calculate correct price based on hashrate and duration", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { seller } = accounts;
    const { oracle } = config;

    // Set up contract parameters
    const speed = 1n * ZETTA;
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

    const expectedPrice = convertPrice({
      blockRewardWei: oracle.blockReward,
      difficulty: oracle.difficulty,
      btcPrice: oracle.btcPrice,
      oracleDecimals: oracle.decimals,
      speed,
      length,
      profitTarget,
    });

    // Get actual price
    const [actualPrice, fee] = await impl.read.priceAndFee();

    expect(actualPrice).to.equal(expectedPrice);
  });

  it("should handle zero profit target correctly", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { seller } = accounts;
    const { oracle } = config;

    // Set up contract parameters with zero profit target
    const speed = 1n * ZETTA;
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

    const expectedPrice = convertPrice({
      blockRewardWei: oracle.blockReward,
      difficulty: oracle.difficulty,
      btcPrice: oracle.btcPrice,
      oracleDecimals: oracle.decimals,
      speed,
      length,
      profitTarget,
    });

    // Get actual price
    const [actualPrice, fee] = await impl.read.priceAndFee();

    // Verify price calculation
    expect(actualPrice).to.equal(expectedPrice);
  });

  it("should handle negative profit target correctly", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { seller } = accounts;
    const { oracle } = config;

    // Set up contract parameters with negative profit target
    const speed = 1n * ZETTA;
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
    const expectedPrice = convertPrice({
      blockRewardWei: oracle.blockReward,
      difficulty: oracle.difficulty,
      btcPrice: oracle.btcPrice,
      oracleDecimals: oracle.decimals,
      speed,
      length,
      profitTarget,
    });
    // Get actual price
    const [actualPrice, fee] = await impl.read.priceAndFee();

    // Verify price calculation
    expect(Number(actualPrice)).approximately(Number(expectedPrice), 5);
  });

  it("should not revert if oracle data is stale", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);

    const shortTTL = 60n; // 60 seconds
    await contracts.hashrateOracle.write.setTTL([shortTTL, shortTTL], {
      account: accounts.owner.account,
    });

    // Advance time to make the oracle data stale
    await time.increase(Number(shortTTL) + 1);

    // Get contract instance and terms
    const impl = await viem.getContractAt(
      "Implementation",
      config.cloneFactory.contractAddresses[0]
    );
    const [, terms] = await impl.read.getPublicVariablesV2();
  });
});

// oracle has to consider the decimals or source token, dest token and decimals of the oracle itself
function convertPrice(props: {
  blockRewardWei: bigint;
  difficulty: bigint;
  btcPrice: bigint;
  oracleDecimals: number;
  speed: bigint;
  length: bigint;
  profitTarget: number;
}) {
  const { blockRewardWei, difficulty, btcPrice, oracleDecimals, speed, length, profitTarget } =
    props;
  const DIFFICULTY_TO_HASHRATE_FACTOR = 2n ** 32n;
  const MULTIPLIER = 10n ** 31n;
  const rewardPerZHinBTC =
    (blockRewardWei * MULTIPLIER) / difficulty / DIFFICULTY_TO_HASHRATE_FACTOR;

  const priceInToken =
    (rewardPerZHinBTC * speed * length * btcPrice * 10n ** 6n) /
    10n ** BigInt(oracleDecimals) /
    10n ** 8n /
    MULTIPLIER;
  const expectedPrice = (priceInToken * BigInt(100 + profitTarget)) / 100n;
  return expectedPrice;
}
