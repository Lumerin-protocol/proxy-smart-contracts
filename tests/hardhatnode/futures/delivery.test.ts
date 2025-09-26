import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployFuturesFixture } from "./fixtures";
import { Account, Client, parseEventLogs, parseUnits } from "viem";
import { expect } from "chai";

describe("Futures Delivery", () => {
  async function positionFixture() {
    const data = await loadFixture(deployFuturesFixture);
    const { contracts, accounts, config } = data;
    const { futures } = contracts;
    const { seller, buyer, pc } = accounts;

    async function logBalance(client: Client, name: string) {
      const balance = await futures.read.balanceOf([client!.account!.address]);
      console.log(`${name} balance`, balance);
    }

    const price = await futures.read.getMarketPrice();
    const marginAmount = parseUnits("1000", 6);
    const deliveryDate = config.deliveryDates.date1;

    // Add margin for both participants
    await futures.write.addMargin([marginAmount], {
      account: seller.account,
    });
    await futures.write.addMargin([marginAmount], {
      account: buyer.account,
    });

    logBalance(seller, "seller");
    logBalance(buyer, "buyer");

    // Create matching orders to form a position
    await futures.write.createOrder([price, deliveryDate, false], {
      account: seller.account,
    });
    const txHash = await futures.write.createOrder([price, deliveryDate, true], {
      account: buyer.account,
    });

    const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
    const [orderEvent] = parseEventLogs({
      logs: receipt.logs,
      abi: futures.abi,
      eventName: "PositionCreated",
    });
    const { positionId } = orderEvent.args;

    return {
      ...data,
      position: { positionId, deliveryDate, price, marginAmount, seller, buyer },
      logBalance,
    };
  }
  it("check behaviour when 50% is not delivered and price not changed", async () => {
    const data = await loadFixture(positionFixture);
    const { contracts, position, accounts, config, logBalance } = data;
    const { seller, buyer, tc, validator } = accounts;
    const { futures } = contracts;

    await tc.setNextBlockTimestamp({
      timestamp: position.deliveryDate + BigInt(config.deliveryDurationSeconds) / 2n,
    });
    await futures.write.closePositionAsValidator([position.positionId, true], {
      account: validator.account,
    });
    await logBalance(seller, "seller after close");
    await logBalance(buyer, "buyer after close");
  });
});
