import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEventLogs, parseUnits, getAddress, zeroAddress } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployFuturesFixture } from "./fixtures";
import { catchError } from "../../lib";

describe("Futures Contract", function () {
  describe("Order Closing", function () {
    it("should allow order owner to close their order", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      // Create position
      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      const createTxHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: seller.account,
      });

      const createReceipt = await pc.waitForTransactionReceipt({ hash: createTxHash });
      const [createEvent] = parseEventLogs({
        logs: createReceipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      const orderId = createEvent.args.orderId;

      // Close position
      const closeTxHash = await futures.write.closeOrder([orderId], {
        account: seller.account,
      });

      const closeReceipt = await pc.waitForTransactionReceipt({ hash: closeTxHash });
      const [closeEvent] = parseEventLogs({
        logs: closeReceipt.logs,
        abi: futures.abi,
        eventName: "OrderClosed",
      });

      expect(closeEvent.args.orderId).to.equal(orderId);
      expect(getAddress(closeEvent.args.participant)).to.equal(getAddress(seller.account.address));
    });

    it("should reject closing order by non-owner", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      const createTxHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: seller.account,
      });

      const createReceipt = await pc.waitForTransactionReceipt({ hash: createTxHash });
      const [createEvent] = parseEventLogs({
        logs: createReceipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      const orderId = createEvent.args.orderId;

      // Try to close order with different account
      await catchError(futures.abi, "OrderNotBelongToSender", async () => {
        await futures.write.closeOrder([orderId], {
          account: buyer.account,
        });
      });
    });
  });

  describe("Margin Management", function () {
    it("should allow adding margin", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures, usdcMock } = contracts;
      const { seller, pc } = accounts;

      const sellerBalance1 = await futures.read.balanceOf([seller.account.address]);
      const futuresUsdcBalance1 = await usdcMock.read.balanceOf([futures.address]);

      const marginAmount = parseUnits("1000", 6); // $1000

      const txHash = await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Check balance
      const sellerBalance2 = await futures.read.balanceOf([seller.account.address]);
      expect(sellerBalance2).to.equal(sellerBalance1 + marginAmount);

      // Check USDC balance of futures contract
      const futuresUsdcBalance2 = await usdcMock.read.balanceOf([futures.address]);
      expect(futuresUsdcBalance2).to.equal(futuresUsdcBalance1 + marginAmount);
    });

    it("should allow removing margin when sufficient balance", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const marginAmount = parseUnits("1000", 6);
      const removeAmount = parseUnits("500", 6);

      // Add margin first
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });

      // Remove margin
      const txHash = await futures.write.removeMargin([removeAmount], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Check balance
      const balance = await futures.read.balanceOf([seller.account.address]);
      expect(balance).to.equal(marginAmount - removeAmount);
    });

    it("should reject removing margin when insufficient balance", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const marginAmount = parseUnits("1000", 6);
      const removeAmount = parseUnits("1500", 6);

      // Add margin first
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });

      // Try to remove more than balance
      await catchError(futures.abi, "ERC20InsufficientBalance", async () => {
        await futures.write.removeMargin([removeAmount], {
          account: seller.account,
        });
      });
    });

    it("should reject removing margin when below minimum required", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = await futures.read.getMarketPrice();
      const minMargin = await futures.read.getMinMarginForPosition([price, 1n]);
      const deliveryDate = config.deliveryDates[0];

      // Add margin
      await futures.write.addMargin([minMargin], {
        account: seller.account,
      });

      // Create order to require minimum margin
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });

      // Try to remove too much margin
      const removeAmount = 1n;
      await catchError(futures.abi, "InsufficientMarginBalance", async () => {
        await futures.write.removeMargin([removeAmount], {
          account: seller.account,
        });
      });
    });
  });

  describe("Minimum Margin Calculation", function () {
    it("should calculate minimum margin for orders", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = await futures.read.getMarketPrice();
      const [date1, date2] = config.deliveryDates;
      const marginAmount = price * BigInt(config.deliveryDurationDays);

      // Add margin first
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });

      // Create buy order
      await futures.write.createOrder([price, date1, "", 1], {
        account: seller.account,
      });

      const minMargin = await futures.read.getMinMargin([seller.account.address]);
      expect(minMargin > 0n).to.be.true;

      // Create a sell order
      await futures.write.createOrder([price, date2, "", -1], {
        account: seller.account,
      });

      const minMarginAfterShort = await futures.read.getMinMargin([seller.account.address]);
      expect(minMarginAfterShort > minMargin).to.be.true;
    });

    it("should calculate minimum margin for positions", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer } = accounts;

      const price = await futures.read.getMarketPrice();
      const deliveryDate = config.deliveryDates[0];
      const marginAmount = price * BigInt(config.deliveryDurationDays);

      // Add margin for both participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });

      // Create matching orders to form an position
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const sellerMinMargin = await futures.read.getMinMargin([seller.account.address]);
      const buyerMinMargin = await futures.read.getMinMargin([buyer.account.address]);

      expect(sellerMinMargin > 0n).to.be.true;
      expect(buyerMinMargin > 0n).to.be.true;
    });
  });

  describe("Position Management", function () {
    it("should not allow buyer to close position before start time", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates[0];
      const marginAmount = parseUnits("1000", 6);

      // Add margin for both participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });

      // Create matching orders to form an position
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [positionEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = positionEvent.args;

      await catchError(futures.abi, "PositionDeliveryNotStartedYet", async () => {
        await futures.write.closeDelivery([positionId, false], {
          account: buyer.account,
        });
      });
    });

    it("should not allow seller to close position before start time", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates[0];
      const marginAmount = parseUnits("1000", 6);

      // Add margin for both participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });

      // Create matching orders to form an position
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [createdEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = createdEvent.args;

      // Close position as seller
      await catchError(futures.abi, "PositionDeliveryNotStartedYet", async () => {
        await futures.write.closeDelivery([positionId, false], {
          account: seller.account,
        });
      });
    });

    it("should reject closing position by non-participant", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      // Create matching orders
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [createdEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = createdEvent.args;

      // Try to close order with different account
      await catchError(futures.abi, "OnlyValidatorOrPositionParticipant", async () => {
        await futures.write.closeDelivery([positionId, false], {
          account: buyer2.account,
        });
      });
    });

    it("should handle exiting positions", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      // setup margin for all participants
      await futures.write.addMargin([margin], { account: seller.account });
      await futures.write.addMargin([margin], { account: buyer.account });
      await futures.write.addMargin([margin], { account: buyer2.account });

      // Create matching orders, to create position
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [createdEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      // create another order, to exit position
      const newPrice = price * 2n;
      const createOrderTxHash = await futures.write.createOrder([newPrice, deliveryDate, "", -1], {
        account: buyer.account,
      });
      const createOrderReceipt = await pc.waitForTransactionReceipt({ hash: createOrderTxHash });
      const [order2CreatedEvent] = parseEventLogs({
        logs: createOrderReceipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });
      // match order by buyer2 thus exiting position for buyer
      const txHash2 = await futures.write.createOrder([newPrice, deliveryDate, "", 1], {
        account: buyer2.account,
      });

      const receipt2 = await pc.waitForTransactionReceipt({ hash: txHash2 });

      // old position closed event
      const [closedEvent] = parseEventLogs({
        logs: receipt2.logs,
        abi: futures.abi,
        eventName: "PositionClosed",
      });
      expect(closedEvent.args.positionId).to.equal(createdEvent.args.positionId);

      // new position created event
      const [createdEvent2] = parseEventLogs({
        logs: receipt2.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });
      expect(createdEvent2.args.seller).to.equal(getAddress(seller.account.address));
      expect(createdEvent2.args.buyer).to.equal(getAddress(buyer2.account.address));
      expect(createdEvent2.args.pricePerDay).to.equal(newPrice);
      expect(createdEvent2.args.deliveryAt).to.equal(deliveryDate);
      expect(createdEvent2.args.orderId).to.equal(order2CreatedEvent.args.orderId);
    });
  });

  describe("Validator Functions", function () {
    it("should allow validator to close position after start time", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, validator, pc, tc } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates[0];
      const marginAmount = parseUnits("1000", 6);

      // Add margin for both participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });

      // Create matching orders to form a position
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });
      const { positionId } = orderEvent.args;

      // Move time to after start time but before expiration
      await tc.setNextBlockTimestamp({ timestamp: deliveryDate + 1n }); // 1 day + 1 second

      // Close order as validator
      const closeTxHash = await futures.write.closeDelivery([positionId, true], {
        account: validator.account,
      });

      const closeReceipt = await pc.waitForTransactionReceipt({ hash: closeTxHash });
      const [closeEvent] = parseEventLogs({
        logs: closeReceipt.logs,
        abi: futures.abi,
        eventName: "PositionDeliveryClosed",
      });

      expect(closeEvent.args.positionId).to.equal(positionId);
      expect(getAddress(closeEvent.args.closedBy)).to.equal(getAddress(validator.account.address));
    });

    it("should reject validator closing position before start time", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, validator, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      // Create matching orders to form an position
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [createdEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = createdEvent.args;

      // Try to close order as validator before start time
      await catchError(futures.abi, "PositionDeliveryNotStartedYet", async () => {
        await futures.write.closeDelivery([positionId, true], {
          account: validator.account,
        });
      });
    });

    it("should reject non-validator from calling validator functions", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, pc, tc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      // Create matching positions to form an order
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = orderEvent.args;

      await tc.setNextBlockTimestamp({ timestamp: deliveryDate + 1n });

      // Try to close order as non-validator
      await catchError(futures.abi, "OnlyValidatorOrPositionParticipant", async () => {
        await futures.write.closeDelivery([positionId, true], {
          account: buyer2.account,
        });
      });
    });
  });

  describe("Margin Call", function () {
    it("should perform margin call when margin is insufficient", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures, btcPriceOracleMock } = contracts;
      const { seller, validator, pc } = accounts;

      const price = await futures.read.getMarketPrice();
      const minMargin = await futures.read.getMinMarginForPosition([price, 1n]);
      const deliveryDate = config.deliveryDates[0];

      // Add small margin
      await futures.write.addMargin([minMargin], {
        account: seller.account,
      });

      // Create order that requires more margin
      const tx = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: seller.account,
      });
      const rec = await pc.waitForTransactionReceipt({ hash: tx });
      const [createdEvent] = parseEventLogs({
        logs: rec.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });
      const { orderId } = createdEvent.args;

      // Increase bitcoin price
      await btcPriceOracleMock.write.setPrice([config.oracle.btcPrice * 2n, 8]);

      // Perform margin call
      const txHash = await futures.write.marginCall([seller.account.address], {
        account: validator.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Check for order closed event
      const [closedEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderClosed",
      });
      expect(closedEvent.args.orderId).to.equal(orderId);

      // Check that order was closed
      const order = await futures.read.getOrderById([orderId]);
      expect(order.participant).to.equal(zeroAddress);
    });

    it("should reject margin call by non-validator", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      // Create position
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: seller.account,
      });

      // Try to perform margin call as non-validator
      await catchError(futures.abi, "OnlyValidator", async () => {
        await futures.write.marginCall([seller.account.address], {
          account: seller.account,
        });
      });
    });
  });

  describe("Edge Cases and Limits", function () {
    it("should enforce maximum orders per participant", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const numOrders = await futures.read.MAX_ORDERS_PER_PARTICIPANT();
      const price = await futures.read.getMarketPrice();
      const margin = price * BigInt(config.deliveryDurationDays) * BigInt(numOrders);
      const deliveryDate = config.deliveryDates[0];

      // Add margin
      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create maximum number of positions (50)
      for (let i = 0; i < numOrders; i++) {
        await futures.write.createOrder(
          [price + BigInt(i) * config.priceLadderStep, deliveryDate, "", 1],
          { account: seller.account }
        );
      }

      // Try to create one more position
      await catchError(futures.abi, "MaxOrdersPerParticipantReached", async () => {
        await futures.write.createOrder(
          [price + 50n * config.priceLadderStep, deliveryDate, "", 1],
          { account: seller.account }
        );
      });
    });

    it("should handle expired positions", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc, tc } = accounts;

      const price = await futures.read.getMarketPrice();
      const margin = price * BigInt(config.deliveryDurationDays);
      const deliveryDate = config.deliveryDates[0];

      // Create matching positions to form an order
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = orderEvent.args;

      // Move time to after order expiration (30 days + 1 second)
      await tc.setNextBlockTimestamp({
        timestamp: deliveryDate + BigInt(config.deliveryDurationSeconds) + 1n,
      });

      // Try to close expired order
      await catchError(futures.abi, "PositionDeliveryExpired", async () => {
        await futures.write.closeDelivery([positionId, false], {
          account: buyer.account,
        });
      });
    });
  });
});
