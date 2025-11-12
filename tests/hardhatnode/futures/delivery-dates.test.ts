import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployFuturesFixture } from "./fixtures";
import { catchError } from "../../lib";

describe("Delivery Date Management", function () {
  it("should return correct delivery dates array", async function () {
    const { contracts, config } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;

    const deliveryDates = await futures.read.getDeliveryDates();
    expect(deliveryDates.length).to.equal(config.futureDeliveryDatesCount);

    // Check that dates are in ascending order
    for (let i = 1; i < deliveryDates.length; i++) {
      expect(deliveryDates[i] > deliveryDates[i - 1]).to.be.true;
    }
  });

  it("should calculate delivery dates correctly based on interval", async function () {
    const { contracts } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;

    const deliveryDates = await futures.read.getDeliveryDates();
    const firstFutureDeliveryDate = await futures.read.firstFutureDeliveryDate();
    const deliveryIntervalDays = await futures.read.deliveryIntervalDays();

    // Check first date
    expect(deliveryDates[0]).to.equal(firstFutureDeliveryDate);

    // Check subsequent dates are spaced correctly
    for (let i = 1; i < deliveryDates.length; i++) {
      const expectedInterval = BigInt(deliveryIntervalDays) * 86400n; // Convert days to seconds
      const actualInterval = deliveryDates[i] - deliveryDates[i - 1];
      expect(actualInterval).to.equal(expectedInterval);
    }
  });

  it("should allow owner to update future delivery dates count", async function () {
    const { contracts, accounts } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;
    const { owner, pc } = accounts;

    const initialDeliveryDates = await futures.read.getDeliveryDates();
    expect(initialDeliveryDates.length).to.equal(3);

    // Update to 5 delivery dates
    const newCount = 5;
    const txHash = await futures.write.setFutureDeliveryDatesCount([newCount], {
      account: owner.account,
    });

    const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
    expect(receipt.status).to.equal("success");

    // Verify new count
    const updatedCount = await futures.read.futureDeliveryDatesCount();
    expect(updatedCount).to.equal(newCount);

    // Verify new delivery dates array
    const updatedDeliveryDates = await futures.read.getDeliveryDates();
    expect(updatedDeliveryDates.length).to.equal(newCount);

    // Verify existing dates remain the same
    for (let i = 0; i < initialDeliveryDates.length; i++) {
      expect(updatedDeliveryDates[i]).to.equal(initialDeliveryDates[i]);
    }
  });

  it("should reject updating future delivery dates count to zero", async function () {
    const { contracts, accounts } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;
    const { owner } = accounts;

    await catchError(futures.abi, "ValueOutOfRange", async () => {
      await futures.write.setFutureDeliveryDatesCount([0], {
        account: owner.account,
      });
    });
  });

  it("should reject non-owner from updating future delivery dates count", async function () {
    const { contracts, accounts } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;
    const { seller } = accounts;

    await catchError(futures.abi, "OwnableUnauthorizedAccount", async () => {
      await futures.write.setFutureDeliveryDatesCount([5], {
        account: seller.account,
      });
    });
  });

  it("should correctly read firstFutureDeliveryDate", async function () {
    const { contracts, config } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;

    const firstFutureDeliveryDate = await futures.read.firstFutureDeliveryDate();
    const deliveryDates = await futures.read.getDeliveryDates();

    // First delivery date should match the first date in the array
    expect(firstFutureDeliveryDate).to.equal(config.firstFutureDeliveryDate);
  });

  it("should correctly read delivery interval days", async function () {
    const { contracts, config } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;

    const deliveryIntervalDays = await futures.read.deliveryIntervalDays();
    // From fixture, deliveryIntervalDays is set to deliveryIntervalDays
    expect(deliveryIntervalDays).to.equal(config.deliveryIntervalDays);
  });

  it("should correctly read delivery duration days", async function () {
    const { contracts, config } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;

    const deliveryDurationDays = await futures.read.deliveryDurationDays();
    expect(deliveryDurationDays).to.equal(config.deliveryDurationDays);
  });

  it("should update delivery dates when count is increased", async function () {
    const { contracts, accounts } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;
    const { owner } = accounts;

    const initialDeliveryDates = await futures.read.getDeliveryDates();
    const initialCount = initialDeliveryDates.length;

    // Increase count
    const newCount = initialCount + 2;
    await futures.write.setFutureDeliveryDatesCount([newCount], {
      account: owner.account,
    });

    const updatedDeliveryDates = await futures.read.getDeliveryDates();
    expect(updatedDeliveryDates.length).to.equal(newCount);

    // Verify new dates are correctly calculated
    const firstFutureDeliveryDate = await futures.read.firstFutureDeliveryDate();
    const deliveryIntervalDays = await futures.read.deliveryIntervalDays();
    const deliveryIntervalSeconds = BigInt(deliveryIntervalDays) * 86400n;

    for (let i = 0; i < updatedDeliveryDates.length; i++) {
      const expectedDate = firstFutureDeliveryDate + deliveryIntervalSeconds * BigInt(i);
      expect(updatedDeliveryDates[i]).to.equal(expectedDate);
    }
  });

  it("should update delivery dates when count is decreased", async function () {
    const { contracts, accounts } = await loadFixture(deployFuturesFixture);
    const { futures } = contracts;
    const { owner } = accounts;

    // First increase count
    await futures.write.setFutureDeliveryDatesCount([5], {
      account: owner.account,
    });

    // Then decrease count
    const newCount = 2;
    await futures.write.setFutureDeliveryDatesCount([newCount], {
      account: owner.account,
    });

    const updatedDeliveryDates = await futures.read.getDeliveryDates();
    expect(updatedDeliveryDates.length).to.equal(newCount);

    // Verify dates are still correctly calculated
    const firstFutureDeliveryDate = await futures.read.firstFutureDeliveryDate();
    const deliveryIntervalDays = await futures.read.deliveryIntervalDays();
    const deliveryIntervalSeconds = BigInt(deliveryIntervalDays) * 86400n;

    for (let i = 0; i < updatedDeliveryDates.length; i++) {
      const expectedDate = firstFutureDeliveryDate + deliveryIntervalSeconds * BigInt(i);
      expect(updatedDeliveryDates[i]).to.equal(expectedDate);
    }
  });
});
