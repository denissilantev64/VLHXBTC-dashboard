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

function determineDaysToFetch(existing: DayPrice[]): string[] {
  const now = new Date();
  const targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const configuredStart = parseDay(TOKEN_PRICE_START_DATE);
  const startTime = configuredStart.getTime();
  const targetTime = targetDate.getTime();

  if (!Number.isFinite(startTime)) {
    throw new Error(`Invalid TOKEN_PRICE_START_DATE: ${TOKEN_PRICE_START_DATE}`);
  }
  if (targetTime < startTime || targetTime < 0) {
    return [];
  }

  const missing: string[] = [];
  let cursor = new Date(startTime);

  for (const row of existing) {
    const dayValue = row.day;
    if (!dayValue) {
      continue;
    }

    const dayDate = parseDay(dayValue);
    const dayTime = dayDate.getTime();
    if (!Number.isFinite(dayTime) || dayTime < startTime) {
      continue;
    }

    while (cursor.getTime() < dayTime && cursor.getTime() <= targetTime) {
      missing.push(isoDay(cursor));
      cursor = addDays(cursor, 1);
    }

    if (cursor.getTime() === dayTime) {
      cursor = addDays(cursor, 1);
    }

    if (cursor.getTime() > targetTime) {
      return missing;
    }
  }

  while (cursor.getTime() <= targetTime) {
    missing.push(isoDay(cursor));
    cursor = addDays(cursor, 1);
  }

  return missing;
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
  const contracts = providers.map(({ provider }) => new Contract(POOL_LOGIC_ADDRESS, ABI, provider));
  const blockHints: Array<number | null> = providers.map(() => null);
  const newRows: DayPrice[] = [];
  for (const day of targets) {
    let fetched: number | null = null;
    for (let i = 0; i < providers.length; i += 1) {
      try {
        const hint = blockHints[i] ?? undefined;
        const block = await blockAtEndOfDayUTCWithHint(providers[i].provider, parseDay(day), hint);
        blockHints[i] = block;
        const value = await fetchTokenPrice(providers[i].provider, contracts[i], day, block);
        const candidate: DayPrice = { day, token_price_usd: value.toFixed(8) };
        fetched = value;
        newRows.push(candidate);
        logger.info(`Fetched NAV ${value.toFixed(8)} for ${day} using provider ${i + 1} (${providers[i].url})`);
        break;
      } catch (error) {
        logger.warn(
          `Failed to fetch NAV for ${day} using provider ${i + 1} (${providers[i].url}): ${(error as Error).message}`,
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
