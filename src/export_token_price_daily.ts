import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import {
  DAILY_NAV_CSV,
  POOL_LOGIC_ADDRESS,
  TOKEN_PRICE_START_DATE,
} from './config.js';
import { blockAtEndOfDayUTC, blockAtEndOfDayUTCWithHint } from './utils/arb.js';
import { upsertRows, readCSV, type CSVRow } from './utils/csv.js';
import { logger } from './utils/log.js';
import { buildProviderSequence } from './utils/provider.js';

const ABI = ['function tokenPrice() view returns (uint256)'];
const MAX_BACKFILL_DAYS = 365;
const SANITY_TOLERANCE = 0.1; // 10%

interface DayPrice extends CSVRow {
  day: string;
  token_price_usd: string;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function passesSanityCheck(history: DayPrice[], candidate: DayPrice): boolean {
  const priorValues = history
    .filter((row) => row.day < candidate.day)
    .slice(-7)
    .map((row) => Number(row.token_price_usd));
  if (priorValues.length < 3) {
    return true;
  }
  const med = median(priorValues);
  if (med === 0) {
    return true;
  }
  const value = Number(candidate.token_price_usd);
  const deviation = Math.abs(value - med) / med;
  return deviation <= SANITY_TOLERANCE;
}

function determineDaysToFetch(existing: DayPrice[]): string[] {
  const existingSet = new Set(existing.map((row) => row.day));
  const now = new Date();
  const endDate = addDays(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), -1);
  const earliestDate = parseDay(TOKEN_PRICE_START_DATE);
  if (endDate.getTime() < earliestDate.getTime()) {
    return [];
  }
  if (endDate.getTime() < 0) {
    return [];
  }
  const missing: string[] = [];
  for (let d = new Date(earliestDate.getTime()); d <= endDate; d = addDays(d, 1)) {
    const day = isoDay(d);
    if (!existingSet.has(day)) {
      missing.push(day);
    }
  }
  if (missing.length === 0) {
    return [];
  }
  return missing.slice(0, MAX_BACKFILL_DAYS);
}

async function fetchTokenPrice(
  provider: JsonRpcProvider,
  contract: Contract,
  day: string,
  blockHint?: number,
): Promise<number> {
  const block = blockHint ?? (await blockAtEndOfDayUTC(provider, parseDay(day)));
  const price = await contract.tokenPrice({ blockTag: block });
  const numeric = Number(formatUnits(price, 18));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid token price ${numeric} for ${day}`);
  }
  return numeric;
}

async function main(): Promise<void> {
  const table = readCSV(DAILY_NAV_CSV);
  const existing = table.rows.map((row) => ({
    day: row.day,
    token_price_usd: row.token_price_usd,
  })) as DayPrice[];
  existing.sort((a, b) => (a.day > b.day ? 1 : a.day < b.day ? -1 : 0));
  const targets = determineDaysToFetch(existing);
  if (targets.length === 0) {
    logger.info('No new daily token price data needed.');
    return;
  }
  const providers = buildProviderSequence();
  const contracts = providers.map((provider) => new Contract(POOL_LOGIC_ADDRESS, ABI, provider));
  const blockHints: Array<number | null> = providers.map(() => null);
  const history = [...existing];
  const newRows: DayPrice[] = [];
  for (const day of targets) {
    let fetched: number | null = null;
    for (let i = 0; i < providers.length; i += 1) {
      try {
        const hint = blockHints[i] ?? undefined;
        const block = await blockAtEndOfDayUTCWithHint(providers[i], parseDay(day), hint);
        blockHints[i] = block;
        const value = await fetchTokenPrice(providers[i], contracts[i], day, block);
        const candidate: DayPrice = { day, token_price_usd: value.toFixed(8) };
        if (!passesSanityCheck([...history, ...newRows], candidate)) {
          throw new Error('Sanity check failed (>10% deviation from rolling median)');
        }
        fetched = value;
        newRows.push(candidate);
        history.push(candidate);
        logger.info(`Fetched NAV ${value.toFixed(8)} for ${day} using provider ${i + 1}`);
        break;
      } catch (error) {
        logger.warn(
          `Failed to fetch NAV for ${day} using provider ${i + 1}: ${(error as Error).message}`,
        );
      }
    }
    if (fetched === null) {
      logger.error(`All providers failed for day ${day}, skipping.`);
    }
  }
  if (newRows.length === 0) {
    logger.warn('No valid NAV rows fetched.');
    return;
  }
  upsertRows(DAILY_NAV_CSV, ['day', 'token_price_usd'], 'day', newRows);
  logger.info(`Appended ${newRows.length} daily NAV rows.`);
}

main().catch((error) => {
  logger.error(`export_token_price_daily failed: ${(error as Error).stack ?? (error as Error).message}`);
  process.exitCode = 1;
});
