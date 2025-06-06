import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { viem } from "hardhat";
import { getAddress, parseEventLogs, zeroAddress } from "viem";
import { deployLocalFixture } from "./fixtures-2";

describe("Contract create", function () {
  const speed = 1_000_000n;
  const length = 3600n;
  const profitTarget = 10;
  const pubKey = "123";

  it("should create a new contract", async function () {
    const { accounts, contracts } = await loadFixture(deployLocalFixture);
    const { seller, pc } = accounts;
    const { cloneFactory } = contracts;

    // Create new rental contract (using V2 method)
    const txHash = await cloneFactory.write.setCreateNewRentalContractV2(
      [0n, 0n, speed, length, profitTarget, zeroAddress, pubKey],
      { account: seller.account }
    );

    const receipt = await pc.waitForTransactionReceipt({ hash: txHash });

    // Parse contractCreated event from logs
    const [event] = parseEventLogs({
      logs: receipt.logs,
      abi: cloneFactory.abi,
      eventName: "contractCreated",
    });

    const hrContractAddr = event.args._address;

    // Get the Implementation contract instance
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Get public variables (using V2 method)
    const [
      state,
      terms,
      startingBlockTimestamp,
      buyer,
      _seller,
      encryptedPoolData,
      isDeleted,
      balance,
      hasFutureTerms,
    ] = await impl.read.getPublicVariablesV2();

    expect(state).to.equal(0);
    expect(getAddress(_seller)).to.equal(getAddress(seller.account.address));
    expect(startingBlockTimestamp).to.equal(0n);
    expect(buyer).to.equal(zeroAddress);
    expect(encryptedPoolData).to.equal("");
    expect(isDeleted).to.equal(false);
    expect(balance).to.equal(0n);
    expect(hasFutureTerms).to.equal(false);

    expect(terms._speed).to.equal(speed);
    expect(terms._length).to.equal(length);
    expect(terms._profitTarget).to.equal(profitTarget);

    // Get history
    const history = await impl.read.getHistory([0n, 10n]);
    expect(history.length).to.equal(0);

    // Get future terms
    const futureTerms = await impl.read.futureTerms();
    expect(futureTerms).to.deep.equal([0n, 0n, 0n, 0n, 0, 0]);
  });
});
