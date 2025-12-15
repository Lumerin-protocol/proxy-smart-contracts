import { viem } from "hardhat";
import { formatUnits, parseEventLogs, parseUnits } from "viem";
import { createInterface } from "readline";

const DECIMALS = 6; // USDC decimals

async function main() {
  const futuresAddress = process.env.FUTURES_ADDRESS as `0x${string}`;
  if (!futuresAddress) {
    console.error("FUTURES_ADDRESS environment variable is required");
    console.error(
      "Usage: FUTURES_ADDRESS=0x... npx hardhat run scripts/trade-futures.ts --network localhost"
    );
    process.exit(1);
  }

  console.log("Connecting to Futures contract at:", futuresAddress);

  const pc = await viem.getPublicClient();
  const [, wc] = await viem.getWalletClients();
  const fc = await viem.getContractAt("Futures", futuresAddress, {
    client: { public: pc, wallet: wc },
  });

  // Read market info
  const [deliveryDates, marketPrice, tickSize, durationDays, balance] = await Promise.all([
    fc.read.getDeliveryDates(),
    fc.read.getMarketPrice(),
    fc.read.minimumPriceIncrement(),
    fc.read.deliveryDurationDays(),
    fc.read.balanceOf([wc.account.address]),
  ]);

  const currentDeliveryDate = deliveryDates[0];

  console.log("\n" + "=".repeat(60));
  console.log("FUTURES TRADING");
  console.log("=".repeat(60));
  console.log(`Account: ${wc.account.address}`);
  console.log(`Margin Balance: $${formatUnits(balance, DECIMALS)}`);
  console.log(`Market Price: $${formatUnits(marketPrice, DECIMALS)}/day`);
  console.log(`Tick Size: $${formatUnits(tickSize, DECIMALS)}`);
  console.log(`Contract Duration: ${durationDays} days`);
  console.log(`Contract Value: $${formatUnits(marketPrice * BigInt(durationDays), DECIMALS)}`);
  console.log("\nDelivery Dates:");
  deliveryDates.forEach((date, i) => {
    const d = new Date(Number(date) * 1000);
    console.log(`  [${i}] ${d.toISOString().split("T")[0]} (${date})`);
  });
  console.log("=".repeat(60));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  const promptOrder = async () => {
    console.log("\n--- Place New Order ---");
    console.log("Quantity: positive = BUY, negative = SELL");
    console.log('Type "quit" to exit\n');

    const priceInput = await question(
      `Price per day in $ (market: ${formatUnits(marketPrice, DECIMALS)}): `
    );

    if (priceInput.trim().toLowerCase() === "quit" || priceInput.trim().toLowerCase() === "q") {
      console.log("Goodbye!");
      rl.close();
      process.exit(0);
    }

    const priceFloat = parseFloat(priceInput);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      console.error("Invalid price. Please enter a positive number.");
      return promptOrder();
    }

    const qtyInput = await question("Quantity (e.g., 1 for BUY, -1 for SELL): ");
    const qty = parseInt(qtyInput);
    if (isNaN(qty) || qty === 0 || qty < -127 || qty > 127) {
      console.error("Invalid quantity. Must be non-zero integer between -127 and 127.");
      return promptOrder();
    }

    const price = parseUnits(priceFloat.toFixed(DECIMALS), DECIMALS);
    const side = qty > 0 ? "BUY" : "SELL";
    const contractValue = price * BigInt(durationDays) * BigInt(Math.abs(qty));

    console.log("\n--- Order Summary ---");
    console.log(`Side: ${side}`);
    console.log(`Quantity: ${Math.abs(qty)} contract(s)`);
    console.log(`Price: $${formatUnits(price, DECIMALS)}/day`);
    console.log(`Total Value: $${formatUnits(contractValue, DECIMALS)}`);
    console.log(
      `Delivery Date: ${new Date(Number(currentDeliveryDate) * 1000).toISOString().split("T")[0]}`
    );

    const confirm = await question("\nConfirm order? (y/n): ");
    if (confirm.trim().toLowerCase() !== "y") {
      console.log("Order cancelled.");
      return promptOrder();
    }

    try {
      console.log("Adding margin...");
      const hash0 = await fc.write.addMargin([parseUnits(priceFloat.toFixed(DECIMALS), DECIMALS)]);
      await pc.waitForTransactionReceipt({ hash: hash0 });
      console.log(`✓ Margin added! Transaction: ${hash0}`);

      console.log("\nPlacing order...");
      const hash = await fc.write.createOrder([
        price,
        currentDeliveryDate,
        "", // destURL - empty for now
        qty,
      ]);
      const receipt = await pc.waitForTransactionReceipt({ hash });

      parseEventLogs({
        logs: receipt.logs,
        abi: fc.abi,
      }).forEach((event) => {
        if (event.eventName === "OrderCreated") {
          console.log(`✓ Order created! Order ID: ${event.args.orderId}`);
        }
        if (event.eventName === "PositionCreated") {
          console.log(`✓ Position created! Position ID: ${event.args.positionId}`);
        }
        if (event.eventName === "OrderClosed") {
          console.log(`✓ Order closed! Order ID: ${event.args.orderId}`);
        }
        if (event.eventName === "PositionClosed") {
          console.log(`✓ Position closed! Position ID: ${event.args.positionId}`);
        }
      });

      // Update balance
      const newBalance = await fc.read.balanceOf([wc.account.address]);
      console.log(`✓ New margin balance: $${formatUnits(newBalance, DECIMALS)}`);
    } catch (error: any) {
      console.error("Transaction failed:", error.message || error);
    }

    return promptOrder();
  };

  await promptOrder();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
