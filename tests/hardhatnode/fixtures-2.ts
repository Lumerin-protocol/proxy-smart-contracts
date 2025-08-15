import { viem } from "hardhat";
import {
  parseUnits,
  parseEventLogs,
  maxUint256,
  maxUint32,
  encodeFunctionData,
  zeroAddress,
} from "viem";
import { hoursToSeconds } from "../../lib/utils";
import { THPStoHPS } from "../../lib/utils";
import { compressPublicKey, getPublicKey } from "../../lib/pubkey";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { WalletClient } from "@nomicfoundation/hardhat-viem/types";

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
  const [owner, seller, buyer, validator, validator2, buyer2] = await viem.getWalletClients();
  const pc = await viem.getPublicClient();
  const tc = await viem.getTestClient();

  // Deploy Lumerin Token (for fees)
  const _lumerinToken = await viem.deployContract("contracts/token/LumerinToken.sol:Lumerin", []);
  const lumerinToken = await getIERC20(_lumerinToken.address);

  // Deploy USDC Mock (for payments)
  const _usdcMock = await viem.deployContract("contracts/mocks/USDCMock.sol:USDCMock", []);
  const usdcMock = await getIERC20(_usdcMock.address);

  // Deploy BTC Price Oracle Mock
  const btcPriceOracleMock = await viem.deployContract(
    "contracts/mocks/BTCPriceOracleMock.sol:BTCPriceOracleMock",
    []
  );

  // Top up buyer with tokens
  await usdcMock.write.transfer([buyer.account.address, parseUnits("1000", 8)]);
  await lumerinToken.write.transfer([buyer.account.address, parseUnits("1000", 8)]);

  const oracle = (() => {
    const BITCOIN_DECIMALS = 8;
    const USDC_DECIMALS = 6;
    const DIFFICULTY_TO_HASHRATE_FACTOR = 2n ** 32n;

    const btcPrice = parseUnits("84524.2", USDC_DECIMALS);
    const blockReward = parseUnits("3.125", BITCOIN_DECIMALS);
    const difficulty = 121n * 10n ** 12n;
    const hashesForBTC = (difficulty * DIFFICULTY_TO_HASHRATE_FACTOR) / blockReward;
    return {
      btcPrice,
      blockReward,
      difficulty,
      decimals: USDC_DECIMALS,
      hashesForBTC,
    };
  })();

  await btcPriceOracleMock.write.setPrice([oracle.btcPrice, oracle.decimals]);

  // Deploy HashrateOracle
  const hashrateOracleImpl = await viem.deployContract(
    "contracts/marketplace/HashrateOracle.sol:HashrateOracle",
    [btcPriceOracleMock.address, await _usdcMock.read.decimals()]
  );
  const hashrateOracleProxy = await viem.deployContract("ERC1967Proxy", [
    hashrateOracleImpl.address,
    encodeFunctionData({
      abi: hashrateOracleImpl.abi,
      functionName: "initialize",
      args: [],
    }),
  ]);
  const hashrateOracle = await viem.getContractAt("HashrateOracle", hashrateOracleProxy.address);

  await hashrateOracle.write.setTTL([maxUint256, maxUint256]);
  await hashrateOracle.write.setHashesForBTC([oracle.hashesForBTC]);

  const btcPrice = await btcPriceOracleMock.read.latestRoundData();
  // console.log("BTC price:", btcPrice);

  const hfb = await hashrateOracle.read.getHashesForBTC();
  // console.log("Hashes for 1 unit of btc:", hfb);

  const rewardPerTHinToken = await hashrateOracle.read.getHashesforToken();
  // console.log("Hashes for 1 unit of token:", rewardPerTHinToken);

  // Deploy Faucet
  const faucet = await viem.deployContract("contracts/faucet/Faucet.sol:Faucet", [
    lumerinToken.address,
    parseUnits("800", 8), // FAUCET_DAILY_MAX_LMR
    parseUnits("2", 8), // FAUCET_LMR_PAYOUT
    parseUnits("0.01", 18), // FAUCET_ETH_PAYOUT
  ]);

  // Deploy Multicall3
  const multicall3 = await viem.deployContract("Multicall3", []);

  // Deploy Implementation and Beacon
  const mockImplementation = await viem.deployContract(
    "contracts/marketplace/Implementation.sol:Implementation",
    [zeroAddress, zeroAddress, zeroAddress, zeroAddress]
  );

  const beacon = await viem.deployContract(
    "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol:UpgradeableBeacon",
    [mockImplementation.address, owner.account.address]
  );

  // Deploy CloneFactory
  const cloneFactoryConfig = {
    validatorFeeRateScaled:
      parseUnits("0.01", 18) *
      10n ** BigInt((await _lumerinToken.read.decimals()) - (await _usdcMock.read.decimals())),
    contractAddresses: [] as `0x${string}`[],
    minSellerStake: parseUnits("10000", 8),
    minContractDuration: 0,
    maxContractDuration: Number(maxUint32),
  };
  const cloneFactoryImpl = await viem.deployContract(
    "contracts/marketplace/CloneFactory.sol:CloneFactory",
    []
  );
  const cloneFactoryProxy = await viem.deployContract("ERC1967Proxy", [
    cloneFactoryImpl.address,
    encodeFunctionData({
      abi: cloneFactoryImpl.abi,
      functionName: "initialize",
      args: [
        beacon.address, // baseImplementation (beacon)
        hashrateOracle.address, // hashrateOracle
        usdcMock.address, // paymentToken (USDC)
        lumerinToken.address, // feeToken (LMR)
        cloneFactoryConfig.validatorFeeRateScaled,
        cloneFactoryConfig.minSellerStake,
        cloneFactoryConfig.minContractDuration,
        cloneFactoryConfig.maxContractDuration,
      ],
    }),
  ]);

  const cloneFactory = await viem.getContractAt("CloneFactory", cloneFactoryProxy.address);

  const implementation = await viem.deployContract(
    "contracts/marketplace/Implementation.sol:Implementation",
    [cloneFactory.address, hashrateOracle.address, usdcMock.address, lumerinToken.address]
  );

  await beacon.write.upgradeTo([implementation.address], {
    account: owner.account,
  });

  // Deploy ValidatorRegistry
  const validatorRegistryConfig = {
    validatorStakeMinimum: parseUnits("0.1", 8),
    validatorStakeRegister: parseUnits("1", 8),
    validatorPunishAmount: parseUnits("0.1", 8),
    validatorPunishThreshold: 3,
  };
  const validatorRegistryImpl = await viem.deployContract(
    "contracts/validator-registry/ValidatorRegistry.sol:ValidatorRegistry",
    []
  );

  const validatorRegistryProxy = await viem.deployContract("ERC1967Proxy", [
    validatorRegistryImpl.address,
    encodeFunctionData({
      abi: validatorRegistryImpl.abi,
      functionName: "initialize",
      args: [
        lumerinToken.address,
        validatorRegistryConfig.validatorStakeMinimum,
        validatorRegistryConfig.validatorStakeRegister,
        validatorRegistryConfig.validatorPunishAmount,
        validatorRegistryConfig.validatorPunishThreshold,
      ],
    }),
  ]);

  const validatorRegistry = await viem.getContractAt(
    "ValidatorRegistry",
    validatorRegistryProxy.address
  );

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

  // Register seller
  await lumerinToken.write.transfer([seller.account.address, cloneFactoryConfig.minSellerStake]);
  await lumerinToken.write.approve([cloneFactory.address, cloneFactoryConfig.minSellerStake], {
    account: seller.account,
  });
  await cloneFactory.write.sellerRegister([cloneFactoryConfig.minSellerStake], {
    account: seller.account,
  });

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

      const [price, fee] = await hrContract.read.priceAndFee();

      cloneFactoryConfig.contractAddresses.push(address);
    }
  }

  // await buyContract(
  //   cloneFactoryConfig.contractAddresses[0],
  //   lumerinToken,
  //   cloneFactory,
  //   buyer,
  //   usdcMock,
  //   validator
  // );
  // await buyContract(
  //   cloneFactoryConfig.contractAddresses[1],
  //   lumerinToken,
  //   cloneFactory,
  //   buyer,
  //   usdcMock,
  //   validator
  // );

  // // viem increase blockchain time
  // const maxLength = Math.max(
  //   sampleContracts[0].config.lengthHours,
  //   sampleContracts[1].config.lengthHours
  // );
  // await time.increaseTo(
  //   Math.round(new Date().getTime() / 1000) - (sampleContracts[0].config.lengthHours * 3600) / 2
  // );

  // await buyContract(
  //   cloneFactoryConfig.contractAddresses[0],
  //   lumerinToken as any,
  //   cloneFactory,
  //   buyer,
  //   usdcMock as any,
  //   validator
  // );
  // await buyContract(
  //   cloneFactoryConfig.contractAddresses[1],
  //   lumerinToken as any,
  //   cloneFactory,
  //   buyer,
  //   usdcMock as any,
  //   validator
  // );

  // await time.increaseTo(Math.round(new Date().getTime() / 1000));

  // const c1 = await viem.getContractAt("Implementation", cloneFactoryConfig.contractAddresses[0]);
  // await c1.write.closeEarly([0], {
  //   account: buyer.account,
  // });
  // await pc.waitForTransactionReceipt({ hash });

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
      cloneFactory: cloneFactory,
      implementation,
      validatorRegistry,
      multicall3,
    },
    accounts: {
      owner,
      seller,
      buyer,
      buyer2,
      validator,
      validator2,
      pc,
    },
  };
}

async function buyContract(
  contractAddress: string,
  lumerinToken: IERC20,
  cloneFactory: ICloneFactory,
  buyer: WalletClient,
  usdcMock: IERC20,
  validator: WalletClient
) {
  console.log("buying contract", contractAddress);
  const c1 = await viem.getContractAt("Implementation", contractAddress as `0x${string}`);
  const [price, fee] = await c1.read.priceAndFee();
  await lumerinToken.write.approve([cloneFactory.address, fee], {
    account: buyer.account,
  });
  await usdcMock.write.approve([cloneFactory.address, price], {
    account: buyer.account,
  });
  await cloneFactory.write.setPurchaseRentalContractV2(
    [c1.address, validator.account.address, "", "", 0],
    {
      account: buyer.account,
    }
  );
}

function getCloneFactory(addr: `0x${string}`) {
  return viem.getContractAt("CloneFactory", addr);
}

function getIERC20(addr: `0x${string}`) {
  return viem.getContractAt("@openzeppelin/contracts-v4/token/ERC20/IERC20.sol:IERC20", addr);
}

type ICloneFactory = Awaited<ReturnType<typeof getCloneFactory>>;
type IERC20 = Awaited<ReturnType<typeof getIERC20>>;
