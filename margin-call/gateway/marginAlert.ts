import pino from "pino";
import { DeficitEntry } from "./deficitEntry";

export async function sendDeficitAlerts(
  entries: DeficitEntry[],
  notificationServiceUrl: string,
  log: pino.Logger
) {
  const entriesToSend = entries.map((entry) => ({
    walletAddress: entry.address,
    collateralBalance: entry.balance,
    minBalance: entry.balance + entry.collateralDeficit,
  }));

  log.info(`Sending deficit alerts: ${entriesToSend.length}`);
  for (const entry of entriesToSend) {
    log.info(
      `address ${entry.walletAddress} collateral balance ${entry.collateralBalance} and min balance ${entry.minBalance}`
    );
  }

  const url = new URL("/notifications", notificationServiceUrl);
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(entriesToSend),
  });

  if (!res.ok) {
    log.error(`Failed to send deficit alerts: ${res.statusText}`);
  }
}
