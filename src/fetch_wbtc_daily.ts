import { Contract, formatUnits } from 'ethers';
import {
  ARBITRUM_RPC,
  CHAINLINK_BTC_USD_FEED,
  DAILY_WBTC_CSV,
  PRICE_SERIES_START_DATE,
} from './config.js';
import { blockAtEndOfDayUTC } from './utils/arb.js';
import { readCSV, upsertRows, type CSVRow } from './utils/csv.js';
import { logger } from './utils/log.js';
import { createProvider } from './utils/provider.js';

const FEED_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
];

interface DayPrice extends CSVRow {
  day: string;
  wbtc_usd: string;
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
  const configuredStart = parseDay(PRICE_SERIES_START_DATE);
  if (targetDate.getTime() < configuredStart.getTime() || targetDate.getTime() < 0) {
    return [];
  }

  const existingDays = new Set(existing.map((row) => row.day));
  const lastRecorded = existing.length > 0 ? parseDay(existing[existing.length - 1].day) : undefined;
  const firstCandidate = lastRecorded ? addDays(lastRecorded, 1) : configuredStart;
  const startDate = firstCandidate.getTime() < configuredStart.getTime() ? configuredStart : firstCandidate;
  if (startDate.getTime() > targetDate.getTime()) {
    return [];
  }

  const days: string[] = [];
  for (let cursor = startDate; cursor.getTime() <= targetDate.getTime(); cursor = addDays(cursor, 1)) {
    const day = isoDay(cursor);
    if (!existingDays.has(day)) {
      days.push(day);
    }
  }

  return days;
}

function isNetworkConnectivityError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown; errors?: unknown; cause?: unknown };
  const codes = new Set(['ENETUNREACH', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH']);

  if (typeof maybeError.code === 'string' && codes.has(maybeError.code)) {
    return true;
  }

  if (typeof maybeError.message === 'string') {
    for (const code of codes) {
      if (maybeError.message.includes(code)) {
        return true;
      }
    }
  }

  if (maybeError.errors && Symbol.iterator in Object(maybeError.errors)) {
    for (const inner of maybeError.errors as Iterable<unknown>) {
      if (isNetworkConnectivityError(inner)) {
        return true;
      }
    }
  }

  if (maybeError.cause) {
    return isNetworkConnectivityError(maybeError.cause);
  }

  return false;
}

async function main(): Promise<void> {
  const table = readCSV(DAILY_WBTC_CSV);
  const existing = table.rows.map((row) => ({ day: row.day, wbtc_usd: row.wbtc_usd })) as DayPrice[];
  existing.sort((a, b) => (a.day > b.day ? 1 : a.day < b.day ? -1 : 0));
  const targets = determineDaysToFetch(existing);
  if (targets.length === 0) {
    logger.info('No new daily WBTC price data needed.');
    return;
  }

  const provider = createProvider(ARBITRUM_RPC);
  const feed = new Contract(CHAINLINK_BTC_USD_FEED, FEED_ABI, provider);
  const decimals = Number(await feed.decimals());
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error('Invalid decimals returned by Chainlink feed');
  }

  const newRows: DayPrice[] = [];
  for (const day of targets) {
    try {
      const block = await blockAtEndOfDayUTC(provider, parseDay(day));
      const round = await feed.latestRoundData({ blockTag: block });
      const answer = Number(formatUnits(round.answer, decimals));
      if (!Number.isFinite(answer) || answer <= 0) {
        throw new Error(`Invalid price ${answer}`);
      }
      const row: DayPrice = { day, wbtc_usd: answer.toFixed(2) };
      newRows.push(row);
      logger.info(`Fetched WBTC price ${row.wbtc_usd} for ${day} via Chainlink/Infura.`);
    } catch (error) {
      logger.error(`Failed to fetch WBTC price for ${day}: ${(error as Error).message}`);
    }
  }

  if (newRows.length === 0) {
    logger.warn('No valid WBTC price rows fetched.');
    return;
  }

  upsertRows(DAILY_WBTC_CSV, ['day', 'wbtc_usd'], 'day', newRows);
  logger.info(`Appended ${newRows.length} daily WBTC price rows.`);
}

main().catch((error) => {
  if (isNetworkConnectivityError(error)) {
    logger.warn(
      `Skipping WBTC price fetch due to network connectivity issues: ${
        (error as Error).message ?? String(error)
      }`
    );
    return;
  }

  logger.error(`fetch_wbtc_daily failed: ${(error as Error).stack ?? (error as Error).message}`);
  process.exitCode = 1;
});
