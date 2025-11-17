import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEventLogs, parseUnits, getAddress } from "viem";
import { deployFuturesFixture } from "./fixtures";
import { catchError } from "../../lib";
import { quantizePrice } from "./utils";

describe("Futures Delivery Payment", function () {
  describe("depositDeliveryPayment", function () {
    it("should allow buyer to deposit delivery payment before delivery date", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures, usdcMock } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const totalPayment = price * BigInt(config.deliveryDurationDays);

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
      const txHash = await futures.write.createOrder([price, deliveryDate, "https://dest.com", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [positionEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = positionEvent.args;

      // Check initial balances
      const buyerBalanceBefore = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceBefore = await futures.read.balanceOf([futures.address]);

      // Deposit delivery payment
      const depositTxHash = await futures.write.depositDeliveryPayment(
        [totalPayment, deliveryDate],
        { account: buyer.account }
      );

      const depositReceipt = await pc.waitForTransactionReceipt({ hash: depositTxHash });
      expect(depositReceipt.status).to.equal("success");

      // Check balances after deposit
      const buyerBalanceAfter = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceAfter = await futures.read.balanceOf([futures.address]);

      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore - totalPayment);
      expect(contractBalanceAfter).to.equal(contractBalanceBefore + totalPayment);

      // Check that position is marked as paid
      const position = await futures.read.getPositionById([positionId]);
      expect(position.paid).to.equal(true);
    });

    it("should reject deposit after delivery date has passed", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc, tc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const totalPayment = price * BigInt(config.deliveryDurationDays);

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
      await futures.write.createOrder([price, deliveryDate, "https://dest.com", 1], {
        account: buyer.account,
      });

      // Move time past delivery date
      await tc.setNextBlockTimestamp({ timestamp: deliveryDate + 1n });

      // Try to deposit after delivery date
      await catchError(futures.abi, "DeliveryDateExpired", async () => {
        await futures.write.depositDeliveryPayment([totalPayment, deliveryDate], {
          account: buyer.account,
        });
      });
    });

    it("should handle multiple positions for same delivery date", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, pc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const totalPayment = price * BigInt(config.deliveryDurationDays);

      // Add margin for all participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer2.account,
      });

      // Create first position: seller with buyer
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash1 = await futures.write.createOrder(
        [price, deliveryDate, "https://dest1.com", 1],
        { account: buyer.account }
      );

      // Create second position: seller with buyer2
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: buyer2.account,
      });
      const txHash2 = await futures.write.createOrder(
        [price, deliveryDate, "https://dest2.com", 1],
        { account: buyer.account }
      );

      const receipt1 = await pc.waitForTransactionReceipt({ hash: txHash1 });
      const [positionEvent1] = parseEventLogs({
        logs: receipt1.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const receipt2 = await pc.waitForTransactionReceipt({ hash: txHash2 });
      const [positionEvent2] = parseEventLogs({
        logs: receipt2.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const buyerBalanceBefore = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceBefore = await futures.read.balanceOf([futures.address]);

      // Deposit payment for both positions (buyer has one position)
      await futures.write.depositDeliveryPayment([totalPayment * 2n, deliveryDate], {
        account: buyer.account,
      });

      const buyerBalanceAfter = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceAfter = await futures.read.balanceOf([futures.address]);

      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore - totalPayment * 2n);
      expect(contractBalanceAfter).to.equal(contractBalanceBefore + totalPayment * 2n);

      // Check that buyer's position is marked as paid
      const position1 = await futures.read.getPositionById([positionEvent1.args.positionId]);
      expect(position1.paid).to.equal(true);

      // Check that buyer2's position is not paid
      const position2 = await futures.read.getPositionById([positionEvent2.args.positionId]);
      expect(position2.paid).to.equal(true);
    });

    it("should only process positions where caller is the buyer", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, pc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const totalPayment = price * BigInt(config.deliveryDurationDays);

      // Add margin for all participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer2.account,
      });

      // Create position where buyer is the buyer
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash1 = await futures.write.createOrder(
        [price, deliveryDate, "https://dest1.com", 1],
        {
          account: buyer.account,
        }
      );

      // Create position where buyer2 is the buyer
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash2 = await futures.write.createOrder(
        [price, deliveryDate, "https://dest2.com", 1],
        {
          account: buyer2.account,
        }
      );

      const receipt1 = await pc.waitForTransactionReceipt({ hash: txHash1 });
      const [positionEvent1] = parseEventLogs({
        logs: receipt1.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const receipt2 = await pc.waitForTransactionReceipt({ hash: txHash2 });
      const [positionEvent2] = parseEventLogs({
        logs: receipt2.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      // Buyer deposits payment - should only affect buyer's position
      await futures.write.depositDeliveryPayment([totalPayment, deliveryDate], {
        account: buyer.account,
      });

      const position1 = await futures.read.getPositionById([positionEvent1.args.positionId]);
      const position2 = await futures.read.getPositionById([positionEvent2.args.positionId]);

      expect(position1.paid).to.equal(true);
      expect(position2.paid).to.equal(false);
    });

    it("should stop processing if amount is insufficient for a position", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const totalPayment = price * BigInt(config.deliveryDurationDays);

      // Add margin for both participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });

      // Create two positions for buyer
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      await futures.write.createOrder([price, deliveryDate, "https://dest1.com", 1], {
        account: buyer.account,
      });

      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      await futures.write.createOrder([price, deliveryDate, "https://dest2.com", 1], {
        account: buyer.account,
      });

      // Try to deposit less than required for both positions
      const insufficientAmount = totalPayment; // Only enough for one position
      await futures.write.depositDeliveryPayment([insufficientAmount, deliveryDate], {
        account: buyer.account,
      });

      // Should have processed only one position
      // We can't easily check which one, but we can verify the contract balance increased
      const contractBalance = await futures.read.balanceOf([futures.address]);
      expect(contractBalance > insufficientAmount).to.be.true;
    });
  });

  describe("withdrawDeliveryPayment", function () {
    it("should allow seller to withdraw delivery payment after delivery finished", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc, tc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const totalPayment = price * BigInt(config.deliveryDurationDays);

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
      const txHash = await futures.write.createOrder([price, deliveryDate, "https://dest.com", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [positionEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = positionEvent.args;

      // Buyer deposits payment
      await futures.write.depositDeliveryPayment([totalPayment, deliveryDate], {
        account: buyer.account,
      });

      // Move time past delivery end
      const deliveryEndTime = deliveryDate + BigInt(config.deliveryDurationSeconds);
      await tc.setNextBlockTimestamp({ timestamp: deliveryEndTime + 1n });

      // Check balances before withdrawal
      const sellerBalanceBefore = await futures.read.balanceOf([seller.account.address]);
      const contractBalanceBefore = await futures.read.balanceOf([futures.address]);

      // Seller withdraws payment
      const withdrawTxHash = await futures.write.withdrawDeliveryPayment([deliveryDate], {
        account: seller.account,
      });

      const withdrawReceipt = await pc.waitForTransactionReceipt({ hash: withdrawTxHash });
      expect(withdrawReceipt.status).to.equal("success");

      // Check balances after withdrawal
      const sellerBalanceAfter = await futures.read.balanceOf([seller.account.address]);
      const contractBalanceAfter = await futures.read.balanceOf([futures.address]);

      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + totalPayment);
      expect(contractBalanceAfter).to.equal(contractBalanceBefore - totalPayment);

      // Check that position is marked as not paid
      const position = await futures.read.getPositionById([positionId]);
      expect(position.paid).to.equal(false);
    });

    it("should reject withdrawal before delivery is finished", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc, tc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const totalPayment = price * BigInt(config.deliveryDurationDays);

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
      await futures.write.createOrder([price, deliveryDate, "https://dest.com", 1], {
        account: buyer.account,
      });

      // Buyer deposits payment
      await futures.write.depositDeliveryPayment([totalPayment, deliveryDate], {
        account: buyer.account,
      });

      // Move time to during delivery (but not finished)
      const deliveryEndTime = deliveryDate + BigInt(config.deliveryDurationSeconds);
      await tc.setNextBlockTimestamp({ timestamp: deliveryEndTime - 1n });

      // Try to withdraw before delivery finished
      await catchError(futures.abi, "DeliveryNotFinishedYet", async () => {
        await futures.write.withdrawDeliveryPayment([deliveryDate], {
          account: seller.account,
        });
      });
    });

    it("should only allow seller to withdraw their own positions", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, pc, tc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const totalPayment = price * BigInt(config.deliveryDurationDays);

      // Add margin for all participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer2.account,
      });

      // Create position: seller with buyer
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash1 = await futures.write.createOrder(
        [price, deliveryDate, "https://dest1.com", 1],
        { account: buyer.account }
      );

      // Create position: buyer2 as seller with buyer
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: buyer2.account,
      });
      const txHash2 = await futures.write.createOrder(
        [price, deliveryDate, "https://dest2.com", 1],
        { account: buyer.account }
      );

      const receipt1 = await pc.waitForTransactionReceipt({ hash: txHash1 });
      const [positionEvent1] = parseEventLogs({
        logs: receipt1.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const receipt2 = await pc.waitForTransactionReceipt({ hash: txHash2 });
      const [positionEvent2] = parseEventLogs({
        logs: receipt2.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      // Buyer deposits payment for both positions
      await futures.write.depositDeliveryPayment([totalPayment * 2n, deliveryDate], {
        account: buyer.account,
      });

      // Move time past delivery end
      const deliveryEndTime = deliveryDate + BigInt(config.deliveryDurationSeconds);
      await tc.setNextBlockTimestamp({ timestamp: deliveryEndTime + 1n });

      const sellerBalanceBefore = await futures.read.balanceOf([seller.account.address]);
      const buyer2BalanceBefore = await futures.read.balanceOf([buyer2.account.address]);

      // Seller withdraws - should only get payment for their position
      await futures.write.withdrawDeliveryPayment([deliveryDate], {
        account: seller.account,
      });

      const sellerBalanceAfter = await futures.read.balanceOf([seller.account.address]);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + totalPayment);

      // Buyer2 withdraws - should get payment for their position
      await futures.write.withdrawDeliveryPayment([deliveryDate], {
        account: buyer2.account,
      });

      const buyer2BalanceAfter = await futures.read.balanceOf([buyer2.account.address]);
      expect(buyer2BalanceAfter).to.equal(buyer2BalanceBefore + totalPayment);
    });

    it("should only withdraw positions that are marked as paid", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, pc, tc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const totalPayment = price * BigInt(config.deliveryDurationDays);

      // Add margin for all participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer2.account,
      });

      // Create position: seller with buyer (will be paid)
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash1 = await futures.write.createOrder(
        [price, deliveryDate, "https://dest1.com", 1],
        { account: buyer.account }
      );

      // Create position: seller with buyer2 (will NOT be paid)
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });
      const txHash2 = await futures.write.createOrder(
        [price, deliveryDate, "https://dest2.com", 1],
        { account: buyer2.account }
      );

      const receipt1 = await pc.waitForTransactionReceipt({ hash: txHash1 });
      const [positionEvent1] = parseEventLogs({
        logs: receipt1.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const receipt2 = await pc.waitForTransactionReceipt({ hash: txHash2 });
      const [positionEvent2] = parseEventLogs({
        logs: receipt2.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      // Only buyer deposits payment (buyer2 does not)
      await futures.write.depositDeliveryPayment([totalPayment, deliveryDate], {
        account: buyer.account,
      });

      // Move time past delivery end
      const deliveryEndTime = deliveryDate + BigInt(config.deliveryDurationSeconds);
      await tc.setNextBlockTimestamp({ timestamp: deliveryEndTime + 1n });

      const sellerBalanceBefore = await futures.read.balanceOf([seller.account.address]);

      // Seller withdraws - should only get payment for paid position
      await futures.write.withdrawDeliveryPayment([deliveryDate], {
        account: seller.account,
      });

      const sellerBalanceAfter = await futures.read.balanceOf([seller.account.address]);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + totalPayment);

      // Verify only one position was marked as paid
      const position1 = await futures.read.getPositionById([positionEvent1.args.positionId]);
      const position2 = await futures.read.getPositionById([positionEvent2.args.positionId]);
      expect(position1.paid).to.equal(false); // Withdrawn, so marked as not paid
      expect(position2.paid).to.equal(false); // Never paid
    });
  });

  describe("Cash Settlement when buyer doesn't deposit", function () {
    it("should allow cash settlement via closeDelivery when buyer didn't deposit", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, validator, pc, tc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

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
      const txHash = await futures.write.createOrder([price, deliveryDate, "https://dest.com", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [positionEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = positionEvent.args;

      // Buyer does NOT deposit payment
      // Position should remain unpaid
      const positionBefore = await futures.read.getPositionById([positionId]);
      expect(positionBefore.paid).to.equal(false);

      // Move time to during delivery
      await tc.setNextBlockTimestamp({ timestamp: deliveryDate + 1n });

      // Close delivery via cash settlement (validator blames seller)
      const sellerBalanceBefore = await futures.read.balanceOf([seller.account.address]);
      const buyerBalanceBefore = await futures.read.balanceOf([buyer.account.address]);

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

      // Check that balances changed due to cash settlement
      const sellerBalanceAfter = await futures.read.balanceOf([seller.account.address]);
      const buyerBalanceAfter = await futures.read.balanceOf([buyer.account.address]);

      // Balances should have changed (cash settlement occurred)
      expect(sellerBalanceBefore !== sellerBalanceAfter || buyerBalanceBefore !== buyerBalanceAfter)
        .to.be.true;
    });

    it("should allow buyer to close delivery via cash settlement when they didn't deposit", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc, tc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

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
      const txHash = await futures.write.createOrder([price, deliveryDate, "https://dest.com", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [positionEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = positionEvent.args;

      // Buyer does NOT deposit payment
      // Move time to during delivery
      await tc.setNextBlockTimestamp({ timestamp: deliveryDate + 1n });

      // Buyer closes delivery via cash settlement (blames seller)
      const closeTxHash = await futures.write.closeDelivery([positionId, true], {
        account: buyer.account,
      });

      const closeReceipt = await pc.waitForTransactionReceipt({ hash: closeTxHash });
      const [closeEvent] = parseEventLogs({
        logs: closeReceipt.logs,
        abi: futures.abi,
        eventName: "PositionDeliveryClosed",
      });

      expect(closeEvent.args.positionId).to.equal(positionId);
      expect(getAddress(closeEvent.args.closedBy)).to.equal(getAddress(buyer.account.address));
    });

    it("should allow seller to close delivery via cash settlement when buyer didn't deposit", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc, tc } = accounts;

      const price = await futures.read.getMarketPrice();
      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

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
      const txHash = await futures.write.createOrder([price, deliveryDate, "https://dest.com", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [positionEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const { positionId } = positionEvent.args;

      // Buyer does NOT deposit payment
      // Move time to during delivery
      await tc.setNextBlockTimestamp({ timestamp: deliveryDate + 1n });

      // Seller closes delivery via cash settlement (blames buyer)
      const closeTxHash = await futures.write.closeDelivery([positionId, false], {
        account: seller.account,
      });

      const closeReceipt = await pc.waitForTransactionReceipt({ hash: closeTxHash });
      const [closeEvent] = parseEventLogs({
        logs: closeReceipt.logs,
        abi: futures.abi,
        eventName: "PositionDeliveryClosed",
      });

      expect(closeEvent.args.positionId).to.equal(positionId);
      expect(getAddress(closeEvent.args.closedBy)).to.equal(getAddress(seller.account.address));
    });
  });

  describe("Position offset with delivery payment", function () {
    it("should credit buyer from delivery payment when position is offset (profit scenario)", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, validator, tc, pc } = accounts;

      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const dst = "https://destination-url.com";

      // Step 1: Add margin for all participants
      await futures.write.addMargin([marginAmount], { account: seller.account });
      await futures.write.addMargin([marginAmount], { account: buyer.account });
      await futures.write.addMargin([marginAmount], { account: buyer2.account });

      // Step 2: Party A (buyer) enters into position with Party B (seller) at price 100
      const initialPrice = quantizePrice(parseUnits("100", 6), config.priceLadderStep);
      const totalPayment = initialPrice * BigInt(config.deliveryDurationDays);

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

      // Step 3: Buyer deposits delivery payment (this goes to contract)
      const buyerBalanceBeforeDeposit = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceBeforeDeposit = await futures.read.balanceOf([futures.address]);

      await futures.write.depositDeliveryPayment([totalPayment, deliveryDate], {
        account: buyer.account,
      });

      const buyerBalanceAfterDeposit = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceAfterDeposit = await futures.read.balanceOf([futures.address]);

      // Verify delivery payment was deposited
      expect(buyerBalanceAfterDeposit).to.equal(buyerBalanceBeforeDeposit - totalPayment);
      expect(contractBalanceAfterDeposit).to.equal(contractBalanceBeforeDeposit + totalPayment);

      const positionAfterDeposit = await futures.read.getPositionById([firstPositionId]);
      expect(positionAfterDeposit.paid).to.equal(true);

      // Step 4: Price changes - Party A (buyer) exits by creating sell order at higher price (120)
      // This represents a profit scenario where buyer exits at a higher price
      const exitPrice = quantizePrice(parseUnits("120", 6), config.priceLadderStep);

      // Buyer creates sell order to exit
      await futures.write.createOrder([exitPrice, deliveryDate, "", -1], {
        account: buyer.account,
      });

      // Step 5: Party C (buyer2) creates buy order at exit price, matching with buyer's sell order
      // This offsets buyer's position and creates new position between seller and buyer2
      const buyerBalanceBeforeOffset = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceBeforeOffset = await futures.read.balanceOf([futures.address]);

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

      // Step 6: Verify buyer was credited from delivery payment (not from reserve pool)
      // When buyer exits at higher price, they profit, so contract pays them from delivery payment
      const buyerBalanceAfterOffset = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceAfterOffset = await futures.read.balanceOf([futures.address]);

      // Calculate expected PnL: (exitPrice - initialPrice) * deliveryDurationDays
      const expectedPnL = (exitPrice - initialPrice) * BigInt(config.deliveryDurationDays);
      const orderFee = await futures.read.orderFee();
      // buyerBalanceBeforeOffset is measured after exit order is created, so both order fees are already deducted
      // The offset only adds PnL, so the change should be just PnL
      const expectedBuyerBalanceChange = expectedPnL;

      expect(buyerBalanceAfterOffset - buyerBalanceBeforeOffset).to.equal(
        expectedBuyerBalanceChange
      );

      // Contract balance should decrease by PnL (paid from delivery payment)
      // contractBalanceBeforeOffset already includes: delivery payment + 3 order fees (seller, buyer entry, buyer exit)
      // When buyer2 creates order, only buyer2's order fee is added (1 order fee)
      // So the change is: -PnL + buyer2's order fee
      const expectedContractBalanceChange = -expectedPnL + orderFee;
      expect(contractBalanceAfterOffset - contractBalanceBeforeOffset).to.equal(
        expectedContractBalanceChange
      );

      // Verify that the delivery payment was used (contract balance decreased by PnL)
      // Between deposit and offset: buyer exit order fee + buyer2 order fee were added, PnL was paid out
      // So the difference should be: PnL - 2 order fees (buyer exit + buyer2)
      expect(contractBalanceAfterOffset < contractBalanceAfterDeposit).to.be.true;
      expect(contractBalanceAfterDeposit - contractBalanceAfterOffset).to.equal(
        expectedPnL - orderFee * 2n
      );

      // Step 7: Move time forward and settle the new position
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

      // Step 8: Verify settlement handles price difference correctly
      // The difference between initialPricePerDay (100) and pricePerDay (120) should be handled
      // Since initialPricePerDay < pricePerDay, buyer2 should pay seller the difference
      const sellerBalanceAfterSettlement = await futures.read.balanceOf([seller.account.address]);
      const buyer2BalanceAfterSettlement = await futures.read.balanceOf([buyer2.account.address]);
      const contractBalanceAfterSettlement = await futures.read.balanceOf([futures.address]);

      // During settlement, multiple transfers occur:
      // 1. Delivered payment: buyer2 pays seller for elapsed time (50% of delivery)
      // 2. PnL based on current market price
      // 3. Price difference: buyer2 pays seller (since initialPrice < pricePerDay)
      // Buyer2 pays seller both delivered payment and price difference

      // Buyer2 should pay seller (both delivered payment and price difference)
      expect(buyer2BalanceBeforeSettlement - buyer2BalanceAfterSettlement > 0n).to.be.true;
      // Seller should receive from buyer2
      expect(sellerBalanceAfterSettlement - sellerBalanceBeforeSettlement > 0n).to.be.true;

      // Contract balance should remain unchanged during settlement (direct transfers)
      expect(contractBalanceAfterSettlement).to.equal(contractBalanceBeforeSettlement);
    });

    it("should credit buyer from delivery payment when position is offset (loss scenario)", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, validator, tc, pc } = accounts;

      const marginAmount = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const dst = "https://destination-url.com";

      // Step 1: Add margin for all participants
      await futures.write.addMargin([marginAmount], { account: seller.account });
      await futures.write.addMargin([marginAmount], { account: buyer.account });
      await futures.write.addMargin([marginAmount], { account: buyer2.account });

      // Step 2: Party A (buyer) enters into position with Party B (seller) at price 120 (higher price)
      const initialPrice = quantizePrice(parseUnits("120", 6), config.priceLadderStep);
      const totalPayment = initialPrice * BigInt(config.deliveryDurationDays);

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

      // Step 3: Buyer deposits delivery payment (this goes to contract)
      const buyerBalanceBeforeDeposit = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceBeforeDeposit = await futures.read.balanceOf([futures.address]);

      await futures.write.depositDeliveryPayment([totalPayment, deliveryDate], {
        account: buyer.account,
      });

      const buyerBalanceAfterDeposit = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceAfterDeposit = await futures.read.balanceOf([futures.address]);

      // Verify delivery payment was deposited
      expect(buyerBalanceAfterDeposit).to.equal(buyerBalanceBeforeDeposit - totalPayment);
      expect(contractBalanceAfterDeposit).to.equal(contractBalanceBeforeDeposit + totalPayment);

      const positionAfterDeposit = await futures.read.getPositionById([firstPositionId]);
      expect(positionAfterDeposit.paid).to.equal(true);

      // Step 4: Price drops - Party A (buyer) exits by creating sell order at lower price (100)
      // This represents a loss scenario where buyer exits at a lower price
      const exitPrice = quantizePrice(parseUnits("100", 6), config.priceLadderStep);

      // Buyer creates sell order to exit
      await futures.write.createOrder([exitPrice, deliveryDate, "", -1], {
        account: buyer.account,
      });

      // Step 5: Party C (buyer2) creates buy order at exit price, matching with buyer's sell order
      // This offsets buyer's position and creates new position between seller and buyer2
      const buyerBalanceBeforeOffset = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceBeforeOffset = await futures.read.balanceOf([futures.address]);

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

      // Step 6: Verify buyer paid to contract (loss scenario)
      // When buyer exits at lower price, they lose, so they pay the contract
      // This payment goes to the delivery payment pool
      const buyerBalanceAfterOffset = await futures.read.balanceOf([buyer.account.address]);
      const contractBalanceAfterOffset = await futures.read.balanceOf([futures.address]);

      // Calculate expected PnL: (exitPrice - initialPrice) * deliveryDurationDays (negative = loss)
      const expectedPnL = (exitPrice - initialPrice) * BigInt(config.deliveryDurationDays);
      const orderFee = await futures.read.orderFee();
      // buyerBalanceBeforeOffset is measured after exit order is created, so both order fees are already deducted
      // The offset only adds/subtracts PnL, so the change should be just PnL
      const expectedBuyerBalanceChange = expectedPnL;

      expect(buyerBalanceAfterOffset - buyerBalanceBeforeOffset).to.equal(
        expectedBuyerBalanceChange
      );

      // Contract balance increases by PnL received from buyer (goes to delivery payment pool)
      // contractBalanceBeforeOffset already includes: delivery payment + 3 order fees (seller, buyer entry, buyer exit)
      // When buyer2 creates order, only buyer2's order fee is added (1 order fee)
      // So the change is: -expectedPnL (which is negative, so +|expectedPnL|) + buyer2's order fee
      const expectedContractBalanceChange = -expectedPnL + orderFee;
      expect(contractBalanceAfterOffset - contractBalanceBeforeOffset).to.equal(
        expectedContractBalanceChange
      );

      // Verify that the delivery payment pool increased (buyer paid their loss to it)
      // Between deposit and offset: buyer exit order fee + buyer2 order fee were added, buyer paid loss
      // So the difference should be: -expectedPnL (which is negative, so +|expectedPnL|) + 2 order fees
      expect(contractBalanceAfterOffset > contractBalanceAfterDeposit).to.be.true;
      expect(contractBalanceAfterOffset - contractBalanceAfterDeposit).to.equal(
        -expectedPnL + orderFee * 2n
      );

      // Step 7: Move time forward and settle the new position
      await tc.setNextBlockTimestamp({
        timestamp: deliveryDate + BigInt(config.deliveryDurationSeconds) / 2n, // 50% through delivery
      });

      // Get balances before settlement
      const contractBalanceBeforeSettlement = await futures.read.balanceOf([futures.address]);

      // Close delivery for the new position
      await futures.write.closeDelivery([newPositionId, false], {
        account: validator.account,
      });

      // Step 8: Verify settlement handles price difference correctly
      // The difference between initialPricePerDay (120) and pricePerDay (100) should be handled
      // Since initialPricePerDay > pricePerDay, seller should pay buyer2 the difference
      const contractBalanceAfterSettlement = await futures.read.balanceOf([futures.address]);

      // During settlement, multiple transfers occur:
      // 1. Delivered payment: buyer2 pays seller for elapsed time (50% of delivery) = 100 * 7 * 0.5 = 350
      // 2. PnL based on current market price
      // 3. Price difference: seller pays buyer2 (since initialPrice > pricePerDay) = (120-100) * 7 * 0.5 = 70
      // Buyer2's net balance may decrease because delivered payment (350) > price difference (70)
      // The key verification is that the contract balance is unchanged, confirming direct transfers

      // Contract balance should remain unchanged during settlement (direct transfers)
      // This confirms that the price difference transfer happened directly (seller → buyer2)
      expect(contractBalanceAfterSettlement).to.equal(contractBalanceBeforeSettlement);
    });
  });
});
