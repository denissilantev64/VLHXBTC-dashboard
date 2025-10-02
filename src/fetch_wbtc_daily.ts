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
import { fetchCoinGeckoDaily, fetchCryptoCompareDaily, type DailyPricePoint } from './utils/prices.js';

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

  const newRows: DayPrice[] = [];
  const successfulDays = new Set<string>();
  const provider = createProvider(ARBITRUM_RPC);
  const feed = new Contract(CHAINLINK_BTC_USD_FEED, FEED_ABI, provider);
  let decimals: number | null = null;

  try {
    decimals = Number(await feed.decimals());
    if (!Number.isInteger(decimals) || decimals < 0) {
      logger.error(`Invalid decimals returned by Chainlink feed: ${decimals}`);
      decimals = null;
    }
  } catch (error) {
    if (isNetworkConnectivityError(error)) {
      logger.warn(
        `Unable to resolve Chainlink feed decimals due to connectivity issues: ${(error as Error).message}`,
      );
    } else {
      throw error;
    }
  }

  if (decimals !== null) {
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
        successfulDays.add(day);
        logger.info(`Fetched WBTC price ${row.wbtc_usd} for ${day} via Chainlink/Infura.`);
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          logger.warn(
            `Connectivity issue while fetching WBTC price for ${day}: ${(error as Error).message}`,
          );
        } else {
          logger.error(`Failed to fetch WBTC price for ${day}: ${(error as Error).message}`);
        }
      }
    }
  }

  const missingDays = targets.filter((day) => !successfulDays.has(day));

  if (missingDays.length > 0) {
    logger.warn(`Falling back to HTTP price providers for ${missingDays.join(', ')}.`);
    const fallbackRows = await fetchFallbackPrices(missingDays);
    for (const row of fallbackRows) {
      if (!successfulDays.has(row.day)) {
        newRows.push(row);
        successfulDays.add(row.day);
      }
    }
  }

  if (newRows.length === 0) {
    logger.warn('No valid WBTC price rows fetched.');
    return;
  }

  upsertRows(DAILY_WBTC_CSV, ['day', 'wbtc_usd'], 'day', newRows);
  logger.info(`Appended ${newRows.length} daily WBTC price rows.`);
}

function normalizeDailyPoints(points: DailyPricePoint[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of points) {
    if (!point || !point.day) {
      continue;
    }
    if (!Number.isFinite(point.price) || point.price <= 0) {
      continue;
    }
    map.set(point.day, point.price);
  }
  return map;
}

async function fetchFallbackPrices(days: string[]): Promise<DayPrice[]> {
  if (days.length === 0) {
    return [];
  }

  const earliest = days.slice().sort()[0];
  const rows: DayPrice[] = [];
  const maps: Map<string, number>[] = [];

  try {
    const gecko = await fetchCoinGeckoDaily('wrapped-bitcoin', 'wbtc-usd-daily', earliest);
    maps.push(normalizeDailyPoints(gecko));
  } catch (error) {
    logger.error(`CoinGecko fallback failed: ${(error as Error).message}`);
  }

  try {
    const cryptoCompare = await fetchCryptoCompareDaily('WBTC', earliest);
    maps.push(normalizeDailyPoints(cryptoCompare));
  } catch (error) {
    logger.error(`CryptoCompare fallback failed: ${(error as Error).message}`);
  }

  if (maps.length === 0) {
    return [];
  }

  for (const day of days) {
    let price: number | undefined;
    for (const map of maps) {
      const candidate = map.get(day);
      if (candidate !== undefined) {
        price = candidate;
        break;
      }
    }
    if (price === undefined) {
      logger.warn(`No fallback price available for ${day}.`);
      continue;
    }
    rows.push({ day, wbtc_usd: price.toFixed(2) });
  }

  return rows;
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
