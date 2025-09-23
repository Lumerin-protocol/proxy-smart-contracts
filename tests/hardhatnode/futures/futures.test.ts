import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { viem } from "hardhat";
import { parseEventLogs, parseUnits, getAddress, zeroAddress } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployFuturesFixture } from "./fixtures";
import { catchError } from "../../lib";

describe("Futures Contract", function () {
  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { owner } = accounts;

      // Check token address
      const tokenAddress = await futures.read.token();
      expect(getAddress(tokenAddress)).to.equal(getAddress(contracts.usdcMock.address));

      // Check hashrate oracle address
      const oracleAddress = await futures.read.hashrateOracle();
      expect(getAddress(oracleAddress)).to.equal(getAddress(contracts.hashrateOracle.address));

      // Check validator address
      const validatorAddress = await futures.read.validatorAddress();
      expect(getAddress(validatorAddress)).to.equal(getAddress(accounts.validator.account.address));

      // Check margin percentages
      const sellerMargin = await futures.read.sellerLiquidationMarginPercent();
      const buyerMargin = await futures.read.buyerLiquidationMarginPercent();
      expect(sellerMargin).to.equal(config.sellerLiquidationMarginPercent);
      expect(buyerMargin).to.equal(config.buyerLiquidationMarginPercent);

      // Check speed
      const speed = await futures.read.speedHps();
      expect(speed).to.equal(config.speedHps);

      // Check delivery duration
      const deliveryDuration = await futures.read.deliveryDurationSeconds();
      expect(deliveryDuration).to.equal(30 * 24 * 3600); // 30 days

      // Check breach penalty rate
      const breachPenaltyRate = await futures.read.breachPenaltyRatePerDay();
      expect(breachPenaltyRate).to.equal(parseUnits("0.01", 18)); // 1%
    });

    it("should have correct ERC20 token details", async function () {
      const { contracts } = await loadFixture(deployFuturesFixture);
      const { futures, usdcMock } = contracts;

      const usdcSymbol = await usdcMock.read.symbol();

      const name = await futures.read.name();
      const symbol = await futures.read.symbol();
      const decimals = await futures.read.decimals();

      expect(name).to.equal(`Lumerin Futures ${usdcSymbol}`);
      expect(symbol).to.equal(`w${usdcSymbol}`);
      expect(decimals).to.equal(6);
    });
  });

  describe("Delivery Date Management", function () {
    it("should allow owner to add delivery dates", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { owner, pc } = accounts;

      const currentTime = await pc
        .getBlock({ blockTag: "latest" })
        .then((block) => block.timestamp);
      const newDeliveryDate = currentTime + 86400n * 7n; // 7 days from now

      const oldDeliveryDatesLength = await futures.read.deliveryDatesLength();

      const txHash = await futures.write.addDeliveryDate([newDeliveryDate], {
        account: owner.account,
      });

      const receipt = await accounts.pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Check that delivery date was added
      const length = await futures.read.deliveryDatesLength();
      expect(length).to.equal(oldDeliveryDatesLength + 1n);

      const addedDate = await futures.read.deliveryDateByIndex([length - 1n]);
      expect(addedDate).to.equal(newDeliveryDate);
    });

    it("should reject adding delivery date in the past", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { owner, pc } = accounts;

      const currentTime = await pc
        .getBlock({ blockTag: "latest" })
        .then((block) => block.timestamp);
      const pastDate = currentTime - 86400n; // 1 day ago

      await catchError(futures.abi, "DeliveryDateShouldBeInTheFuture", async () => {
        await futures.write.addDeliveryDate([pastDate], {
          account: owner.account,
        });
      });
    });

    it("should reject non-owner from adding delivery dates", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const currentTime = await time.latest();
      const newDeliveryDate = BigInt(currentTime) + 86400n * 7n;

      await catchError(futures.abi, "OwnableUnauthorizedAccount", async () => {
        await futures.write.addDeliveryDate([newDeliveryDate], {
          account: seller.account,
        });
      });
    });
  });

  describe("Position Creation", function () {
    it("should create a long position when no matching short position exists", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6); // $100
      const margin = parseUnits("10000", 6);
      const deliveryDate = BigInt(config.deliveryDates.date1);
      const isBuy = true;

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      const txHash = await futures.write.createPosition([price, deliveryDate, isBuy], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      expect(event.args.positionId).to.not.be.undefined;
      expect(getAddress(event.args.participant)).to.equal(getAddress(seller.account.address));
      expect(event.args.price).to.equal(price);
      expect(event.args.deliveryDate).to.equal(deliveryDate);
      expect(event.args.isBuy).to.equal(isBuy);
    });

    it("should create a short position when no matching long position exists", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { seller, pc } = accounts;
      const { futures } = contracts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;
      const isBuy = false;

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      const txHash = await futures.write.createPosition([price, deliveryDate, isBuy], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      expect(event.args.positionId).to.not.be.undefined;
      expect(getAddress(event.args.participant)).to.equal(getAddress(seller.account.address));
      expect(event.args.price).to.equal(price);
      expect(event.args.deliveryDate).to.equal(BigInt(deliveryDate));
      expect(event.args.isBuy).to.equal(isBuy);
    });

    it("should reject position creation with zero price", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = 0n;
      const deliveryDate = config.deliveryDates.date1;
      const isBuy = true;

      await catchError(futures.abi, "PriceCannotBeZero", async () => {
        await futures.write.createPosition([price, deliveryDate, isBuy], {
          account: seller.account,
        });
      });
    });

    it("should reject position creation with past delivery date", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const currentTime = BigInt(await time.latest());
      const pastDate = currentTime - 86400n;
      const isBuy = true;

      await catchError(futures.abi, "DeliveryDateShouldBeInTheFuture", async () => {
        await futures.write.createPosition([price, pastDate, isBuy], {
          account: seller.account,
        });
      });
    });

    it("should reject position creation with unavailable delivery date", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const currentTime = BigInt(await time.latest());
      const unavailableDate = currentTime + 86400n * 10n; // 10 days from now (not in delivery dates)
      const isBuy = true;

      await catchError(futures.abi, "DeliveryDateNotAvailable", async () => {
        await futures.write.createPosition([price, unavailableDate, isBuy], {
          account: seller.account,
        });
      });
    });

    it("should reject position creation with insufficient margin balance", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates.date1;
      const isBuy = true;

      // Don't add any margin - balance should be 0
      const balance = await futures.read.balanceOf([seller.account.address]);
      expect(balance).to.equal(0n);

      await catchError(futures.abi, "InsufficientMarginBalance", async () => {
        await futures.write.createPosition([price, deliveryDate, isBuy], {
          account: seller.account,
        });
      });
    });

    it("should allow position creation with sufficient margin balance", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;
      const isBuy = true;

      // Add sufficient margin (required margin + some extra)
      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create position should succeed
      const txHash = await futures.write.createPosition([price, deliveryDate, isBuy], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Verify position was created
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      expect(event.args.positionId).to.not.be.undefined;
      expect(getAddress(event.args.participant)).to.equal(getAddress(seller.account.address));
      expect(event.args.price).to.equal(price);
      expect(event.args.deliveryDate).to.equal(deliveryDate);
      expect(event.args.isBuy).to.equal(isBuy);
    });

    it("should allow position creation when margin balance equals exactly required margin", async function () {});

    it("should reject short position creation with insufficient margin balance", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates.date1;
      const isBuy = false; // Short position

      // Don't add any margin - balance should be 0
      const balance = await futures.read.balanceOf([seller.account.address]);
      expect(balance).to.equal(0n);

      await catchError(futures.abi, "InsufficientMarginBalance", async () => {
        await futures.write.createPosition([price, deliveryDate, isBuy], {
          account: seller.account,
        });
      });
    });

    it("should allow short position creation with sufficient margin balance", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;
      const isBuy = false; // Short position

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create position should succeed
      const txHash = await futures.write.createPosition([price, deliveryDate, isBuy], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Verify position was created
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      expect(event.args.positionId).to.not.be.undefined;
      expect(getAddress(event.args.participant)).to.equal(getAddress(seller.account.address));
      expect(event.args.price).to.equal(price);
      expect(event.args.deliveryDate).to.equal(deliveryDate);
      expect(event.args.isBuy).to.equal(isBuy);
    });
  });

  describe("Position Matching and Order Creation", function () {
    it("should match long and short positions and create an order", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;

      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });

      // Create short position first
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });

      // Create matching long position
      const txHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const events = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      expect(events.length).to.equal(1);
      const orderEvent = events[0];
      expect(getAddress(orderEvent.args.seller)).to.equal(getAddress(seller.account.address));
      expect(getAddress(orderEvent.args.buyer)).to.equal(getAddress(buyer.account.address));
      expect(orderEvent.args.price).to.equal(price);
      expect(orderEvent.args.startTime).to.equal(BigInt(deliveryDate));
    });

    it("should match short and long positions and create an order", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;

      await futures.write.addMargin([margin], {
        account: buyer.account,
      });

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create long position first
      await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      // Create matching short position
      const txHash = await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const events = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      expect(events.length).to.equal(1);
      const orderEvent = events[0];
      expect(getAddress(orderEvent.args.seller)).to.equal(getAddress(seller.account.address));
      expect(getAddress(orderEvent.args.buyer)).to.equal(getAddress(buyer.account.address));
      expect(orderEvent.args.price).to.equal(price);
      expect(orderEvent.args.startTime).to.equal(BigInt(deliveryDate));
    });

    it("should not create order when same participant creates both positions", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create short position
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });

      // Create matching long position with same participant
      const txHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const events = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      // Should not create an order
      expect(events.length).to.equal(0);
    });
  });

  describe("Position Closing", function () {
    it("should allow position owner to close their position", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;

      // Create position
      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      const createTxHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: seller.account,
      });

      const createReceipt = await pc.waitForTransactionReceipt({ hash: createTxHash });
      const [createEvent] = parseEventLogs({
        logs: createReceipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const positionId = createEvent.args.positionId;

      // Close position
      const closeTxHash = await futures.write.closePosition([positionId], {
        account: seller.account,
      });

      const closeReceipt = await pc.waitForTransactionReceipt({ hash: closeTxHash });
      const [closeEvent] = parseEventLogs({
        logs: closeReceipt.logs,
        abi: futures.abi,
        eventName: "PositionClosed",
      });

      expect(closeEvent.args.positionId).to.equal(positionId);
      expect(getAddress(closeEvent.args.participant)).to.equal(getAddress(seller.account.address));
    });

    it("should reject closing position by non-owner", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;

      // Create position
      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      const createTxHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: seller.account,
      });

      const createReceipt = await pc.waitForTransactionReceipt({ hash: createTxHash });
      const [createEvent] = parseEventLogs({
        logs: createReceipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      const positionId = createEvent.args.positionId;

      // Try to close position with different account
      await catchError(futures.abi, "PositionNotBelongToSender", async () => {
        await futures.write.closePosition([positionId], {
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

      const marginAmount = parseUnits("1000", 6); // $1000

      const txHash = await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Check balance
      const balance = await futures.read.balanceOf([seller.account.address]);
      expect(balance).to.equal(marginAmount);

      // Check USDC balance of futures contract
      const futuresUsdcBalance = await usdcMock.read.balanceOf([futures.address]);
      expect(futuresUsdcBalance).to.equal(marginAmount);
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

      const marginAmount = parseUnits("1000", 6);
      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates.date1;

      // Add margin
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });

      // Create position to require minimum margin
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });

      // Try to remove too much margin
      const removeAmount = parseUnits("900", 6);
      await catchError(futures.abi, "InsufficientMarginBalance", async () => {
        await futures.write.removeMargin([removeAmount], {
          account: seller.account,
        });
      });
    });
  });

  describe("Minimum Margin Calculation", function () {
    it("should calculate minimum margin for positions", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const { date1, date2 } = config.deliveryDates;
      const marginAmount = parseUnits("1000", 6);

      // Add margin first
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });

      // Create a long position
      await futures.write.createPosition([price, date1, true], {
        account: seller.account,
      });

      const minMargin = await futures.read.getMinMargin([seller.account.address]);
      expect(minMargin > 0n).to.be.true;

      // Create a short position
      await futures.write.createPosition([price, date2, false], {
        account: seller.account,
      });

      const minMarginAfterShort = await futures.read.getMinMargin([seller.account.address]);
      expect(minMarginAfterShort > minMargin).to.be.true;
    });

    it("should calculate minimum margin for orders", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates.date1;
      const marginAmount = parseUnits("1000", 6);

      // Add margin for both participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });

      // Create matching positions to form an order
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });
      await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      const sellerMinMargin = await futures.read.getMinMargin([seller.account.address]);
      const buyerMinMargin = await futures.read.getMinMargin([buyer.account.address]);

      expect(sellerMinMargin > 0n).to.be.true;
      expect(buyerMinMargin > 0n).to.be.true;
    });
  });

  describe("Order Management", function () {
    it("should allow buyer to close order before start time", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates.date1;
      const marginAmount = parseUnits("1000", 6);

      // Add margin for both participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });

      // Create matching positions to form an order
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });
      const txHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      const { orderId } = orderEvent.args;

      // Close order as buyer
      const closeTxHash = await futures.write.closeAsBuyer([orderId], {
        account: buyer.account,
      });

      const closeReceipt = await pc.waitForTransactionReceipt({ hash: closeTxHash });
      const [closeEvent] = parseEventLogs({
        logs: closeReceipt.logs,
        abi: futures.abi,
        eventName: "OrderClosed",
      });

      expect(closeEvent.args.orderId).to.equal(orderId);
      expect(getAddress(closeEvent.args.closedBy)).to.equal(getAddress(buyer.account.address));
    });

    it("should allow seller to close order before start time", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates.date1;
      const marginAmount = parseUnits("1000", 6);

      // Add margin for both participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });

      // Create matching positions to form an order
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });
      const txHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      const { orderId } = orderEvent.args;

      // Close order as seller
      const closeTxHash = await futures.write.closeAsSeller([orderId], {
        account: seller.account,
      });

      const closeReceipt = await pc.waitForTransactionReceipt({ hash: closeTxHash });
      const [closeEvent] = parseEventLogs({
        logs: closeReceipt.logs,
        abi: futures.abi,
        eventName: "OrderClosed",
      });

      expect(closeEvent.args.orderId).to.equal(orderId);
      expect(getAddress(closeEvent.args.closedBy)).to.equal(getAddress(seller.account.address));
    });

    it("should reject closing order by non-participant", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, buyer2, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;

      // Create matching positions to form an order
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });
      const txHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      const orderId = orderEvent.args.orderId;

      // Try to close order with different account
      await catchError(futures.abi, "OnlyOrderBuyer", async () => {
        await futures.write.closeAsBuyer([orderId], {
          account: buyer2.account,
        });
      });
    });
  });

  describe("Validator Functions", function () {
    it("should allow validator to close order after start time", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, validator, pc, tc } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates.date1;
      const marginAmount = parseUnits("1000", 6);

      // Add margin for both participants
      await futures.write.addMargin([marginAmount], {
        account: seller.account,
      });
      await futures.write.addMargin([marginAmount], {
        account: buyer.account,
      });

      // Create matching positions to form an order
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });
      const txHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      const orderId = orderEvent.args.orderId;

      // Move time to after start time but before expiration
      await tc.setNextBlockTimestamp({ timestamp: deliveryDate + 1n }); // 1 day + 1 second

      // Close order as validator
      const closeTxHash = await futures.write.closeAsValidator([orderId, true], {
        account: validator.account,
      });

      const closeReceipt = await pc.waitForTransactionReceipt({ hash: closeTxHash });
      const [closeEvent] = parseEventLogs({
        logs: closeReceipt.logs,
        abi: futures.abi,
        eventName: "OrderClosed",
      });

      expect(closeEvent.args.orderId).to.equal(orderId);
      expect(getAddress(closeEvent.args.closedBy)).to.equal(getAddress(validator.account.address));
    });

    it("should reject validator closing order before start time", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, validator, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;

      // Create matching positions to form an order
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });
      const txHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      const orderId = orderEvent.args.orderId;

      // Try to close order as validator before start time
      await catchError(futures.abi, "ValidatorCannotCloseOrderBeforeStartTime", async () => {
        await futures.write.closeAsValidator([orderId, true], {
          account: validator.account,
        });
      });
    });

    it("should reject non-validator from calling validator functions", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;

      // Create matching positions to form an order
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });
      const txHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      const orderId = orderEvent.args.orderId;

      // Try to close order as non-validator
      await catchError(futures.abi, "OnlyValidator", async () => {
        await futures.write.closeAsValidator([orderId, true], {
          account: seller.account,
        });
      });
    });
  });

  describe("Margin Call", function () {
    it("should perform margin call when margin is insufficient", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures, btcPriceOracleMock } = contracts;
      const { seller, validator, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("120", 6);
      const deliveryDate = config.deliveryDates.date1;

      // Add small margin
      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create position that requires more margin
      const tx = await futures.write.createPosition([price, deliveryDate, true], {
        account: seller.account,
      });
      const rec = await pc.waitForTransactionReceipt({ hash: tx });
      const [event] = parseEventLogs({
        logs: rec.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });
      const { positionId } = event.args;

      // Increase bitcoin price
      await btcPriceOracleMock.write.setPrice([config.oracle.btcPrice * 2n, 8]);

      // Perform margin call
      const txHash = await futures.write.marginCall([seller.account.address], {
        account: validator.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Check for position closed event
      const [event2] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionClosed",
      });
      expect(event2.args.positionId).to.equal(positionId);

      // Check that position was closed
      const position = await futures.read.getPositionById([positionId]);
      expect(position.participant).to.equal(zeroAddress);
    });

    it("should reject margin call by non-validator", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates.date1;

      // Create position
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.createPosition([price, deliveryDate, true], {
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
    it("should enforce maximum positions per participant", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const numPositions = 50;
      const price = parseUnits("100", 6);
      const margin = parseUnits("150", 6) * BigInt(numPositions);
      const deliveryDate = config.deliveryDates.date1;

      // Add margin
      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create maximum number of positions (50)
      for (let i = 0; i < numPositions; i++) {
        await futures.write.createPosition([price + BigInt(i), deliveryDate, true], {
          account: seller.account,
        });
      }

      // Try to create one more position
      await catchError(futures.abi, "MaxPositionsPerParticipantReached", async () => {
        await futures.write.createPosition([price + 50n, deliveryDate, true], {
          account: seller.account,
        });
      });
    });

    it("should handle expired orders", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc, tc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("150", 6);
      const deliveryDate = config.deliveryDates.date1;

      // Create matching positions to form an order
      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });
      await futures.write.createPosition([price, deliveryDate, false], {
        account: seller.account,
      });
      const txHash = await futures.write.createPosition([price, deliveryDate, true], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [orderEvent] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      const orderId = orderEvent.args.orderId;

      // Move time to after order expiration (30 days + 1 second)
      await tc.setNextBlockTimestamp({
        timestamp: deliveryDate + BigInt(config.deliveryDurationSeconds) + 1n,
      });

      // Try to close expired order
      await catchError(futures.abi, "OrderExpired", async () => {
        await futures.write.closeAsBuyer([orderId], {
          account: buyer.account,
        });
      });
    });
  });
});
