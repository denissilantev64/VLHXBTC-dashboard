import { DAILY_BTC_CSV } from './config.js';
import { fetchJson } from './utils/http.js';
import { writeCSV } from './utils/csv.js';
import { logger } from './utils/log.js';

interface MarketChartResponse {
  prices: [number, number][];
}

const URL =
  'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=daily';

function isoDayFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const data = await fetchJson<MarketChartResponse>(URL, { etagCacheKey: 'btc-usd-daily' });
  const map = new Map<string, number>();
  for (const [ms, price] of data.prices) {
    const day = isoDayFromMs(ms);
    map.set(day, price);
  }
  const rows = Array.from(map.entries())
    .map(([day, price]) => ({ day, btc_usd: price.toFixed(2) }))
    .sort((a, b) => (a.day > b.day ? 1 : a.day < b.day ? -1 : 0));
  writeCSV(DAILY_BTC_CSV, ['day', 'btc_usd'], rows);
  logger.info(`Wrote ${rows.length} daily BTC price rows.`);
}

main().catch((error) => {
  logger.error(`fetch_btc_daily failed: ${(error as Error).stack ?? (error as Error).message}`);
  process.exitCode = 1;
});
