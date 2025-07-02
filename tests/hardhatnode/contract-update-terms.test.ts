import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { parseEventLogs } from "viem";
import { getPublicKey } from "../../lib/pubkey";

describe("Contract terms update", function () {
  async function setupContractFixture() {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { seller, buyer, owner } = accounts;
    const { cloneFactory, usdcMock, lumerinToken } = contracts;
    const pc = await viem.getPublicClient();

    // Create a new contract for testing
    const initialSpeed = 1n; // 1 H/s
    const initialLength = 3600n; // 1 hour in seconds
    const initialProfitTarget = 0;

    const hash = await cloneFactory.write.setCreateNewRentalContractV2(
      [
        0n, // baseReward
        0n, // index
        initialSpeed,
        initialLength,
        initialProfitTarget,
        seller.account.address,
        await getPublicKey(seller),
      ],
      { account: seller.account }
    );

    const receipt = await pc.waitForTransactionReceipt({ hash });
    const [event] = parseEventLogs({
      logs: receipt.logs,
      abi: cloneFactory.abi,
      eventName: "contractCreated",
    });
    const hrContractAddr = event.args._address;

    return {
      hrContractAddr,
      seller,
      buyer,
      owner,
      cloneFactory,
      usdcMock,
      lumerinToken,
      pc,
      initialSpeed,
      initialLength,
      initialProfitTarget,
      config,
    };
  }

  it("should create contract and check its status", async function () {
    const { hrContractAddr, initialSpeed, initialLength, initialProfitTarget } = await loadFixture(
      setupContractFixture
    );

    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [futurePrice, futureFee, futureSpeed, futureLength, futureVersion, futureProfitTarget] =
      await impl.read.futureTerms();
    const [, terms] = await impl.read.getPublicVariablesV2();

    // Future terms should be empty (not set)
    expect(futurePrice).equal(0n);
    expect(futureFee).equal(0n);
    expect(futureSpeed).equal(0n);
    expect(futureLength).equal(0n);
    expect(futureVersion).equal(0);
    expect(futureProfitTarget).equal(0);

    // Current terms should have initial values
    expect(terms._version).equal(0);
    expect(terms._speed).equal(initialSpeed);
    expect(terms._length).equal(initialLength);
    expect(terms._profitTarget).equal(initialProfitTarget);
  });

  it("should prohibit updating if caller is not a seller", async function () {
    const { hrContractAddr, cloneFactory, lumerinToken, config, owner } = await loadFixture(
      setupContractFixture
    );
    const [, , , , , seller2] = await viem.getWalletClients();

    const speed = 2n;
    const length = 3n;
    const profitTarget = 1;

    await lumerinToken.write.transfer(
      [seller2.account.address, config.cloneFactory.minSellerStake],
      { account: owner.account }
    );
    await lumerinToken.write.approve([cloneFactory.address, config.cloneFactory.minSellerStake], {
      account: seller2.account,
    });
    await cloneFactory.write.sellerRegister([config.cloneFactory.minSellerStake], {
      account: seller2.account,
    });

    try {
      await cloneFactory.write.setUpdateContractInformationV2(
        [hrContractAddr, 0n, 0n, speed, length, profitTarget],
        { account: seller2.account }
      );
      expect.fail("should throw error");
    } catch (err: any) {
      expect(err.message).to.include("you are not authorized");
    }
  });

  it("should update contract and emit event without futureTerms update", async function () {
    const { hrContractAddr, seller, cloneFactory, pc } = await loadFixture(setupContractFixture);

    const updatedSpeed = 3n;
    const updatedLength = 4n;
    const updatedProfitTarget = 1;
    const expectedVersion = 1;

    const hash = await cloneFactory.write.setUpdateContractInformationV2(
      [hrContractAddr, 0n, 0n, updatedSpeed, updatedLength, updatedProfitTarget],
      { account: seller.account }
    );

    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [futurePrice, futureFee, futureSpeed, futureLength, futureVersion, futureProfitTarget] =
      await impl.read.futureTerms();
    const [state, terms] = await impl.read.getPublicVariablesV2();

    // Future terms should remain empty (contract not running)
    expect(futurePrice).equal(0n);
    expect(futureFee).equal(0n);
    expect(futureSpeed).equal(0n);
    expect(futureLength).equal(0n);
    expect(futureVersion).equal(0);
    expect(futureProfitTarget).equal(0);

    // Current terms should be updated
    expect(terms._speed).equal(updatedSpeed);
    expect(terms._length).equal(updatedLength);
    expect(terms._profitTarget).equal(updatedProfitTarget);
    expect(terms._version).equal(expectedVersion);

    // Check for event emission
    const receipt = await pc.waitForTransactionReceipt({ hash });
    const events = parseEventLogs({
      logs: receipt.logs,
      abi: impl.abi,
      eventName: "purchaseInfoUpdated",
    });

    const updateEvent = events.find((e) => e.args._address === hrContractAddr);
    expect(updateEvent).not.to.be.undefined;
  });

  it("should store futureTerms for contract and should emit update event if contract is running", async function () {
    const {
      hrContractAddr,
      seller,
      buyer,
      cloneFactory,
      usdcMock,
      lumerinToken,
      pc,
      initialSpeed,
      initialLength,
      initialProfitTarget,
    } = await loadFixture(setupContractFixture);

    // First purchase the contract to make it running
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [state, terms] = await impl.read.getPublicVariablesV2();

    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    await cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, buyer.account.address, "", "", terms._version],
      { account: buyer.account }
    );

    // Now update the contract terms while it's running
    const futureSpeed = 33n;
    const futureLength = 44n;
    const futureProfitTarget = 5;
    const expectedFutureVersion = 1;

    const hash = await cloneFactory.write.setUpdateContractInformationV2(
      [hrContractAddr, 0n, 0n, futureSpeed, futureLength, futureProfitTarget],
      { account: seller.account }
    );

    const [
      storedFuturePrice,
      storedFutureFee,
      storedFutureSpeed,
      storedFutureLength,
      storedFutureVersion,
      storedFutureProfitTarget,
    ] = await impl.read.futureTerms();
    const [newState, newTerms] = await impl.read.getPublicVariablesV2();

    // Future terms should be set with new values
    expect(storedFuturePrice).equal(0n); // Price is calculated dynamically
    expect(storedFutureFee).equal(0n); // Fee is calculated dynamically
    expect(storedFutureSpeed).equal(futureSpeed);
    expect(storedFutureLength).equal(futureLength);
    expect(storedFutureVersion).equal(expectedFutureVersion);
    expect(storedFutureProfitTarget).equal(futureProfitTarget);

    // Current terms should remain unchanged while contract is running
    expect(newTerms._speed).equal(initialSpeed);
    expect(newTerms._length).equal(initialLength);
    expect(newTerms._profitTarget).equal(initialProfitTarget);
    expect(newTerms._version).equal(0);

    // Check for event emission
    const receipt = await pc.waitForTransactionReceipt({ hash });
    const events = parseEventLogs({
      logs: receipt.logs,
      abi: impl.abi,
      eventName: "purchaseInfoUpdated",
    });

    const updateEvent = events.find((e) => e.args._address === hrContractAddr);
    expect(updateEvent).not.to.be.undefined;
  });

  it("should apply futureTerms after contract closed and emit event", async function () {
    const { hrContractAddr, seller, buyer, cloneFactory, usdcMock, lumerinToken, pc } =
      await loadFixture(setupContractFixture);

    // Purchase and set future terms
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    let [state, terms] = await impl.read.getPublicVariablesV2();

    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    await cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, buyer.account.address, "", "", terms._version],
      { account: buyer.account }
    );

    // Set future terms while running
    const futureSpeed = 33n;
    const futureLength = 44n;
    const futureProfitTarget = 5;
    const expectedAppliedVersion = 1;

    await cloneFactory.write.setUpdateContractInformationV2(
      [hrContractAddr, 0n, 0n, futureSpeed, futureLength, futureProfitTarget],
      { account: seller.account }
    );

    // Close the contract early
    const closeHash = await impl.write.closeEarly([0], { account: buyer.account });

    // Check that future terms were applied and cleared
    const [
      clearedFuturePrice,
      clearedFutureFee,
      clearedFutureSpeed,
      clearedFutureLength,
      clearedFutureVersion,
      clearedFutureProfitTarget,
    ] = await impl.read.futureTerms();
    [state, terms] = await impl.read.getPublicVariablesV2();

    // Future terms should be cleared after application
    expect(clearedFuturePrice).equal(0n);
    expect(clearedFutureFee).equal(0n);
    expect(clearedFutureSpeed).equal(0n);
    expect(clearedFutureLength).equal(0n);
    expect(clearedFutureVersion).equal(0);
    expect(clearedFutureProfitTarget).equal(0);

    // Current terms should now have the future values applied
    expect(terms._speed).equal(futureSpeed);
    expect(terms._length).equal(futureLength);
    expect(terms._profitTarget).equal(futureProfitTarget);
    expect(terms._version).equal(expectedAppliedVersion);

    // Check for event emission
    const receipt = await pc.waitForTransactionReceipt({ hash: closeHash });
    const events = parseEventLogs({
      logs: receipt.logs,
      abi: impl.abi,
      eventName: "purchaseInfoUpdated",
    });

    const updateEvent = events.find((e) => e.args._address === hrContractAddr);
    expect(updateEvent).not.to.be.undefined;
  });

  it("should restrict purchasing of previous version of contract", async function () {
    const { hrContractAddr, seller, buyer, cloneFactory, usdcMock, lumerinToken } =
      await loadFixture(setupContractFixture);

    // Update contract terms to increment version
    const updatedSpeed = 3n;
    const updatedLength = 4n;
    const updatedProfitTarget = 1;
    const outdatedVersion = 0;

    await cloneFactory.write.setUpdateContractInformationV2(
      [hrContractAddr, 0n, 0n, updatedSpeed, updatedLength, updatedProfitTarget],
      { account: seller.account }
    );

    // Try to purchase with old version (0)
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [state, terms] = await impl.read.getPublicVariablesV2();

    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    try {
      await cloneFactory.write.setPurchaseRentalContractV2(
        [hrContractAddr, buyer.account.address, "", "", outdatedVersion],
        { account: buyer.account }
      );
      expect.fail("should not allow purchase previous contract version");
    } catch (err: any) {
      expect(err.message).to.include("cannot purchase, contract terms were updated");
    }
  });

  it("should set profitTarget", async function () {
    const { hrContractAddr, seller, cloneFactory } = await loadFixture(setupContractFixture);

    const newSpeed = 3n;
    const newLength = 4n;
    const highProfitTarget = 10;
    const expectedVersion = 1;

    await cloneFactory.write.setUpdateContractInformationV2(
      [hrContractAddr, 0n, 0n, newSpeed, newLength, highProfitTarget],
      { account: seller.account }
    );

    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [state, terms] = await impl.read.getPublicVariablesV2();

    expect(terms._profitTarget).equal(highProfitTarget);
    expect(terms._speed).equal(newSpeed);
    expect(terms._length).equal(newLength);
    expect(terms._version).equal(expectedVersion);
  });
});
