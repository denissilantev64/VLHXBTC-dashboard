import { DAILY_WBTC_CSV, PRICE_SERIES_START_DATE } from './config.js';
import { writeCSV } from './utils/csv.js';
import { logger } from './utils/log.js';
import {
  fetchCoinGeckoDaily,
  fetchCoinMarketCapDaily,
  fetchCryptoCompareDaily,
  fetchDailyPricesWithFallback,
} from './utils/prices.js';

async function main(): Promise<void> {
  const startDate = PRICE_SERIES_START_DATE;

  const sources = [
    {
      name: 'CoinGecko',
      fetch: () => fetchCoinGeckoDaily('wrapped-bitcoin', 'wbtc-usd-daily', startDate),
    },
    { name: 'CryptoCompare', fetch: () => fetchCryptoCompareDaily('WBTC', startDate) },
  ];
  if (process.env.COINMARKETCAP_API_KEY) {
    sources.unshift({
      name: 'CoinMarketCap',
      fetch: () => fetchCoinMarketCapDaily('WBTC', { startDate }),
    });
  } else {
    logger.warn('Skipping CoinMarketCap because COINMARKETCAP_API_KEY is not set.');
  }
  const prices = await fetchDailyPricesWithFallback('WBTC/USD', sources);


  const rows = prices
    .map(({ day, price }) => ({ day, wbtc_usd: price.toFixed(2) }))
    .sort((a, b) => (a.day > b.day ? 1 : a.day < b.day ? -1 : 0));

  writeCSV(DAILY_WBTC_CSV, ['day', 'wbtc_usd'], rows);
  logger.info(`Wrote ${rows.length} daily WBTC price rows.`);
}

main().catch((error) => {
  logger.error(`fetch_wbtc_daily failed: ${(error as Error).stack ?? (error as Error).message}`);
  process.exitCode = 1;
});
