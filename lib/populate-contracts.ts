import { THPStoHPS, LMRToLMRWithDecimals, hoursToSeconds } from "./utils";

interface AggregatedContractEntry {
  speedTHPS: number;
  lengthHours: number; 
  priceLMR: number;
  count: number; 
}

const fullMarketplace: AggregatedContractEntry[] = [
  { speedTHPS: 100, lengthHours: 6, priceLMR: 2, count: 1 },
  { speedTHPS: 100, lengthHours: 24, priceLMR: 2, count: 38 },
  { speedTHPS: 275, lengthHours: 6, priceLMR: 2, count: 1 },
  { speedTHPS: 300, lengthHours: 24, priceLMR: 2, count: 10 },
]

const partialMarketplace: AggregatedContractEntry[] = [
  { speedTHPS: 100, lengthHours: 1, priceLMR: 1, count: 1 },
  { speedTHPS: 100, lengthHours: .5, priceLMR: 1, count: 1 },
  { speedTHPS: 100, lengthHours: 2, priceLMR: 1, count: 1 }
]

function unwrapAggregated(entries: typeof fullMarketplace) {
  const result = []
  for (const entry of entries) {
    for (let i = 0; i < entry.count; i++) {
      result.push({
        speed: THPStoHPS(entry.speedTHPS),
        price: LMRToLMRWithDecimals(entry.priceLMR),
        length: hoursToSeconds(entry.lengthHours),
      })
    }
  }
  return result
}

export function buildContractsList(buildFullMarketplace: boolean) {
  return unwrapAggregated(buildFullMarketplace ? fullMarketplace : partialMarketplace)
}


