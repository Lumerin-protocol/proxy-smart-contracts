import pino from "pino";
import { DeficitEntry } from "./deficitEntry";

export async function sendDeficitAlerts(entries: DeficitEntry[], log: pino.Logger) {
  for (const entry of entries) {
    log.info(
      `Sending deficit alert for ${entry.address} with collateral deficit ${entry.collateralDeficit} and balance ${entry.balance} and percentage ${entry.percentage}`
    );
  }
}
