import { viem } from "hardhat";
import { parseUnits, maxUint256, encodeFunctionData } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployTokenOraclesAndMulticall3 } from "../fixtures-2";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

export async function deployFuturesFixture() {
  // Get wallet clients
  const data = await loadFixture(deployTokenOraclesAndMulticall3);
}

export async function deployOnlyFuturesFixture(
  data: Awaited<ReturnType<typeof deployTokenOraclesAndMulticall3>>
) {
  const { contracts, accounts, config } = data;
  const { usdcMock, hashrateOracle, btcPriceOracleMock } = contracts;
  const { validator, seller, buyer, buyer2, owner, pc, tc } = accounts;
  const { oracle } = config;

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
  await usdcMock.write.approve([futures.address, maxUint256], { account: seller.account });
  await usdcMock.write.approve([futures.address, maxUint256], { account: buyer.account });
  await usdcMock.write.approve([futures.address, maxUint256], { account: buyer2.account });
  await usdcMock.write.approve([futures.address, maxUint256], { account: validator.account });

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
      validator,
      pc,
      tc,
    },
  };
}

export async function deployOnlyFuturesWithDummyData(
  data: Awaited<ReturnType<typeof deployTokenOraclesAndMulticall3>>
) {
  const _data = await deployOnlyFuturesFixture(data);
  const { contracts, accounts, config } = _data;
  const { futures } = contracts;
  const { seller, buyer, buyer2 } = accounts;

  // create participants
  const marginAmount = parseUnits("1000", 6);
  await futures.write.addMargin([marginAmount], { account: seller.account });
  await futures.write.addMargin([marginAmount], { account: buyer.account });
  await futures.write.addMargin([marginAmount], { account: buyer2.account });

  // create positions
  let d = config.deliveryDates.date1;
  // sell positions
  await futures.write.createPosition([parseUnits("160", 6), d, false], { account: seller.account });
  await futures.write.createPosition([parseUnits("155", 6), d, false], { account: seller.account });
  await futures.write.createPosition([parseUnits("150", 6), d, false], { account: seller.account });

  // buy positions
  await futures.write.createPosition([parseUnits("140", 6), d, true], { account: buyer.account });
  await futures.write.createPosition([parseUnits("135", 6), d, true], { account: buyer.account });
  await futures.write.createPosition([parseUnits("130", 6), d, true], { account: buyer.account });

  // matched position => order
  await futures.write.createPosition([parseUnits("150", 6), d, true], { account: buyer.account });
  return _data;
}
