import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { getAddress, parseEventLogs } from "viem";
import { getPublicKey } from "../../lib/pubkey";

describe("Contract history", function () {
  async function setupContractFixture() {
    const { accounts, contracts } = await loadFixture(deployLocalFixture);
    const { seller, buyer, owner } = accounts;
    const { cloneFactory, usdcMock, lumerinToken } = contracts;
    const pc = await viem.getPublicClient();

    // Create a new contract for testing
    const speed = 1_000_000n; // 1 TH/s in H/s
    const length = 3600n; // 1 hour in seconds
    const profitTargetPercent = 0;

    const hash = await cloneFactory.write.setCreateNewRentalContractV2(
      [
        0n, // baseReward
        0n, // index
        speed,
        length,
        profitTargetPercent,
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
      speed,
      length,
    };
  }

  it("should create contract and check its history", async function () {
    const { hrContractAddr } = await loadFixture(setupContractFixture);

    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const data = await impl.read.getHistory([0n, 100n]);

    expect(data.length).equal(0);
  });

  it("should add history entry on bad closeout", async function () {
    const { hrContractAddr, seller, buyer, cloneFactory, usdcMock, lumerinToken } =
      await loadFixture(setupContractFixture);

    // Purchase the contract first
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

    // Close early (bad closeout)
    await impl.write.closeEarly([0], { account: buyer.account });

    const data = await impl.read.getHistory([0n, 100n]);
    expect(data.length).equal(1);
  });

  it("should add a good history entry on purchase", async function () {
    const { hrContractAddr, seller, buyer, cloneFactory, usdcMock, lumerinToken, pc, length } =
      await loadFixture(setupContractFixture);

    // Purchase the contract
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [state, terms] = await impl.read.getPublicVariablesV2();

    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    const purchaseHash = await cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, buyer.account.address, "", "", terms._version],
      { account: buyer.account }
    );

    const purchaseReceipt = await pc.waitForTransactionReceipt({ hash: purchaseHash });
    const purchaseBlock = await pc.getBlock({ blockNumber: purchaseReceipt.blockNumber });
    const purchaseTime = purchaseBlock.timestamp;

    // Advance time to let contract complete naturally
    await time.increase(Number(length));

    const data = await impl.read.getHistory([0n, 100n]);
    const entry = data.find((entry) => entry._purchaseTime === purchaseTime);

    expect(entry).not.to.be.undefined;
    expect(entry?._buyer.toLowerCase()).equal(buyer.account.address.toLowerCase());
  });

  it("should verify other fields", async function () {
    const {
      hrContractAddr,
      seller,
      buyer,
      cloneFactory,
      usdcMock,
      lumerinToken,
      pc,
      speed,
      length,
    } = await loadFixture(setupContractFixture);

    // Purchase the contract
    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const [state, terms] = await impl.read.getPublicVariablesV2();

    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    const purchaseHash = await cloneFactory.write.setPurchaseRentalContractV2(
      [hrContractAddr, buyer.account.address, "", "", terms._version],
      { account: buyer.account }
    );

    const purchaseReceipt = await pc.waitForTransactionReceipt({ hash: purchaseHash });
    const purchaseBlock = await pc.getBlock({ blockNumber: purchaseReceipt.blockNumber });
    const purchaseTime = purchaseBlock.timestamp;

    // Close early to create end time
    const closeHash = await impl.write.closeEarly([0], { account: buyer.account });
    const closeReceipt = await pc.waitForTransactionReceipt({ hash: closeHash });
    const closeBlock = await pc.getBlock({ blockNumber: closeReceipt.blockNumber });
    const endTime = closeBlock.timestamp;

    const data = await impl.read.getHistory([0n, 100n]);
    const entry = data.find((entry) => entry._purchaseTime === purchaseTime);

    expect(entry).not.to.be.undefined;
    expect(entry?._purchaseTime).equal(purchaseTime);
    expect(entry?._endTime).equal(endTime);
    expect(entry?._price).equal(terms._price);
    expect(entry?._speed).equal(speed);
    expect(entry?._length).equal(length);
    expect(getAddress(entry!._buyer)).equal(getAddress(buyer.account.address));
  });

  it("should paginate history: limit less than total number of elements", async function () {
    const { hrContractAddr } = await loadFixture(setupContractFixture);

    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const data = await impl.read.getHistory([0n, 1n]);

    expect(data.length).to.be.lessThanOrEqual(1);
  });

  it("should paginate history: limit more than total number of elements", async function () {
    const { hrContractAddr, seller, buyer, cloneFactory, usdcMock, lumerinToken } =
      await loadFixture(setupContractFixture);

    // Create some history by making multiple purchases
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    for (let i = 0; i < 3; i++) {
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

      // Close early to reset for next purchase
      await impl.write.closeEarly([0], { account: buyer.account });
    }

    const data = await impl.read.getHistory([0n, 100n]);
    expect(data.length).equal(3);
  });

  it("should paginate history: offset less than total number of elements", async function () {
    const { hrContractAddr, buyer, cloneFactory, usdcMock, lumerinToken } = await loadFixture(
      setupContractFixture
    );

    // Create some history
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    for (let i = 0; i < 2; i++) {
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

      await impl.write.closeEarly([0], { account: buyer.account });
    }

    const data = await impl.read.getHistory([1n, 1n]);
    expect(data.length).equal(1);
  });

  it("should paginate history: offset more than total number of elements", async function () {
    const { hrContractAddr } = await loadFixture(setupContractFixture);

    const impl = await viem.getContractAt("Implementation", hrContractAddr);
    const data = await impl.read.getHistory([100n, 1n]);

    expect(data.length).equal(0);
  });

  it("should paginate history: verify entries", async function () {
    const { hrContractAddr, seller, buyer, cloneFactory, usdcMock, lumerinToken } =
      await loadFixture(setupContractFixture);

    // Create some history
    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    for (let i = 0; i < 2; i++) {
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

      await impl.write.closeEarly([0], { account: buyer.account });
    }

    const [entry1] = await impl.read.getHistory([0n, 1n]);
    const [entry2] = await impl.read.getHistory([1n, 1n]);
    const entries = await impl.read.getHistory([0n, 2n]);

    expect(entries.length).equal(2);
    expect(entry1._purchaseTime).equal(entries[0]._purchaseTime);
    expect(entry2._purchaseTime).equal(entries[1]._purchaseTime);
    expect(entry1._purchaseTime).not.equal(entry2._purchaseTime);
  });

  it("should return correct stats", async function () {
    const { hrContractAddr, seller, buyer, cloneFactory, usdcMock, lumerinToken, length } =
      await loadFixture(setupContractFixture);

    const impl = await viem.getContractAt("Implementation", hrContractAddr);

    // Create one successful contract (let it complete naturally)
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

    // Let contract complete naturally (successful)
    await time.increase(Number(length));

    // Create two failed contracts (close early)
    for (let i = 0; i < 2; i++) {
      const [state2, terms2] = await impl.read.getPublicVariablesV2();

      await usdcMock.write.approve([cloneFactory.address, terms2._price], {
        account: buyer.account,
      });
      await lumerinToken.write.approve([cloneFactory.address, terms2._fee], {
        account: buyer.account,
      });

      await cloneFactory.write.setPurchaseRentalContractV2(
        [hrContractAddr, buyer.account.address, "", "", terms2._version],
        { account: buyer.account }
      );

      // Close early (failed)
      await impl.write.closeEarly([0], { account: buyer.account });
    }

    const stats = await impl.read.getStats();

    expect(stats[0]).equal(1n); // _successCount
    expect(stats[1]).equal(2n); // _failCount
  });
});
