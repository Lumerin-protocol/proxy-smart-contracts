import { viem } from "hardhat";
import { parseUnits, parseEventLogs, maxUint256, encodeFunctionData, zeroAddress } from "viem";
import type { WalletClient } from "@nomicfoundation/hardhat-viem/types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

export async function deployFuturesFixture() {
  // Get wallet clients
  const [owner, seller, buyer, validator, buyer2, seller2] = await viem.getWalletClients();
  const pc = await viem.getPublicClient();
  const tc = await viem.getTestClient();
  const topUpBalance = parseUnits("10000", 6); // 10,000 USDC

  // Deploy USDC Mock (for payments)
  const _usdcMock = await viem.deployContract("contracts/mocks/USDCMock.sol:USDCMock", []);
  const usdcMock = await getIERC20Metadata(_usdcMock.address);

  // Deploy BTC Price Oracle Mock
  const btcPriceOracleMock = await viem.deployContract(
    "contracts/mocks/BTCPriceOracleMock.sol:BTCPriceOracleMock",
    []
  );

  // Top up all accounts with USDC
  await usdcMock.write.transfer([seller.account.address, topUpBalance]);
  await usdcMock.write.transfer([buyer.account.address, topUpBalance]);
  await usdcMock.write.transfer([buyer2.account.address, topUpBalance]);
  await usdcMock.write.transfer([seller2.account.address, topUpBalance]);
  await usdcMock.write.transfer([validator.account.address, topUpBalance]);

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

  const sellerLiquidationMarginPercent = 100;
  const buyerLiquidationMarginPercent = 50;
  const speedHps = parseUnits("100", 12); // 100 TH/s
  const deliveryDurationSeconds = 30 * 24 * 3600; // 30 days

  // Deploy Futures contract
  const futuresImpl = await viem.deployContract("contracts/marketplace/Futures.sol:Futures", []);
  const futuresProxy = await viem.deployContract("ERC1967Proxy", [
    futuresImpl.address,
    encodeFunctionData({
      abi: futuresImpl.abi,
      functionName: "initialize",
      args: [
        usdcMock.address,
        hashrateOracle.address,
        validator.account.address,
        sellerLiquidationMarginPercent,
        buyerLiquidationMarginPercent,
        speedHps,
        deliveryDurationSeconds,
      ],
    }),
  ]);
  const futures = await viem.getContractAt("Futures", futuresProxy.address);

  // Approve futures contract to spend USDC for all accounts
  await usdcMock.write.approve([futures.address, maxUint256], {
    account: seller.account,
  });
  await usdcMock.write.approve([futures.address, maxUint256], {
    account: buyer.account,
  });
  await usdcMock.write.approve([futures.address, maxUint256], {
    account: buyer2.account,
  });
  await usdcMock.write.approve([futures.address, maxUint256], {
    account: seller2.account,
  });
  await usdcMock.write.approve([futures.address, maxUint256], {
    account: validator.account,
  });

  // Add some delivery dates for testing
  const currentTime = BigInt(await time.latest());
  const deliveryDate1 = currentTime + 30n * 86400n; // 1 day from now
  const deliveryDate2 = currentTime + 60n * 86400n; // 2 days from now
  const deliveryDate3 = currentTime + 90n * 86400n; // 3 days from now

  await futures.write.addDeliveryDate([deliveryDate1], { account: owner.account });
  await futures.write.addDeliveryDate([deliveryDate2], { account: owner.account });
  await futures.write.addDeliveryDate([deliveryDate3], { account: owner.account });

  return {
    config: {
      oracle,
      deliveryDates: {
        date1: deliveryDate1,
        date2: deliveryDate2,
        date3: deliveryDate3,
      },
      speedHps,
      sellerLiquidationMarginPercent,
      buyerLiquidationMarginPercent,
      deliveryDurationSeconds,
    },
    contracts: {
      usdcMock,
      btcPriceOracleMock,
      hashrateOracle,
      futures,
    },
    accounts: {
      owner,
      seller,
      buyer,
      buyer2,
      seller2,
      validator,
      pc,
      tc,
    },
  };
}

function getIERC20(addr: `0x${string}`) {
  return viem.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", addr);
}

function getIERC20Metadata(addr: `0x${string}`) {
  return viem.getContractAt(
    "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata",
    addr
  );
}
