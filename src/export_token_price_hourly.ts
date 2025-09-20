import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { HOURLY_NAV_CSV, POOL_LOGIC_ADDRESS, TOKEN_PRICE_START_DATE } from './config.js';
import { blockAtEndOfHourUTC, blockAtEndOfHourUTCWithHint } from './utils/arb.js';
import { readCSV, upsertRows, type CSVRow } from './utils/csv.js';
import { logger } from './utils/log.js';
import { buildProviderSequence } from './utils/provider.js';

const ABI = ['function tokenPrice() view returns (uint256)'];
const MAX_BACKFILL_HOURS = 720;
const SANITY_TOLERANCE = 0.1;

interface HourPrice extends CSVRow {
  ts: string;
  token_price_usd: string;
}

function startOfHour(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
    ),
  );
}

function addHours(date: Date, hours: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCHours(copy.getUTCHours() + hours);
  return copy;
}

function isoHour(date: Date): string {
  return `${date.toISOString().slice(0, 13)}:00:00Z`;
}

function parseHour(ts: string): Date {
  return new Date(ts);
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

function passesSanityCheck(history: HourPrice[], candidate: HourPrice): boolean {
  const priorValues = history
    .filter((row) => row.ts < candidate.ts)
    .slice(-24)
    .map((row) => Number(row.token_price_usd));
  if (priorValues.length < 6) {
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

function determineHoursToFetch(existing: HourPrice[]): string[] {
  const existingSet = new Set(existing.map((row) => row.ts));
  const now = new Date();
  const endHour = addHours(startOfHour(now), -1);
  const earliestHour = startOfHour(new Date(`${TOKEN_PRICE_START_DATE}T00:00:00Z`));
  if (endHour.getTime() < earliestHour.getTime()) {
    return [];
  }
  const missing: string[] = [];
  for (let cursor = new Date(earliestHour.getTime()); cursor <= endHour; cursor = addHours(cursor, 1)) {
    const key = isoHour(cursor);
    if (!existingSet.has(key)) {
      missing.push(key);
    }
  }
  if (missing.length === 0) {
    return [];
  }
  return missing.slice(0, MAX_BACKFILL_HOURS);
}

async function fetchTokenPrice(
  provider: JsonRpcProvider,
  contract: Contract,
  ts: string,
  blockHint?: number,
): Promise<number> {
  const block = blockHint ?? (await blockAtEndOfHourUTC(provider, parseHour(ts)));
  const price = await contract.tokenPrice({ blockTag: block });
  const numeric = Number(formatUnits(price, 18));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid token price ${numeric} for ${ts}`);
  }
  return numeric;
}

async function main(): Promise<void> {
  const table = readCSV(HOURLY_NAV_CSV);
  const existing = table.rows.map((row) => ({
    ts: row.ts,
    token_price_usd: row.token_price_usd,
  })) as HourPrice[];
  existing.sort((a, b) => (a.ts > b.ts ? 1 : a.ts < b.ts ? -1 : 0));
  const targets = determineHoursToFetch(existing);
  if (targets.length === 0) {
    logger.info('No new hourly token price data needed.');
    return;
  }
  const providers = buildProviderSequence();
  const contracts = providers.map((provider) => new Contract(POOL_LOGIC_ADDRESS, ABI, provider));
  const blockHints: Array<number | null> = providers.map(() => null);
  const history = [...existing];
  const newRows: HourPrice[] = [];
  for (const ts of targets) {
    let fetched: number | null = null;
    for (let i = 0; i < providers.length; i += 1) {
      try {
        const hint = blockHints[i] ?? undefined;
        const block = await blockAtEndOfHourUTCWithHint(providers[i], parseHour(ts), hint);
        blockHints[i] = block;
        const value = await fetchTokenPrice(providers[i], contracts[i], ts, block);
        const candidate: HourPrice = { ts, token_price_usd: value.toFixed(8) };
        if (!passesSanityCheck([...history, ...newRows], candidate)) {
          throw new Error('Sanity check failed (>10% deviation from rolling median)');
        }
        fetched = value;
        newRows.push(candidate);
        history.push(candidate);
        logger.info(`Fetched hourly NAV ${value.toFixed(8)} for ${ts} using provider ${i + 1}`);
        break;
      } catch (error) {
        logger.warn(
          `Failed to fetch hourly NAV for ${ts} using provider ${i + 1}: ${(error as Error).message}`,
        );
      }
    }
    if (fetched === null) {
      logger.error(`All providers failed for hour ${ts}, skipping.`);
    }
  }
  if (newRows.length === 0) {
    logger.warn('No valid hourly NAV rows fetched.');
    return;
  }
  upsertRows(HOURLY_NAV_CSV, ['ts', 'token_price_usd'], 'ts', newRows);
  logger.info(`Appended ${newRows.length} hourly NAV rows.`);
}

main().catch((error) => {
  logger.error(
    `export_token_price_hourly failed: ${(error as Error).stack ?? (error as Error).message}`,
  );
  process.exitCode = 1;
});
