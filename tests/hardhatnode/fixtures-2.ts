import { viem } from "hardhat";
import { parseUnits, getAddress, parseEventLogs } from "viem";
import { hoursToSeconds } from "../../lib/utils";
import { THPStoHPS } from "../../lib/utils";
import { compressPublicKey, getPublicKey } from "../../lib/pubkey";

type ContractConfigWithCount = {
  config: {
    speedTHPS: number;
    lengthHours: number;
    profitTargetPercent: number;
  };
  count: number;
};

export const sampleContracts: ContractConfigWithCount[] = [
  { config: { speedTHPS: 100, lengthHours: 1, profitTargetPercent: 5 }, count: 2 },
  { config: { speedTHPS: 300, lengthHours: 0.5, profitTargetPercent: 10 }, count: 2 },
  { config: { speedTHPS: 800, lengthHours: 0.1, profitTargetPercent: 20 }, count: 3 },
  { config: { speedTHPS: 100, lengthHours: 2, profitTargetPercent: 15 }, count: 2 },
  { config: { speedTHPS: 100, lengthHours: 24, profitTargetPercent: 0 }, count: 1 },
];

export async function deployLocalFixture() {
  // Get wallet clients
  const [owner, seller, buyer, validator, validator2] = await viem.getWalletClients();
  const pc = await viem.getPublicClient();

  // Deploy Lumerin Token (for fees)
  const lumerinToken = await viem.deployContract("contracts/token/LumerinToken.sol:Lumerin", []);

  // Deploy USDC Mock (for payments)
  const usdcMock = await viem.deployContract("contracts/mocks/USDCMock.sol:USDCMock", []);

  // Deploy BTC Price Oracle Mock
  const btcPriceOracleMock = await viem.deployContract(
    "contracts/mocks/BTCPriceOracleMock.sol:BTCPriceOracleMock",
    []
  );

  const BITCOIN_DECIMALS = 8;

  const oracle = {
    btcPrice: parseUnits("84524.2", BITCOIN_DECIMALS),
    blockReward: parseUnits("3.125", BITCOIN_DECIMALS),
    difficulty: 121n * 10n ** 12n,
  };

  await btcPriceOracleMock.write.setPrice([oracle.btcPrice, BITCOIN_DECIMALS]);

  // Deploy HashrateOracle
  const hashrateOracle = await viem.deployContract(
    "contracts/marketplace/HashrateOracle.sol:HashrateOracle",
    [btcPriceOracleMock.address, await usdcMock.read.decimals()]
  );
  await hashrateOracle.write.initialize();

  await hashrateOracle.write.setBlockReward([oracle.blockReward]);
  await hashrateOracle.write.setDifficulty([oracle.difficulty]);

  const btcPrice = await btcPriceOracleMock.read.latestRoundData();
  console.log("BTC price:", btcPrice);

  const hfb = await hashrateOracle.read.getHashesForBTC();
  console.log("Hashes for 1 unit of btc:", hfb);

  const rewardPerTHinToken = await hashrateOracle.read.getHashesforToken();
  console.log("Hashes for 1 unit of token:", rewardPerTHinToken);

  // Deploy Faucet
  const faucet = await viem.deployContract("contracts/faucet/Faucet.sol:Faucet", [
    lumerinToken.address,
    parseUnits("800", 8), // FAUCET_DAILY_MAX_LMR
    parseUnits("2", 8), // FAUCET_LMR_PAYOUT
    parseUnits("0.01", 18), // FAUCET_ETH_PAYOUT
  ]);

  // Deploy Implementation and Beacon
  const implementation = await viem.deployContract(
    "contracts/marketplace/Implementation.sol:Implementation",
    []
  );

  const beacon = await viem.deployContract(
    "@openzeppelin/contracts-v5/proxy/beacon/UpgradeableBeacon.sol:UpgradeableBeacon",
    [implementation.address, owner.account.address]
  );

  // Deploy CloneFactory
  const cloneFactory = await viem.deployContract(
    "contracts/marketplace/CloneFactory.sol:CloneFactory",
    []
  );

  const cloneFactoryConfig = {
    validatorFeeRateScaled:
      parseUnits("0.01", 18) *
      10n ** BigInt((await lumerinToken.read.decimals()) - (await usdcMock.read.decimals())),
    contractAddresses: [] as `0x${string}`[],
  };
  // Initialize CloneFactory with beacon address instead of implementation
  await cloneFactory.write.initialize([
    beacon.address, // baseImplementation (beacon)
    hashrateOracle.address, // hashrateOracle
    usdcMock.address, // paymentToken (USDC)
    lumerinToken.address, // feeToken (LMR)
    cloneFactoryConfig.validatorFeeRateScaled,
  ]);

  // Deploy ValidatorRegistry
  const validatorRegistry = await viem.deployContract(
    "contracts/validator-registry/ValidatorRegistry.sol:ValidatorRegistry",
    []
  );

  const validatorRegistryConfig = {
    validatorStakeMinimum: parseUnits("0.1", 8),
    validatorStakeRegister: parseUnits("1", 8),
    validatorPunishAmount: parseUnits("0.1", 8),
    validatorPunishThreshold: 3,
  };

  // Initialize ValidatorRegistry
  await validatorRegistry.write.initialize([
    lumerinToken.address,
    validatorRegistryConfig.validatorStakeMinimum,
    validatorRegistryConfig.validatorStakeRegister,
    validatorRegistryConfig.validatorPunishAmount,
    validatorRegistryConfig.validatorPunishThreshold,
  ]);

  // add validators to ValidatorRegistry
  const exp = {
    host: "localhost:3000",
    stake: parseUnits("1", 8),
  };

  // validator 1
  await lumerinToken.write.transfer([validator.account.address, exp.stake]);
  await lumerinToken.write.approve([validatorRegistry.address, exp.stake], {
    account: validator.account,
  });
  const pubKey = compressPublicKey(await getPublicKey(validator));
  const hash = await validatorRegistry.write.validatorRegister(
    [exp.stake, pubKey.yParity, pubKey.x, exp.host],
    { account: validator.account }
  );
  await pc.waitForTransactionReceipt({ hash });

  // validator 2
  await lumerinToken.write.transfer([validator2.account.address, exp.stake]);
  await lumerinToken.write.approve([validatorRegistry.address, exp.stake], {
    account: validator2.account,
  });
  const pubKey2 = compressPublicKey(await getPublicKey(validator2));
  const hash2 = await validatorRegistry.write.validatorRegister(
    [exp.stake, pubKey2.yParity, pubKey2.x, exp.host],
    { account: validator2.account }
  );
  await pc.waitForTransactionReceipt({ hash: hash2 });
  // Create contracts

  for (const contract of sampleContracts) {
    for (let i = 0; i < contract.count; i++) {
      const hash = await cloneFactory.write.setCreateNewRentalContractV2(
        [
          0n,
          0n,
          BigInt(THPStoHPS(contract.config.speedTHPS)),
          BigInt(hoursToSeconds(contract.config.lengthHours)),
          Number(contract.config.profitTargetPercent),
          seller.account.address,
          await getPublicKey(seller),
        ],
        {
          account: seller.account,
        }
      );

      const receipt = await pc.waitForTransactionReceipt({ hash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });
      const address = event.args._address;

      const hrContract = await viem.getContractAt("Implementation", address);

      console.log("hashrate TH/s:", contract.config.speedTHPS);
      console.log("length hours:", contract.config.lengthHours);
      console.log("profit target percent:", contract.config.profitTargetPercent);
      const [price, fee] = await hrContract.read.priceAndFee();
      console.log("Price:", price);
      console.log("Fee:", fee);

      cloneFactoryConfig.contractAddresses.push(address);
    }
  }

  // Deploy Multicall3
  const multicall3 = await viem.deployContract("Multicall3", []);

  // Return all deployed contracts and accounts
  return {
    config: {
      cloneFactory: cloneFactoryConfig,
      validatorRegistry: validatorRegistryConfig,
      oracle,
    },
    contracts: {
      lumerinToken,
      usdcMock,
      btcPriceOracleMock,
      hashrateOracle,
      faucet,
      cloneFactory,
      implementation,
      validatorRegistry,
      multicall3,
    },
    accounts: {
      owner,
      seller,
      buyer,
      validator,
      validator2,
      pc,
    },
  };
}
