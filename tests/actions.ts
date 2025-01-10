import { expect } from "chai";
import type Web3 from "web3";
import { Lumerin, CloneFactory, Implementation } from "../build-js/dist";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ZERO_ADDRESS } from "./utils";

/** @param progress 0.0 - 1.0 early closeout contract progress */
export async function testEarlyCloseout(
  approxProgress: number, // 0.0 - 1.0, progress at which the contract is closed
  fee: string,
  seller: string,
  buyerAddr: string,
  validatorAddr: string,
  cloneFactoryAddress: string,
  lumerinAddress: string,
  web3: Web3
) {
  // TODO: move to args
  const effectiveValidatorFeeRate = validatorAddr !== ZERO_ADDRESS ? 0.01 : 0;
  const cf = CloneFactory(web3, cloneFactoryAddress);
  const lumerin = Lumerin(web3, lumerinAddress);
  const speed = 1_000_000;
  const length = 1000;
  const price = 1_000_000;
  const version = 0;
  const validatorFee = price * effectiveValidatorFeeRate;
  const priceWithValidatorFee = price + validatorFee;

  const receipt = await cf.methods
    .setCreateNewRentalContractV2(
      String(price),
      "0",
      String(speed),
      String(length),
      "0",
      cloneFactoryAddress,
      "0x0"
    )
    .send({ from: seller, value: fee });
  const hrContractAddr = receipt.events?.contractCreated.returnValues._address;

  await lumerin.methods
    .approve(cloneFactoryAddress, String(priceWithValidatorFee))
    .send({ from: buyerAddr });

  const purchase = await cf.methods
    .setPurchaseRentalContractV2(
      hrContractAddr,
      validatorAddr,
      "encryptedValidatorURL",
      "encryptedDestURL",
      version
    )
    .send({ from: buyerAddr, value: fee });

  const purchaseBlock = await web3.eth.getBlock(purchase.blockNumber);

  const buyerBalance = Number(await lumerin.methods.balanceOf(buyerAddr).call());
  const validatorBalance = Number(await lumerin.methods.balanceOf(validatorAddr).call());

  // advance blockchain time minus 1 second, so the next block will
  // have the timestamp that is exactly needed for the progress simulation.
  const sleepSeconds = approxProgress * length - 1;
  if (sleepSeconds > 0) {
    await time.increase(sleepSeconds);
  }

  // closeout by buyer
  const impl = Implementation(web3, hrContractAddr);
  const close = await impl.methods.closeEarly(0).send({ from: buyerAddr });
  const closeBlock = await web3.eth.getBlock(close.blockNumber);

  // calculate real blockchain progress
  const progress =
    (Number(closeBlock.timestamp) - Number(purchaseBlock.timestamp)) / Number(length);

  const buyerBalanceAfter = Number(await lumerin.methods.balanceOf(buyerAddr).call());
  const validatorBalanceAfter = Number(await lumerin.methods.balanceOf(validatorAddr).call());
  const deltaBuyerBalance = buyerBalanceAfter - buyerBalance;
  const deltaValidatorBalance = validatorBalanceAfter - validatorBalance;

  const buyerRefundFraction = 1 - progress;
  const buyerRefundAmount = buyerRefundFraction * priceWithValidatorFee;
  const validatorEarnings = price * effectiveValidatorFeeRate * progress;

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

  // claim by seller
  const sellerBalance = Number(await lumerin.methods.balanceOf(seller).call());
  await impl.methods.claimFunds().send({ from: seller, value: fee });
  const sellerBalanceAfter = Number(await lumerin.methods.balanceOf(seller).call());
  const deltaSellerBalance = sellerBalanceAfter - sellerBalance;
  const sellerClaimAmount = progress * Number(price);

  expect(deltaSellerBalance).equal(
    sellerClaimAmount,
    `seller should collect ${progress * 100}% of the price`
  );
}
