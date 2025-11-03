import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEventLogs, parseUnits, getAddress, zeroAddress } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployFuturesFixture } from "./fixtures";
import { catchError } from "../../lib";

describe("Futures Contract", function () {
  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;

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
      const liquidationMarginPercent = await futures.read.liquidationMarginPercent();
      expect(liquidationMarginPercent).to.equal(config.liquidationMarginPercent);

      // Check speed
      const speed = await futures.read.speedHps();
      expect(speed).to.equal(config.speedHps);

      // Check delivery duration
      const deliveryDuration = await futures.read.deliveryDurationDays();
      expect(deliveryDuration).to.equal(7); // 7 days

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
    // TODO: add tests for delivery date management
  });

  describe("Order Creation", function () {
    it("should create a buy order when no matching sell order exists", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6); // $100
      const margin = parseUnits("100000", 6);
      const deliveryDate = BigInt(config.deliveryDates[0]);

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      expect(event.args.orderId).to.not.be.undefined;
      expect(getAddress(event.args.participant)).to.equal(getAddress(seller.account.address));
      expect(event.args.pricePerDay).to.equal(price);
      expect(event.args.deliveryAt).to.equal(deliveryDate);
      expect(event.args.isBuy).to.equal(true);
    });

    it("should collect order fee", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures, usdcMock } = contracts;
      const { seller, owner, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      // Add margin first
      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Get initial balances
      const initialSellerBalance = await futures.read.balanceOf([seller.account.address]);
      const initialContractBalance = await futures.read.balanceOf([futures.address]);
      const initialOwnerUsdcBalance = await usdcMock.read.balanceOf([owner.account.address]);

      // Create order - this should collect the order fee
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Verify order fee was deducted from seller's balance
      const finalSellerBalance = await futures.read.balanceOf([seller.account.address]);
      expect(finalSellerBalance).to.equal(initialSellerBalance - config.orderFee);

      // Verify order fee was added to contract's balance
      const finalContractBalance = await futures.read.balanceOf([futures.address]);
      expect(finalContractBalance).to.equal(initialContractBalance + config.orderFee);

      // Verify order was created successfully
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      expect(event.args.orderId).to.not.be.undefined;
      expect(getAddress(event.args.participant)).to.equal(getAddress(seller.account.address));
      expect(event.args.pricePerDay).to.equal(price);
      expect(event.args.deliveryAt).to.equal(deliveryDate);
      expect(event.args.isBuy).to.equal(true);

      // Test fee withdrawal by owner
      const withdrawTxHash = await futures.write.withdrawFees({
        account: owner.account,
      });

      const withdrawReceipt = await pc.waitForTransactionReceipt({ hash: withdrawTxHash });
      expect(withdrawReceipt.status).to.equal("success");

      // Verify fees were withdrawn to owner
      const finalOwnerUsdcBalance = await usdcMock.read.balanceOf([owner.account.address]);
      expect(finalOwnerUsdcBalance).to.equal(initialOwnerUsdcBalance + config.orderFee);

      // Verify contract balance is now zero after withdrawal
      const contractBalanceAfterWithdrawal = await futures.read.balanceOf([futures.address]);
      expect(contractBalanceAfterWithdrawal).to.equal(0n);
    });

    it("should create a sell order when no matching buy order exists", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { seller, pc } = accounts;
      const { futures } = contracts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      const txHash = await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      expect(event.args.orderId).to.not.be.undefined;
      expect(getAddress(event.args.participant)).to.equal(getAddress(seller.account.address));
      expect(event.args.pricePerDay).to.equal(price);
      expect(event.args.deliveryAt).to.equal(BigInt(deliveryDate));
      expect(event.args.isBuy).to.equal(false);
    });

    it("should reject order creation with zero price", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = 0n;
      const deliveryDate = config.deliveryDates[0];

      await catchError(futures.abi, "InvalidPrice", async () => {
        await futures.write.createOrder([price, deliveryDate, "", 1], {
          account: seller.account,
        });
      });
    });

    it("should reject order creation with price not divisible by price ladder step", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100.01", 6);
      const deliveryDate = config.deliveryDates[0];

      await catchError(futures.abi, "InvalidPrice", async () => {
        await futures.write.createOrder([price, deliveryDate, "", 1], {
          account: seller.account,
        });
      });
    });

    it("should reject order creation with past delivery date", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const currentTime = BigInt(await time.latest());
      const pastDate = currentTime - 86400n;
      const isBuy = true;

      await catchError(futures.abi, "DeliveryDateShouldBeInTheFuture", async () => {
        await futures.write.createOrder([price, pastDate, "", 1], {
          account: seller.account,
        });
      });
    });

    it("should reject order creation with unavailable delivery date", async function () {
      const { contracts, accounts } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const currentTime = BigInt(await time.latest());
      const unavailableDate = currentTime + 86400n * 10n; // 10 days from now (not in delivery dates)

      await catchError(futures.abi, "DeliveryDateNotAvailable", async () => {
        await futures.write.createOrder([price, unavailableDate, "", 1], {
          account: seller.account,
        });
      });
    });

    it("should reject order creation with insufficient margin balance", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates[0];

      // Don't add any margin - balance should be 0
      const balance = await futures.read.balanceOf([seller.account.address]);
      expect(balance).to.equal(0n);

      await catchError(futures.abi, "InsufficientMarginBalance", async () => {
        await futures.write.createOrder([price, deliveryDate, "", 1], {
          account: seller.account,
        });
      });
    });

    it("should allow order creation with sufficient margin balance", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      // Add sufficient margin (required margin + some extra)
      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create order should succeed
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Verify order was created
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      expect(event.args.orderId).to.not.be.undefined;
      expect(getAddress(event.args.participant)).to.equal(getAddress(seller.account.address));
      expect(event.args.pricePerDay).to.equal(price);
      expect(event.args.deliveryAt).to.equal(deliveryDate);
      expect(event.args.isBuy).to.equal(true);
    });

    it("should allow position creation when margin balance equals exactly required margin", async function () {});

    it("should reject sell order creation with insufficient margin balance", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller } = accounts;

      const price = parseUnits("100", 6);
      const deliveryDate = config.deliveryDates[0];
      const isBuy = false; // sell order

      // Don't add any margin - balance should be 0
      const balance = await futures.read.balanceOf([seller.account.address]);
      expect(balance).to.equal(0n);

      await catchError(futures.abi, "InsufficientMarginBalance", async () => {
        await futures.write.createOrder([price, deliveryDate, "", -1], {
          account: seller.account,
        });
      });
    });

    it("should allow sell order creation with sufficient margin balance", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];
      const isBuy = false; // Short position

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create position should succeed
      const txHash = await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).to.equal("success");

      // Verify position was created
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      expect(event.args.orderId).to.not.be.undefined;
      expect(getAddress(event.args.participant)).to.equal(getAddress(seller.account.address));
      expect(event.args.pricePerDay).to.equal(price);
      expect(event.args.deliveryAt).to.equal(deliveryDate);
      expect(event.args.isBuy).to.equal(isBuy);
    });
  });

  describe("Order Matching and Position Creation", function () {
    it("should match long and short orders and create a position", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      await futures.write.addMargin([margin], {
        account: seller.account,
      });
      await futures.write.addMargin([margin], {
        account: buyer.account,
      });

      // Create sell order first
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });

      // Create matching long order
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const events = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      expect(events.length).to.equal(1);
      const orderEvent = events[0];
      expect(getAddress(orderEvent.args.seller)).to.equal(getAddress(seller.account.address));
      expect(getAddress(orderEvent.args.buyer)).to.equal(getAddress(buyer.account.address));
      expect(orderEvent.args.pricePerDay).to.equal(price);
      expect(orderEvent.args.deliveryAt).to.equal(BigInt(deliveryDate));
    });

    it("should match sell and buy orders and create an position", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, buyer, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      await futures.write.addMargin([margin], {
        account: buyer.account,
      });

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create buy order first
      await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: buyer.account,
      });

      // Create matching sell order
      const txHash = await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "PositionCreated",
      });

      expect(getAddress(event.args.seller)).to.equal(getAddress(seller.account.address));
      expect(getAddress(event.args.buyer)).to.equal(getAddress(buyer.account.address));
      expect(event.args.pricePerDay).to.equal(price);
      expect(event.args.deliveryAt).to.equal(BigInt(deliveryDate));
    });

    it("should not create position when same participant creates both orders", async function () {
      const { contracts, accounts, config } = await loadFixture(deployFuturesFixture);
      const { futures } = contracts;
      const { seller, pc } = accounts;

      const price = parseUnits("100", 6);
      const margin = parseUnits("10000", 6);
      const deliveryDate = config.deliveryDates[0];

      await futures.write.addMargin([margin], {
        account: seller.account,
      });

      // Create short order
      await futures.write.createOrder([price, deliveryDate, "", -1], {
        account: seller.account,
      });

      // Create matching long order with same participant
      const txHash = await futures.write.createOrder([price, deliveryDate, "", 1], {
        account: seller.account,
      });

      const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
      const events = parseEventLogs({
        logs: receipt.logs,
        abi: futures.abi,
        eventName: "OrderCreated",
      });

      // Should not create an position
      expect(events.length).to.equal(0);
    });
  });

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

      const price = parseUnits("100", 6);
      const minMargin = await futures.read.calculateRequiredMargin([1n]);
      console.log("minMargin", minMargin);
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

      const price = parseUnits("100", 6);
      const [date1, date2] = config.deliveryDates;
      const marginAmount = parseUnits("1000", 6);

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

      const price = parseUnits("100", 6);
      const minMargin = await futures.read.calculateRequiredMargin([1n]);
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
      const price = parseUnits("100", 6);
      const margin = parseUnits("150", 6) * BigInt(numOrders);
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

      const price = parseUnits("100", 6);
      const margin = parseUnits("150", 6);
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
