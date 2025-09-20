import { DAILY_BTC_CSV } from './config.js';
import { writeCSV } from './utils/csv.js';
import { logger } from './utils/log.js';
import {
  fetchCoinGeckoDaily,
  fetchCryptoCompareDaily,
  fetchDailyPricesWithFallback,
} from './utils/prices.js';

async function main(): Promise<void> {
  const prices = await fetchDailyPricesWithFallback('BTC/USD', [
    { name: 'CoinGecko', fetch: () => fetchCoinGeckoDaily('bitcoin', 'btc-usd-daily') },
    { name: 'CryptoCompare', fetch: () => fetchCryptoCompareDaily('BTC') },
  ]);

  const rows = prices
    .map(({ day, price }) => ({ day, btc_usd: price.toFixed(2) }))
    .sort((a, b) => (a.day > b.day ? 1 : a.day < b.day ? -1 : 0));

  writeCSV(DAILY_BTC_CSV, ['day', 'btc_usd'], rows);
  logger.info(`Wrote ${rows.length} daily BTC price rows.`);
}

main().catch((error) => {
  logger.error(`fetch_btc_daily failed: ${(error as Error).stack ?? (error as Error).message}`);
  process.exitCode = 1;
});
