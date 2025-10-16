import * as viem from "viem";
import pino from "pino";
import { Subgraph } from "./gateway/subgraph";
import { FuturesABI } from "./abi/Futures";
import { config } from "./config/env";
import { hardhat } from "viem/chains";
import { sendDeficitAlerts } from "./gateway/marginAlert";
import { executeMarginCalls } from "./gateway/marginCall";
import { DeficitEntry } from "./gateway/deficitEntry";

async function main() {
  const ethClient = viem.createClient({
    transport: viem.http(config.ETH_NODE_URL),
    chain: {
      ...hardhat,
      multicall3Address: config.MULTICALL_ADDRESS,
    },
    batch: {
      multicall: {
        wait: 1000,
      },
    },
  });

  const subgraphClient = new Subgraph(config.SUBGRAPH_URL, config.SUBGRAPH_API_KEY);

  const log = pino({
    level: config.LOG_LEVEL,
  });

  const futures = viem.getContract({
    address: config.FUTURES_ADDRESS,
    abi: FuturesABI,
    client: ethClient,
  });

  const { participants } = await subgraphClient.getParticipants();

  log.info(`Found ${participants.length} participants`);

  const deficits = await Promise.all(
    participants.map(async (participant) => {
      const collateralDeficit = await futures.read.getCollateralDeficit([participant.address]);
      const balance = BigInt(participant.balance);
      return {
        address: participant.address,
        collateralDeficit,
        balance: balance,
        percentage: Number(collateralDeficit) / Number(balance),
      };
    })
  );

  const addressesForMarginCall: DeficitEntry[] = [];
  const addressesForAlert: DeficitEntry[] = [];

  for (const deficit of deficits) {
    if (deficit.collateralDeficit > 0) {
      addressesForMarginCall.push(deficit);
    }
    if (deficit.percentage < config.MARGIN_ALERT_THRESHOLD) {
      addressesForAlert.push(deficit);
    }
  }

  await sendDeficitAlerts(addressesForAlert, config.NOTIFICATIONS_SERVICE_URL, log);
  await executeMarginCalls(addressesForMarginCall, ethClient, log);
}

// Lambda handler export
export const handler = async (event: any, context: any) => {
  try {
    await main();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Margin call check completed successfully' })
    };
  } catch (error) {
    console.error('Error in margin call handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Margin call check failed', details: error instanceof Error ? error.message : String(error) })
    };
  }
};

// For local testing
if (require.main === module) {
  main();
}
