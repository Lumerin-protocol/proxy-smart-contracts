import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { getAddress, maxInt256, maxUint256, zeroAddress } from "viem";
import { writeAndWait } from "../../scripts/lib/writeContract";
import { viem } from "hardhat";
import { expect } from "chai";
import { getTxDeltaBalance, getTxDeltaTime, getTxTimestamp } from "../lib";
import { abs } from "../../lib/bigint";

describe("Resell", () => {
  it("should be able to resell a contract", async () => {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { cloneFactory, lumerinToken, usdcMock } = contracts;
    const { buyer, seller, buyer2, owner, pc } = accounts;
    const hrContract = await viem.getContractAt(
      "Implementation",
      config.cloneFactory.contractAddresses[0]
    );

    // Register buyer as seller (reseller)
    await lumerinToken.write.transfer([buyer.account.address, config.cloneFactory.minSellerStake]);
    await lumerinToken.write.approve([cloneFactory.address, config.cloneFactory.minSellerStake], {
      account: buyer.account,
    });
    await cloneFactory.write.sellerRegister([config.cloneFactory.minSellerStake], {
      account: buyer.account,
    });

    // Register buyer2 as seller (reseller)
    await lumerinToken.write.transfer([buyer2.account.address, config.cloneFactory.minSellerStake]);
    await lumerinToken.write.approve([cloneFactory.address, config.cloneFactory.minSellerStake], {
      account: buyer2.account,
    });
    await cloneFactory.write.sellerRegister([config.cloneFactory.minSellerStake], {
      account: buyer2.account,
    });

    // check price
    const [price, fee] = await hrContract.read.priceAndFee();

    const approveLmr = await lumerinToken.simulate.approve([cloneFactory.address, maxUint256], {
      account: buyer.account.address,
    });
    await writeAndWait(buyer, approveLmr);

    const approveUsdc = await usdcMock.simulate.approve([cloneFactory.address, maxUint256], {
      account: buyer.account.address,
    });
    await writeAndWait(buyer, approveUsdc);

    //
    //
    console.log("first purchase");
    //
    //
    const purchase = await cloneFactory.simulate.setPurchaseRentalContractV2(
      [hrContract.address, zeroAddress, "", "", 0, true, false, 10],
      { account: buyer.account.address }
    );
    const receipt = await writeAndWait(buyer, purchase);

    console.log(
      "price",
      await getTxDeltaBalance(pc, receipt.transactionHash, buyer.account.address, usdcMock)
    );

    // check state of the contract is available
    const state = await hrContract.read.contractState();
    expect(state).to.be.equal(0);

    const terms = await hrContract.read.terms().then((t) => {
      const [speed, length, version] = t;
      return { speed, length, version };
    });
    console.log("terms", terms);

    // check that the seller updated to a buyer (buyer is going to resell the contract)
    expect(await hrContract.read.seller()).to.be.equal(getAddress(buyer.account.address));

    // check first sell terms
    const resellTerms = await getResellTerms(hrContract.address, 0n);

    expect(resellTerms._seller).to.be.equal(getAddress(seller.account.address));
    expect(resellTerms._profitTarget).to.be.equal(5);
    expect(resellTerms._buyer).to.be.equal(getAddress(buyer.account.address));
    // expect(resellTerms._validator).to.be.equal(getAddress(buyer.account.address));
    expect(resellTerms._price).to.be.equal(price);
    expect(resellTerms._fee).to.be.equal(fee);
    // expect(resellTerms._startTime).to.be.equal(1000000000000000000);
    // expect(resellTerms._encrDestURL).to.be.equal("");
    // expect(resellTerms._encrValidatorURL).to.be.equal("");

    // check second sell offer terms
    const resellTerms2 = await getResellTerms(hrContract.address, 1n);
    expect(resellTerms2._seller).to.be.equal(getAddress(buyer.account.address));
    expect(resellTerms2._profitTarget).to.be.equal(10);
    expect(resellTerms2._buyer).to.be.equal(zeroAddress);
    expect(resellTerms2._validator).to.be.equal(zeroAddress);
    // expect(resellTerms2._validator).to.be.equal(getAddress(buyer.account.address));
    // expect(resellTerms2._price).to.be.equal(1000000000000000000);

    // check new price and fee, it should be 10% from the mining price
    const [newPrice, newFee] = await hrContract.read.priceAndFee();
    const expectedPrice = (((price * 100000n) / 105n) * 110n) / 100000n;
    const expectedFee = (((fee * 100000n) / 105n) * 110n) / 100000n;
    expect(newPrice - expectedPrice < 10n).to.be.true;
    expect(newFee - expectedFee < 10n).to.be.true;

    // try to buy a reselled contract
    await lumerinToken.write.transfer([buyer2.account.address, newPrice], {
      account: owner.account.address,
    });
    await lumerinToken.write.approve([cloneFactory.address, newPrice], {
      account: buyer2.account.address,
    });
    await usdcMock.write.transfer([buyer2.account.address, newFee], {
      account: owner.account.address,
    });
    await usdcMock.write.approve([cloneFactory.address, newFee], {
      account: buyer2.account.address,
    });

    //
    //
    console.log("second purchase");
    //
    //
    const buyResell = await cloneFactory.simulate.setPurchaseRentalContractV2(
      [hrContract.address, zeroAddress, "", "", 0, true, false, 15],
      { account: buyer2.account.address }
    );
    const buyResellTx = await writeAndWait(buyer2, buyResell);

    console.log(
      "price",
      await getTxDeltaBalance(pc, buyResellTx.transactionHash, buyer2.account.address, usdcMock)
    );

    // check that the contract is now owned by the buyer2
    expect(await hrContract.read.seller()).to.be.equal(getAddress(buyer2.account.address));

    // close the contract by the buyer2
    const tc = await viem.getTestClient();
    const purchaseDurationSeconds = 30 * 60;
    await tc.increaseTime({ seconds: purchaseDurationSeconds });

    //
    //
    console.log("close early");
    //
    //
    const closeEarlyTx = await hrContract.write.closeEarly([0], {
      account: buyer2.account.address,
    });

    // check the contract seller now
    expect(await hrContract.read.seller()).to.be.equal(getAddress(buyer.account.address));
    const deltaBalance = await getTxDeltaBalance(pc, closeEarlyTx, buyer.account.address, usdcMock);

    const contractRuntime = await getTxDeltaTime(pc, buyResellTx.transactionHash, closeEarlyTx);

    const hashesForToken = await contracts.hashrateOracle.read.getHashesforToken();
    const basePrice = (terms.speed * contractRuntime) / hashesForToken;
    const expectedReward = basePrice + (basePrice * 10n) / 100n;
    const actualProfitTarget = (deltaBalance * 100n) / basePrice;
    console.log("actualProfitTarget", actualProfitTarget);

    expect(abs(deltaBalance - expectedReward) < 10n).to.eq(
      true,
      `actual: ${deltaBalance}, expected: ${expectedReward}`
    );

    // close again
    console.log("close early again");

    const closeAgainTx = await hrContract.write.closeEarly([0], {
      account: buyer.account.address,
    });

    const deltaBalance2 = await getTxDeltaBalance(
      pc,
      closeAgainTx,
      seller.account.address,
      usdcMock
    );
    console.log("deltaBalance2", deltaBalance2);
    expect(deltaBalance2).to.be.equal(0n);
  });
});

it.only("should auto close and resolve payments to everyone", async () => {
  const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
  const { cloneFactory, lumerinToken, usdcMock } = contracts;
  const { buyer, seller, buyer2, owner, pc } = accounts;
  const hrContract = await viem.getContractAt(
    "Implementation",
    config.cloneFactory.contractAddresses[0]
  );

  // Register buyer as seller (reseller)
  await lumerinToken.write.transfer([buyer.account.address, config.cloneFactory.minSellerStake]);
  await lumerinToken.write.approve([cloneFactory.address, config.cloneFactory.minSellerStake], {
    account: buyer.account,
  });
  await cloneFactory.write.sellerRegister([config.cloneFactory.minSellerStake], {
    account: buyer.account,
  });

  // Register buyer2 as seller (reseller)
  await lumerinToken.write.transfer([buyer2.account.address, config.cloneFactory.minSellerStake]);
  await lumerinToken.write.approve([cloneFactory.address, config.cloneFactory.minSellerStake], {
    account: buyer2.account,
  });
  await cloneFactory.write.sellerRegister([config.cloneFactory.minSellerStake], {
    account: buyer2.account,
  });

  // check price
  const [price, fee] = await hrContract.read.priceAndFee();

  const approveLmr = await lumerinToken.simulate.approve([cloneFactory.address, maxUint256], {
    account: buyer.account.address,
  });
  await writeAndWait(buyer, approveLmr);

  const approveUsdc = await usdcMock.simulate.approve([cloneFactory.address, maxUint256], {
    account: buyer.account.address,
  });
  await writeAndWait(buyer, approveUsdc);

  //
  //
  console.log("first purchase");
  //
  //
  const purchaseTx = await cloneFactory.write.setPurchaseRentalContractV2(
    [hrContract.address, zeroAddress, "", "", 0, true, false, 10],
    { account: buyer.account.address }
  );

  console.log("price", await getTxDeltaBalance(pc, purchaseTx, buyer.account.address, usdcMock));

  // check state of the contract is available
  const state = await hrContract.read.contractState();
  expect(state).to.be.equal(0);

  const terms = await hrContract.read.terms().then((t) => {
    const [speed, length, version] = t;
    return { speed, length, version };
  });
  console.log("terms", terms);

  // check new price and fee, it should be 10% from the mining price
  const [newPrice, newFee] = await hrContract.read.priceAndFee();

  // try to buy a reselled contract
  await lumerinToken.write.transfer([buyer2.account.address, newPrice], {
    account: owner.account.address,
  });
  await lumerinToken.write.approve([cloneFactory.address, newPrice], {
    account: buyer2.account.address,
  });
  await usdcMock.write.transfer([buyer2.account.address, newFee], {
    account: owner.account.address,
  });
  await usdcMock.write.approve([cloneFactory.address, newFee], {
    account: buyer2.account.address,
  });

  //
  //
  console.log("second purchase");
  //
  //
  const buyResellTx = await cloneFactory.write.setPurchaseRentalContractV2(
    [hrContract.address, zeroAddress, "", "", 0, true, false, 15],
    { account: buyer2.account.address }
  );

  console.log("price", await getTxDeltaBalance(pc, buyResellTx, buyer2.account.address, usdcMock));

  // auto close the contract
  const tc = await viem.getTestClient();
  const contractLength = 3600;
  await tc.increaseTime({ seconds: contractLength + 1 });

  await hrContract.write.claimFunds({
    account: buyer2.account.address,
  });
});

function getHrContract(addr: `0x${string}`) {
  return viem.getContractAt("Implementation", addr);
}

async function getResellTerms(addr: `0x${string}`, index: bigint) {
  const contract = await getHrContract(addr);
  const terms = await contract.read.resellChain([index]);
  const [
    _seller,
    _profitTarget,
    _buyer,
    _validator,
    _price,
    _fee,
    _startTime,
    _encrDestURL,
    _encrValidatorURL,
  ] = terms;
  return {
    _seller,
    _profitTarget,
    _buyer,
    _validator,
    _price,
    _fee,
    _startTime,
    _encrDestURL,
    _encrValidatorURL,
  };
}

type ResellTerms = Awaited<ReturnType<typeof getResellTerms>>;
