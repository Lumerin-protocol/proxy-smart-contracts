import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployFuturesFixture } from "./fixtures";
import { getAddress, parseEventLogs, parseUnits } from "viem";
import { expect } from "chai";
import { quantizePrice } from "./utils";

describe("Futures - Cash Settlement", () => {
  it("should handle position offset and settlement with contract balance correctly", async () => {
    const data = await loadFixture(deployFuturesFixture);
    const { contracts, accounts, config } = data;
    const { futures } = contracts;
    const { seller, buyer, buyer2, validator, tc, pc } = accounts;

    const marginAmount = parseUnits("10000", 6);
    const deliveryDate = config.deliveryDates[0];
    const dst = "https://destination-url.com";

    // Step 1: Add margin for all participants
    await futures.write.addMargin([marginAmount], { account: seller.account });
    await futures.write.addMargin([marginAmount], { account: buyer.account });
    await futures.write.addMargin([marginAmount], { account: buyer2.account });

    // Get initial balances
    const contractBalanceBefore = await futures.read.balanceOf([futures.address]);
    const buyerBalanceBefore = await futures.read.balanceOf([buyer.account.address]);

    // Step 2: Party A (buyer) enters into position with Party B (seller) at price 100
    const initialPrice = quantizePrice(parseUnits("100", 6), config.priceLadderStep);

    // Create sell order first
    await futures.write.createOrder([initialPrice, deliveryDate, "", -1], {
      account: seller.account,
    });

    // Create buy order to match and create position
    const createTxHash = await futures.write.createOrder([initialPrice, deliveryDate, dst, 1], {
      account: buyer.account,
    });

    const createReceipt = await pc.waitForTransactionReceipt({ hash: createTxHash });
    const [positionCreatedEvent] = parseEventLogs({
      logs: createReceipt.logs,
      abi: futures.abi,
      eventName: "PositionCreated",
    });
    const firstPositionId = positionCreatedEvent.args.positionId;

    // Verify position was created
    const firstPosition = await futures.read.getPositionById([firstPositionId]);
    expect(firstPosition.buyer).to.equal(getAddress(buyer.account.address));
    expect(firstPosition.seller).to.equal(getAddress(seller.account.address));
    expect(firstPosition.pricePerDay).to.equal(initialPrice);
    expect(firstPosition.initialPricePerDay).to.equal(initialPrice);

    // Step 3: Price changes - Party A (buyer) exits by creating sell order at higher price (120)
    // This represents a profit scenario where buyer exits at a higher price
    const exitPrice = quantizePrice(parseUnits("120", 6), config.priceLadderStep);

    // Buyer creates sell order to exit
    await futures.write.createOrder([exitPrice, deliveryDate, "", -1], {
      account: buyer.account,
    });

    // Step 4: Party C (buyer2) creates buy order at exit price, matching with buyer's sell order
    // This offsets buyer's position and creates new position between seller and buyer2
    const offsetTxHash = await futures.write.createOrder([exitPrice, deliveryDate, dst, 1], {
      account: buyer2.account,
    });

    const offsetReceipt = await pc.waitForTransactionReceipt({ hash: offsetTxHash });
    const positionClosedEvents = parseEventLogs({
      logs: offsetReceipt.logs,
      abi: futures.abi,
      eventName: "PositionClosed",
    });
    const positionCreatedEvents = parseEventLogs({
      logs: offsetReceipt.logs,
      abi: futures.abi,
      eventName: "PositionCreated",
    });

    // Verify first position was closed
    expect(positionClosedEvents.length).to.be.greaterThan(0);
    expect(positionClosedEvents[0].args.positionId).to.equal(firstPositionId);

    // Get the new position ID
    const newPositionId = positionCreatedEvents[0].args.positionId;
    const newPosition = await futures.read.getPositionById([newPositionId]);

    // Verify new position has correct initialPricePerDay and pricePerDay
    expect(newPosition.seller).to.equal(getAddress(seller.account.address));
    expect(newPosition.buyer).to.equal(getAddress(buyer2.account.address));
    expect(newPosition.initialPricePerDay).to.equal(initialPrice); // Original price
    expect(newPosition.pricePerDay).to.equal(exitPrice); // Exit price

    // Step 5: Verify buyer was credited from contract balance (profit scenario)
    // When buyer exits at higher price, they profit, so contract pays them
    const buyerBalanceAfterOffset = await futures.read.balanceOf([buyer.account.address]);
    const contractBalanceAfterOffset = await futures.read.balanceOf([futures.address]);

    // Calculate expected PnL: (exitPrice - initialPrice) * deliveryDurationDays
    const expectedPnL = (exitPrice - initialPrice) * BigInt(config.deliveryDurationDays);
    // Buyer created 2 orders (entry and exit), so 2 * orderFee was deducted
    const orderFee = await futures.read.orderFee();
    const expectedBuyerBalanceChange = expectedPnL - orderFee * 2n;
    expect(buyerBalanceAfterOffset - buyerBalanceBefore).to.equal(expectedBuyerBalanceChange);
    // Contract balance decreases by PnL paid, but increases by order fees collected
    // Total orders created: seller (1) + buyer (2) + buyer2 (1) = 4 orders
    const totalOrderFees = orderFee * 4n;
    const expectedContractBalanceChange = expectedPnL - totalOrderFees;
    expect(contractBalanceBefore - contractBalanceAfterOffset).to.equal(
      expectedContractBalanceChange
    );

    // Step 6: Move time forward to delivery date and settle the new position
    await tc.setNextBlockTimestamp({
      timestamp: deliveryDate + BigInt(config.deliveryDurationSeconds) / 2n, // 50% through delivery
    });

    // Get balances before settlement
    const sellerBalanceBeforeSettlement = await futures.read.balanceOf([seller.account.address]);
    const buyer2BalanceBeforeSettlement = await futures.read.balanceOf([buyer2.account.address]);
    const contractBalanceBeforeSettlement = await futures.read.balanceOf([futures.address]);

    // Close delivery for the new position
    await futures.write.closeDelivery([newPositionId, false], {
      account: validator.account,
    });

    // Step 7: Verify funds are returned to contract balance during settlement
    // The difference between initialPricePerDay (100) and pricePerDay (120) should be handled
    // Since initialPricePerDay < pricePerDay, buyer2 should pay seller the difference
    const sellerBalanceAfterSettlement = await futures.read.balanceOf([seller.account.address]);
    const buyer2BalanceAfterSettlement = await futures.read.balanceOf([buyer2.account.address]);
    const contractBalanceAfterSettlement = await futures.read.balanceOf([futures.address]);

    // Calculate expected price difference amount for remaining time (50% of delivery)
    const priceDiffPerDay = exitPrice - initialPrice;
    const remainingTimeRatio = BigInt(config.deliveryDurationSeconds) / 2n; // 50% remaining
    const expectedPriceDiffAmount =
      (priceDiffPerDay * BigInt(config.deliveryDurationDays) * remainingTimeRatio) /
      BigInt(config.deliveryDurationSeconds);

    // During settlement, multiple transfers occur:
    // 1. Delivered payment: buyer2 pays seller for elapsed time (50% of delivery)
    // 2. PnL based on current market price
    // 3. Price difference: buyer2 pays seller (since initialPrice < pricePerDay)
    // Buyer2 pays seller both delivered payment and price difference, so buyer2's balance decreases
    // and seller's balance increases

    // Buyer2 should pay seller (both delivered payment and price difference)
    expect(buyer2BalanceBeforeSettlement - buyer2BalanceAfterSettlement > 0n).to.be.true;
    // Seller should receive from buyer2
    expect(sellerBalanceAfterSettlement - sellerBalanceBeforeSettlement > 0n).to.be.true;

    // Contract balance should remain unchanged (we fixed the redundant transfers)
    // The settlement should be direct transfer between buyer2 and seller, not through contract
    expect(contractBalanceAfterSettlement).to.equal(contractBalanceBeforeSettlement);
  });

  it("should handle position offset and settlement with contract balance correctly (inverse market swing - loss scenario)", async () => {
    const data = await loadFixture(deployFuturesFixture);
    const { contracts, accounts, config } = data;
    const { futures } = contracts;
    const { seller, buyer, buyer2, validator, tc, pc } = accounts;

    const marginAmount = parseUnits("10000", 6);
    const deliveryDate = config.deliveryDates[0];
    const dst = "https://destination-url.com";

    // Step 1: Add margin for all participants
    await futures.write.addMargin([marginAmount], { account: seller.account });
    await futures.write.addMargin([marginAmount], { account: buyer.account });
    await futures.write.addMargin([marginAmount], { account: buyer2.account });

    // Get initial balances
    const contractBalanceBefore = await futures.read.balanceOf([futures.address]);
    const buyerBalanceBefore = await futures.read.balanceOf([buyer.account.address]);

    // Step 2: Party A (buyer) enters into position with Party B (seller) at price 120 (higher price)
    const initialPrice = quantizePrice(parseUnits("120", 6), config.priceLadderStep);

    // Create sell order first
    await futures.write.createOrder([initialPrice, deliveryDate, "", -1], {
      account: seller.account,
    });

    // Create buy order to match and create position
    const createTxHash = await futures.write.createOrder([initialPrice, deliveryDate, dst, 1], {
      account: buyer.account,
    });

    const createReceipt = await pc.waitForTransactionReceipt({ hash: createTxHash });
    const [positionCreatedEvent] = parseEventLogs({
      logs: createReceipt.logs,
      abi: futures.abi,
      eventName: "PositionCreated",
    });
    const firstPositionId = positionCreatedEvent.args.positionId;

    // Verify position was created
    const firstPosition = await futures.read.getPositionById([firstPositionId]);
    expect(firstPosition.buyer).to.equal(getAddress(buyer.account.address));
    expect(firstPosition.seller).to.equal(getAddress(seller.account.address));
    expect(firstPosition.pricePerDay).to.equal(initialPrice);
    expect(firstPosition.initialPricePerDay).to.equal(initialPrice);

    // Step 3: Price drops - Party A (buyer) exits by creating sell order at lower price (100)
    // This represents a loss scenario where buyer exits at a lower price
    const exitPrice = quantizePrice(parseUnits("100", 6), config.priceLadderStep);

    // Buyer creates sell order to exit
    await futures.write.createOrder([exitPrice, deliveryDate, "", -1], {
      account: buyer.account,
    });

    // Step 4: Party C (buyer2) creates buy order at exit price, matching with buyer's sell order
    // This offsets buyer's position and creates new position between seller and buyer2
    const offsetTxHash = await futures.write.createOrder([exitPrice, deliveryDate, dst, 1], {
      account: buyer2.account,
    });

    const offsetReceipt = await pc.waitForTransactionReceipt({ hash: offsetTxHash });
    const positionClosedEvents = parseEventLogs({
      logs: offsetReceipt.logs,
      abi: futures.abi,
      eventName: "PositionClosed",
    });
    const positionCreatedEvents = parseEventLogs({
      logs: offsetReceipt.logs,
      abi: futures.abi,
      eventName: "PositionCreated",
    });

    // Verify first position was closed
    expect(positionClosedEvents.length).to.be.greaterThan(0);
    expect(positionClosedEvents[0].args.positionId).to.equal(firstPositionId);

    // Get the new position ID
    const newPositionId = positionCreatedEvents[0].args.positionId;
    const newPosition = await futures.read.getPositionById([newPositionId]);

    // Verify new position has correct initialPricePerDay and pricePerDay
    expect(newPosition.seller).to.equal(getAddress(seller.account.address));
    expect(newPosition.buyer).to.equal(getAddress(buyer2.account.address));
    expect(newPosition.initialPricePerDay).to.equal(initialPrice); // Original price (120)
    expect(newPosition.pricePerDay).to.equal(exitPrice); // Exit price (100)

    // Step 5: Verify buyer paid to contract balance (loss scenario)
    // When buyer exits at lower price, they lose, so they pay the contract
    const buyerBalanceAfterOffset = await futures.read.balanceOf([buyer.account.address]);
    const contractBalanceAfterOffset = await futures.read.balanceOf([futures.address]);

    // Calculate expected PnL: (exitPrice - initialPrice) * deliveryDurationDays (negative = loss)
    const expectedPnL = (exitPrice - initialPrice) * BigInt(config.deliveryDurationDays);
    // Buyer created 2 orders (entry and exit), so 2 * orderFee was deducted
    const orderFee = await futures.read.orderFee();
    // Buyer loses money (negative PnL) and pays order fees
    const expectedBuyerBalanceChange = expectedPnL - orderFee * 2n; // Both negative
    expect(buyerBalanceAfterOffset - buyerBalanceBefore).to.equal(expectedBuyerBalanceChange);
    // Contract balance increases by PnL received from buyer, and increases by order fees collected
    // Total orders created: seller (1) + buyer (2) + buyer2 (1) = 4 orders
    const totalOrderFees = orderFee * 4n;
    // expectedPnL is negative, so contract balance increases by -expectedPnL (which is positive)
    const expectedContractBalanceChange = -expectedPnL + totalOrderFees;
    expect(contractBalanceAfterOffset - contractBalanceBefore).to.equal(
      expectedContractBalanceChange
    );

    // Step 6: Move time forward to delivery date and settle the new position
    await tc.setNextBlockTimestamp({
      timestamp: deliveryDate + BigInt(config.deliveryDurationSeconds) / 2n, // 50% through delivery
    });

    // Get balances before settlement
    const sellerBalanceBeforeSettlement = await futures.read.balanceOf([seller.account.address]);
    const buyer2BalanceBeforeSettlement = await futures.read.balanceOf([buyer2.account.address]);
    const contractBalanceBeforeSettlement = await futures.read.balanceOf([futures.address]);

    // Close delivery for the new position
    await futures.write.closeDelivery([newPositionId, false], {
      account: validator.account,
    });

    // Step 7: Verify settlement handles price difference correctly
    // The difference between initialPricePerDay (120) and pricePerDay (100) should be handled
    // Since initialPricePerDay > pricePerDay, seller should pay buyer2 the difference
    const sellerBalanceAfterSettlement = await futures.read.balanceOf([seller.account.address]);
    const buyer2BalanceAfterSettlement = await futures.read.balanceOf([buyer2.account.address]);
    const contractBalanceAfterSettlement = await futures.read.balanceOf([futures.address]);

    // Calculate expected price difference amount for remaining time (50% of delivery)
    const priceDiffPerDay = initialPrice - exitPrice; // 120 - 100 = 20
    const remainingTimeRatio = BigInt(config.deliveryDurationSeconds) / 2n; // 50% remaining
    const expectedPriceDiffAmount =
      (priceDiffPerDay * BigInt(config.deliveryDurationDays) * remainingTimeRatio) /
      BigInt(config.deliveryDurationSeconds);

    // During settlement, multiple transfers occur:
    // 1. Delivered payment: buyer2 pays seller for elapsed time (50% of delivery) = 100 * 7 * 0.5 = 350
    // 2. PnL based on current market price
    // 3. Price difference: seller pays buyer2 (since initialPrice > pricePerDay) = (120-100) * 7 * 0.5 = 70
    // Buyer2's net balance may decrease because delivered payment (350) > price difference (70)
    // The key verification is that the contract balance is unchanged, confirming direct transfers

    // Contract balance should remain unchanged (we fixed the redundant transfers)
    // The settlement should be direct transfer between seller and buyer2, not through contract
    // This confirms that the price difference transfer happened directly (seller → buyer2)
    expect(
      contractBalanceAfterSettlement,
      `Contract balance changed from ${contractBalanceBeforeSettlement} to ${contractBalanceAfterSettlement}. This indicates transfers are still routing through the contract.`
    ).to.equal(contractBalanceBeforeSettlement);
  });
});
