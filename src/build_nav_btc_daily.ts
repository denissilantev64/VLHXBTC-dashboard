import {
  DAILY_BTC_CSV,
  DAILY_NAV_BTC_CSV,
  DAILY_NAV_CSV,
} from './config.js';
import { readCSV, writeCSV } from './utils/csv.js';
import { logger } from './utils/log.js';

interface CombinedRow {
  day: string;
  nav_usd: number;
  btc_usd: number;
}

function parseRows(): CombinedRow[] {
  const navRows = readCSV(DAILY_NAV_CSV).rows;
  const btcRows = readCSV(DAILY_BTC_CSV).rows;
  const btcMap = new Map<string, number>();
  for (const row of btcRows) {
    const value = Number(row.btc_usd);
    if (!Number.isFinite(value)) {
      continue;
    }
    btcMap.set(row.day, value);
  }
  const combined: CombinedRow[] = [];
  for (const row of navRows) {
    const nav = Number(row.token_price_usd);
    const btc = btcMap.get(row.day);
    if (!Number.isFinite(nav) || btc === undefined || !Number.isFinite(btc)) {
      continue;
    }
    combined.push({ day: row.day, nav_usd: nav, btc_usd: btc });
  }
  combined.sort((a, b) => (a.day > b.day ? 1 : a.day < b.day ? -1 : 0));
  return combined;
}

function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

async function main(): Promise<void> {
  const combined = parseRows();
  if (combined.length === 0) {
    logger.warn('No overlapping daily NAV/BTC data found.');
    return;
  }
  const nav0 = combined[0].nav_usd;
  const btc0 = combined[0].btc_usd;
  const navBtc0 = combined[0].nav_usd / combined[0].btc_usd;
  const rows = combined.map((row) => {
    const navBtc = row.nav_usd / row.btc_usd;
    const roiBtc = navBtc0 === 0 ? 0 : navBtc / navBtc0 - 1;
    const roiUsd = nav0 === 0 ? 0 : row.nav_usd / nav0 - 1;
    const alpha = btc0 === 0 ? 0 : (roiUsd + 1) / (row.btc_usd / btc0) - 1;
    return {
      day: row.day,
      nav_usd: formatNumber(row.nav_usd, 8),
      btc_usd: formatNumber(row.btc_usd, 2),
      nav_btc: formatNumber(navBtc, 8),
      roi_in_btc: formatNumber(roiBtc, 6),
      roi_in_usd: formatNumber(roiUsd, 6),
      alpha_vs_btc: formatNumber(alpha, 6),
    };
  });
  writeCSV(
    DAILY_NAV_BTC_CSV,
    ['day', 'nav_usd', 'btc_usd', 'nav_btc', 'roi_in_btc', 'roi_in_usd', 'alpha_vs_btc'],
    rows,
  );
  logger.info(`Built ${rows.length} daily NAV vs BTC rows.`);
}

main().catch((error) => {
  logger.error(`build_nav_btc_daily failed: ${(error as Error).stack ?? (error as Error).message}`);
  process.exitCode = 1;
});
