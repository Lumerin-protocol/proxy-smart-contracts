import { expect } from "chai";
import { viem } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ZERO_ADDRESS } from "./utils";
import { mapResellTerms } from "./mappers";

/** @param progress 0.0 - 1.0 early closeout contract progress */
export async function testEarlyCloseout(
  approxProgress: number, // 0.0 - 1.0, progress at which the contract is closed
  hrContractAddr: `0x${string}`,
  buyerAddr: `0x${string}`,
  validatorAddr: `0x${string}`,
  cfAddress: `0x${string}`,
  paymentTokenAddress: `0x${string}`,
  feeTokenAddress: `0x${string}`
) {
  // TODO: move to args

  const impl = await viem.getContractAt("Implementation", hrContractAddr);

  const hrContractData = await impl.read.terms().then((t) => {
    const [speed, length, version] = t;
    return { speed, length, version };
  });
  const entry = await impl.read.resellChain([0n]).then(mapResellTerms);
  const speed = Number(hrContractData.speed);
  const length = Number(hrContractData.length);
  const version = Number(hrContractData.version);
  const seller = entry._seller;

  // Only assuming the oracles are not updating prices
  const [price, fee] = await impl.read.priceAndFee();
  const effectiveFee = validatorAddr !== ZERO_ADDRESS ? fee : 0n;

  // Get contract instances using Viem
  const cf = await viem.getContractAt("CloneFactory", cfAddress);
  const paymentToken = await viem.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    paymentTokenAddress
  );
  const feeToken = await viem.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    feeTokenAddress
  );
  const pc = await viem.getPublicClient();

  // Approve tokens
  await paymentToken.write.approve([cfAddress, price], { account: buyerAddr });
  await feeToken.write.approve([cfAddress, fee], { account: buyerAddr });

  // Purchase the contract
  const purchaseTx = await cf.write.setPurchaseRentalContractV2(
    [
      hrContractAddr,
      validatorAddr,
      "encryptedValidatorURL",
      "encryptedDestURL",
      version,
      true,
      false,
      0n,
    ],
    { account: buyerAddr }
  );
  const purchaseReceipt = await pc.getTransactionReceipt({ hash: purchaseTx });
  const purchaseBlock = await pc.getBlock({ blockNumber: purchaseReceipt.blockNumber });

  // Get balances
  const buyerBalance = Number(await paymentToken.read.balanceOf([buyerAddr]));
  const validatorBalance = Number(await feeToken.read.balanceOf([validatorAddr]));
  const sellerBalance = Number(await paymentToken.read.balanceOf([seller]));

  // advance blockchain time minus 1 second, so the next block will
  // have the timestamp that is exactly needed for the progress simulation.
  const sleepSeconds = approxProgress * length - 1;
  if (sleepSeconds > 0) {
    await time.increase(sleepSeconds);
  }

  // closeout by buyer
  const closeTx = await impl.write.closeEarly([0], { account: buyerAddr });
  const closeReceipt = await pc.getTransactionReceipt({ hash: closeTx });
  const closeBlock = await pc.getBlock({ blockNumber: closeReceipt.blockNumber });

  // calculate real blockchain progress
  const progress =
    (Number(closeBlock.timestamp) - Number(purchaseBlock.timestamp)) / Number(length);

  const buyerBalanceAfter = Number(await paymentToken.read.balanceOf([buyerAddr]));
  const validatorBalanceAfter = Number(await feeToken.read.balanceOf([validatorAddr]));
  const sellerBalanceAfter = Number(await paymentToken.read.balanceOf([seller]));

  const deltaBuyerBalance = buyerBalanceAfter - buyerBalance;
  const deltaValidatorBalance = validatorBalanceAfter - validatorBalance;
  const deltaSellerBalance = sellerBalanceAfter - sellerBalance;

  const buyerRefundFraction = 1 - progress;
  const buyerRefundAmount = buyerRefundFraction * Number(price);
  const validatorEarnings = Number(fee) * progress;
  const sellerClaimAmount = progress * Number(price);

  expect(deltaBuyerBalance).approximately(
    buyerRefundAmount,
    5,
    `buyer should be ${buyerRefundFraction * 100}% refunded`
  );
  expect(deltaValidatorBalance).approximately(
    validatorEarnings,
    5,
    "validator should earn correct amount"
  );
  expect(deltaSellerBalance).approximately(
    sellerClaimAmount,
    5,
    `seller should collect ${progress * 100}% of the price`
  );
}
