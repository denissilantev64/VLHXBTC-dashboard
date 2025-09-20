import { execFile } from 'child_process';
import https from 'https';
import { promisify } from 'util';
import { fetchJson } from './http.js';
import { logger } from './log.js';

export interface DailyPricePoint {
  day: string;
  price: number;
}

interface CoinGeckoMarketChartResponse {
  prices: [number, number][];
}

interface CryptoCompareResponse {
  Response: string;
  Message?: string;
  Data?: {
    Data?: Array<{
      time: number;
      close: number;
    }>;
  };
}

function isoDayFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isoDayFromSeconds(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

async function fetchJsonViaHttps<T>(url: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'vlxhbtc-dashboard/1.0 (+https://github.com)',
          Accept: 'application/json',
          'Accept-Encoding': 'identity',
        },
      },
      (response) => {
        const { statusCode = 0 } = response;
        if (statusCode >= 400) {
          response.resume();
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on('end', () => {
          try {
            const text = Buffer.concat(chunks).toString('utf8');
            const parsed = JSON.parse(text) as T;
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.setTimeout(20000, () => {
      request.destroy(new Error('Request timed out'));
    });
    request.on('error', (error) => {
      reject(error);
    });
  });
}

const execFileAsync = promisify(execFile);

async function fetchJsonViaCurl<T>(url: string): Promise<T> {
  const { stdout } = await execFileAsync('curl', [
    '-sS',
    '-L',
    '-H',
    'Accept: application/json',
    '-H',
    'Accept-Encoding: identity',
    '-H',
    'User-Agent: vlxhbtc-dashboard/1.0 (+https://github.com)',
    url,
  ]);
  return JSON.parse(stdout) as T;
}

export async function fetchCoinGeckoDaily(
  coinId: string,
  cacheKey: string,
): Promise<DailyPricePoint[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=max&interval=daily`;
  let data: CoinGeckoMarketChartResponse | null = null;
  try {
    data = await fetchJson<CoinGeckoMarketChartResponse>(url, { etagCacheKey: cacheKey });
  } catch (error) {
    logger.warn(
      `CoinGecko fetch failed via standard client for ${coinId}: ${(error as Error).message}. Using HTTPS fallback.`,
    );
  }
  if (!data) {
    try {
      data = await fetchJsonViaHttps<CoinGeckoMarketChartResponse>(url);
    } catch (error) {
      logger.warn(
        `CoinGecko HTTPS fallback failed for ${coinId}: ${(error as Error).message}. Using curl fallback.`,
      );
    }
  }
  if (!data) {
    data = await fetchJsonViaCurl<CoinGeckoMarketChartResponse>(url);
  }
  if (!data || !Array.isArray(data.prices)) {
    throw new Error('Missing prices array in CoinGecko response');
  }
  const map = new Map<string, number>();
  for (const [ms, price] of data.prices) {
    const day = isoDayFromMs(ms);
    map.set(day, price);
  }
  return Array.from(map.entries()).map(([day, price]) => ({ day, price }));
}

export async function fetchCryptoCompareDaily(symbol: string): Promise<DailyPricePoint[]> {
  const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${encodeURIComponent(
    symbol,
  )}&tsym=USD&allData=true`;
  let data: CryptoCompareResponse | null = null;
  try {
    data = await fetchJson<CryptoCompareResponse>(url);
  } catch (error) {
    logger.warn(
      `CryptoCompare fetch failed via standard client for ${symbol}: ${(error as Error).message}. Using HTTPS fallback.`,
    );
  }
  if (!data) {
    try {
      data = await fetchJsonViaHttps<CryptoCompareResponse>(url);
    } catch (error) {
      logger.warn(
        `CryptoCompare HTTPS fallback failed for ${symbol}: ${(error as Error).message}. Using curl fallback.`,
      );
    }
  }
  if (!data) {
    data = await fetchJsonViaCurl<CryptoCompareResponse>(url);
  }
  if (!data || data.Response !== 'Success' || !data.Data || !Array.isArray(data.Data.Data)) {
    throw new Error(`Unexpected response`);
  }
  const rows: DailyPricePoint[] = [];
  for (const entry of data.Data.Data) {
    if (!entry || typeof entry.time !== 'number' || typeof entry.close !== 'number') {
      continue;
    }
    if (!Number.isFinite(entry.close) || entry.close <= 0) {
      continue;
    }
    const day = isoDayFromSeconds(entry.time);
    rows.push({ day, price: entry.close });
  }
  return rows;
}

interface PriceSource {
  name: string;
  fetch: () => Promise<DailyPricePoint[]>;
}

export async function fetchDailyPricesWithFallback(
  assetLabel: string,
  sources: PriceSource[],
): Promise<DailyPricePoint[]> {
  let lastError: Error | null = null;
  for (const source of sources) {
    try {
      const prices = await source.fetch();
      if (!Array.isArray(prices) || prices.length === 0) {
        throw new Error('No data returned');
      }
      logger.info(`Fetched ${prices.length} ${assetLabel} price points via ${source.name}.`);
      return prices;
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Failed to fetch ${assetLabel} via ${source.name}: ${lastError.message}`);
    }
  }
  throw lastError ?? new Error(`All sources failed for ${assetLabel}`);
}
