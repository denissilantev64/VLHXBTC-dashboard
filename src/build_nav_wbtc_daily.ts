import { DAILY_NAV_CSV, DAILY_NAV_WBTC_CSV, DAILY_WBTC_CSV } from './config.js';
import { readCSV, writeCSV } from './utils/csv.js';
import { logger } from './utils/log.js';

interface CombinedRow {
  day: string;
  nav_usd: number;
  wbtc_usd: number;
}

function parseRows(): CombinedRow[] {
  const navRows = readCSV(DAILY_NAV_CSV).rows;
  const wbtcRows = readCSV(DAILY_WBTC_CSV).rows;
  const wbtcMap = new Map<string, number>();
  for (const row of wbtcRows) {
    const value = Number(row.wbtc_usd);
    if (!Number.isFinite(value)) {
      continue;
    }
    wbtcMap.set(row.day, value);
  }
  const combined: CombinedRow[] = [];
  for (const row of navRows) {
    const nav = Number(row.token_price_usd);
    const wbtc = wbtcMap.get(row.day);
    if (!Number.isFinite(nav) || wbtc === undefined || !Number.isFinite(wbtc)) {
      continue;
    }
    combined.push({ day: row.day, nav_usd: nav, wbtc_usd: wbtc });
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
    logger.warn('No overlapping daily NAV/WBTC data found.');
    return;
  }
  const nav0 = combined[0].nav_usd;
  const wbtc0 = combined[0].wbtc_usd;
  const navWbtc0 = combined[0].nav_usd / combined[0].wbtc_usd;
  const rows = combined.map((row) => {
    const navWbtc = row.nav_usd / row.wbtc_usd;
    const roiWbtc = navWbtc0 === 0 ? 0 : navWbtc / navWbtc0 - 1;
    const roiUsd = nav0 === 0 ? 0 : row.nav_usd / nav0 - 1;
    const alpha = wbtc0 === 0 ? 0 : (roiUsd + 1) / (row.wbtc_usd / wbtc0) - 1;
    return {
      day: row.day,
      nav_usd: formatNumber(row.nav_usd, 8),
      wbtc_usd: formatNumber(row.wbtc_usd, 2),
      nav_wbtc: formatNumber(navWbtc, 8),
      roi_in_wbtc: formatNumber(roiWbtc, 6),
      roi_in_usd: formatNumber(roiUsd, 6),
      alpha_vs_wbtc: formatNumber(alpha, 6),
    };
  });
  writeCSV(
    DAILY_NAV_WBTC_CSV,
    ['day', 'nav_usd', 'wbtc_usd', 'nav_wbtc', 'roi_in_wbtc', 'roi_in_usd', 'alpha_vs_wbtc'],
    rows,
  );
  logger.info(`Built ${rows.length} daily NAV vs WBTC rows.`);
}

main().catch((error) => {
  logger.error(`build_nav_wbtc_daily failed: ${(error as Error).stack ?? (error as Error).message}`);
  process.exitCode = 1;
});
