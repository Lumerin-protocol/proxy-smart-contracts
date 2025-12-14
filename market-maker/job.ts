import { privateKeyToAccount } from "viem/accounts";
import { Subgraph } from "./subgraph.ts";
import pino from "pino";
import { FuturesContract } from "./contract.ts";
import { NowSeconds, mult, wait, clamp, abs } from "./lib.ts";
import {
  resampleHourlyClose,
  realizedVolatility,
  generateContractValues,
  geometricTaperAllocations,
  currencyToNotionalAllocations as currencyToQuantityAllocations,
  calculateReservationPrice,
  ordersToString,
  calculateOrders,
} from "./helpers.ts";
import { getConfig } from "./config.ts";
import { formatUnits } from "viem/utils";

export async function main() {
  const config = getConfig();
  const log = pino({
    level: config.LOG_LEVEL,
  });
  const subgraph = new Subgraph(config.SUBGRAPH_URL, config.SUBGRAPH_API_KEY);
  const account = privateKeyToAccount(config.PRIVATE_KEY);
  const contract = new FuturesContract(
    config.FUTURES_ADDRESS,
    config.ETH_NODE_URL,
    config.PRIVATE_KEY
  );
  log.info(`Wallet address: ${contract.getWalletAddress()}`);
  const volatilityDurationSeconds = 7 * 24 * 3600;
  const nowSeconds = NowSeconds();
  const historicalPrices = await subgraph.getHistoricalPrices(
    nowSeconds - volatilityDurationSeconds,
    nowSeconds
  );
  const resampledPrices = resampleHourlyClose(historicalPrices, 3600);
  const { sigmaPerStep: volatilityPerHour } = realizedVolatility(resampledPrices);
  log.info(`Volatility per hour: ${volatilityPerHour}`);
  const riskAversion = 0.1;
  log.info(`Risk aversion: ${riskAversion}`);
  const contractMultiplier = BigInt(await contract.getContractMultiplier());
  log.info(`Contract multiplier: ${contractMultiplier}`);
  const tickSize = await contract.getTickSize();
  log.info(`Tick size: ${tickSize}`);
  log.info(`Grid levels: ${config.GRID_LEVELS}`);
  log.info(`Active quoting amount ratio: ${config.ACTIVE_QUOTING_AMOUNT_RATIO}`);

  if (config.SPREAD_AMOUNT % (tickSize * 2n) !== 0n) {
    throw new Error(
      `Spread amount (${config.SPREAD_AMOUNT}) is not divisible by 2x tick size (2 *${tickSize}), please adjust the spread amount`
    );
  }

  const futuresAccountBalance = await contract.getBalance();
  log.info(`Margin account balance: ${formatUnits(futuresAccountBalance, 6)}`);

  if (futuresAccountBalance < config.FLOAT_AMOUNT) {
    const depositAmount = config.FLOAT_AMOUNT - futuresAccountBalance;
    const { blockNumber } = await contract.deposit(depositAmount);
    log.info(
      `Deposited ${formatUnits(depositAmount, 6)} to margin account, block number: ${blockNumber}`
    );
  }

  for (let iteration = 0; ; iteration++) {
    log.info(`\n\n\n\n================= Iteration: ${iteration} =================`);
    // main loop
    // 1. Observe the market
    // 	•	Continuously read the best bid, best ask, and last traded price for the gold futures you care about.
    const indexPrice = await contract.getIndexPrice();
    log.info(`Index price: ${indexPrice}`);

    const deliveryDate = await contract.getCurrentDeliveryDate();
    log.info(`Delivery date: ${deliveryDate} (${new Date(deliveryDate * 1000).toISOString()})`);

    const currentPosition = await subgraph.getCurrentPosition(
      BigInt(deliveryDate),
      contract.getWalletAddress()
    );
    log.info(`Current position: ${currentPosition.position}`);
    log.info(`Current average price: ${currentPosition.averagePrice}`);

    const unrealizedPnL = currentPosition.position * (indexPrice - currentPosition.averagePrice);
    log.info(`Unrealized P&L: ${unrealizedPnL}`);

    // 	•	Optionally estimate a “fair” mid price (for example, midpoint of bid/ask) and some measure of recent volatility to know how “calm” or “wild” the market is.
    // const fairPrice = (price.bestBid + price.bestAsk) / 2n;
    const remainingTimeHours = (deliveryDate - NowSeconds()) / 3600;
    const reservationPrice = calculateReservationPrice(
      indexPrice,
      currentPosition.position,
      riskAversion,
      volatilityPerHour,
      remainingTimeHours
    );
    log.info(`Reservation price: ${reservationPrice}`);
    log.info("Delta %s", reservationPrice - indexPrice);

    // inventory skew shifts the middle price up or down based on the current position
    // const inventorySkew = (currentPosition.position * config.SPREAD_AMOUNT) / config.MAX_POSITION;

    // 2. Model the grid of orders based on the current price
    log.info(`Float amount: ${config.FLOAT_AMOUNT}`);
    const budget = mult(config.FLOAT_AMOUNT, config.ACTIVE_QUOTING_AMOUNT_RATIO);
    log.info(`Budget: ${budget}`);

    // budget skew shifts the budget up or down based on the current position
    const normalizedInventory = clamp(
      Number(currentPosition.position) / Number(config.MAX_POSITION),
      -1,
      1
    );
    const bidSkew = clamp(1 - Math.max(normalizedInventory, 0), 0, null);
    const askSkew = clamp(1 + Math.min(normalizedInventory, 0), 0, null);
    log.info(`Bid skew: ${bidSkew}`);
    log.info(`Ask skew: ${askSkew}`);

    const bidBudget = mult(budget / 2n, bidSkew);
    const askBudget = mult(budget / 2n, askSkew);
    log.info(`Bid budget: ${bidBudget}`);
    log.info(`Ask budget: ${askBudget}`);
    // geometric taper allocations are used to distribute the budget across the grid levels
    // more distributed closer to the middle price, less further away
    const bidOrdersNotional = geometricTaperAllocations(bidBudget, Number(config.GRID_LEVELS));
    const askOrdersNotional = geometricTaperAllocations(askBudget, Number(config.GRID_LEVELS));
    // generate the contract total values for the different price levels
    const bidOrderValues = generateContractValues(
      (reservationPrice - config.SPREAD_AMOUNT / 2n) * contractMultiplier,
      tickSize * contractMultiplier,
      -Number(config.GRID_LEVELS)
    );
    const askOrderValues = generateContractValues(
      (reservationPrice + config.SPREAD_AMOUNT / 2n) * contractMultiplier,
      tickSize * contractMultiplier,
      Number(config.GRID_LEVELS)
    );
    const bidOrders = currencyToQuantityAllocations(
      bidOrdersNotional.allocations.reverse(),
      bidOrderValues
    );
    const askOrders = currencyToQuantityAllocations(askOrdersNotional.allocations, askOrderValues);

    const modelledOrders: { price: bigint; qty: bigint }[] = [];
    for (let i = 0; i < bidOrders.result.length; i++) {
      modelledOrders.push({
        price: bidOrderValues[i] / contractMultiplier,
        qty: bidOrders.result[i],
      });
    }
    for (let i = 0; i < askOrders.result.length; i++) {
      modelledOrders.push({
        price: askOrderValues[i] / contractMultiplier,
        qty: -askOrders.result[i],
      });
    }
    log.info(`Modelled orders: \n${ordersToString(modelledOrders)}`);

    // 3. Query current orders
    const currentOrders = await subgraph.getCurrentOrders(
      BigInt(deliveryDate),
      contract.getWalletAddress()
    );
    log.info(`Current orders: \n${ordersToString(currentOrders)}`);

    // 4. Calculate which orders to place to achieve modelled orders
    const ordersToPlace = calculateOrders(modelledOrders, currentOrders);
    log.info(`Orders to place: \n${ordersToString(ordersToPlace)}`);

    const ordersToPlaceWithDeliveryDate = ordersToPlace.map((order) => ({
      ...order,
      deliveryDate: BigInt(deliveryDate),
    }));

    const { blockNumber } = await contract.placeOrders(ordersToPlaceWithDeliveryDate);
    log.info(`Orders placed: Block number: ${blockNumber}`);

    // 5. Wait for someone to fill the orders and create a position, or loop interval
    await Promise.race([
      // contract.waitForPositionCreated(account.address, Number(blockNumber)).then(() => {
      //   log.info(`Position created, continuing...`);
      // }),
      wait(config.LOOP_INTERVAL_MS).then(() => {
        log.info(`Loop interval timeout, continuing...`);
      }),
    ]);

    // 6. start over
  }
}
// wait for either fill or loop timeout

// calculate risk

// 3. Control spread and size
// 	•	When volatility increases or order flow looks “toxic” (prices jump quickly in one direction), widen the spread and/or reduce order size to protect yourself.
// 	•	When the market is calm, you can tighten the spread and maybe increase size to collect more small profits.
// 4. Track inventory (position)
// 	•	Keep track of how many gold futures contracts you are long or short.
// 	•	Define a maximum position in each direction (e.g., max +10 long, max −10 short); never quote in a way that easily pushes you beyond those limits.
// 5. Skew quotes based on inventory
// 	•	If you are too long (holding many contracts), you want to sell more and buy less, so you shift your quotes: move the bid down and/or ask down a bit to encourage selling and discourage more buying.
// 	•	If you are too short, do the opposite: move quotes up a bit to attract buys from you (so you can cover shorts) and discourage further shorting.
// 6. React to fills (trades)
// 	•	Whenever a customer order trades against your quote, update your position and record the trade price.
// 	•	After each fill, immediately recalculate and update your bid/ask, taking into account new inventory and any change in market conditions.
// 7. Monitor P&L and risk
// 	•	Continuously estimate unrealized P&L: how much you gain or lose if you mark your current position to the latest mid or last traded price.
// 	•	If losses or position get too large, have safety rules: widen spreads, reduce size, or temporarily stop quoting until risk is back under control.
// 8. Loop continuously
// 	•	The basic loop is: read market → compute quotes → place/modify/cancel orders → handle fills → update inventory and risk → repeat.
// 	•	For learning purposes, you can simulate this with a toy price process for gold (e.g., price around 2650) and random “customer” trades hitting your quotes, and then watch how your position, quotes, and P&L evolve over time.
