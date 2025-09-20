import { HOURLY_BTC_CSV } from './config.js';
import { fetchJson } from './utils/http.js';
import { writeCSV } from './utils/csv.js';
import { logger } from './utils/log.js';

interface MarketChartResponse {
  prices: [number, number][];
}

const URL =
  'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90&interval=hourly';

function isoHourFromMs(ms: number): string {
  const date = new Date(ms);
  const hourIso = date.toISOString();
  return `${hourIso.slice(0, 13)}:00:00Z`;
}

async function main(): Promise<void> {
  const data = await fetchJson<MarketChartResponse>(URL, { etagCacheKey: 'btc-usd-hourly' });
  const map = new Map<string, number>();
  for (const [ms, price] of data.prices) {
    const ts = isoHourFromMs(ms);
    map.set(ts, price);
  }
  const rows = Array.from(map.entries())
    .map(([ts, price]) => ({ ts, btc_usd: price.toFixed(2) }))
    .sort((a, b) => (a.ts > b.ts ? 1 : a.ts < b.ts ? -1 : 0));
  writeCSV(HOURLY_BTC_CSV, ['ts', 'btc_usd'], rows);
  logger.info(`Wrote ${rows.length} hourly BTC price rows.`);
}

main().catch((error) => {
  logger.error(`fetch_btc_hourly failed: ${(error as Error).stack ?? (error as Error).message}`);
  process.exitCode = 1;
});
