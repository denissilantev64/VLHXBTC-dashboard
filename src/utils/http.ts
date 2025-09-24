import fs from 'fs';
import path from 'path';
import { logger } from './log.js';

const CACHE_DIR = path.resolve('.cache');
const ETAG_FILE = path.join(CACHE_DIR, 'etags.json');
const RESPONSE_DIR = path.join(CACHE_DIR, 'responses');

interface FetchJsonOptions {
  etagCacheKey?: string;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

interface EtagStore {
  [key: string]: string;
}

function ensureCache(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  if (!fs.existsSync(RESPONSE_DIR)) {
    fs.mkdirSync(RESPONSE_DIR, { recursive: true });
  }
  if (!fs.existsSync(ETAG_FILE)) {
    fs.writeFileSync(ETAG_FILE, '{}', 'utf8');
  }
}

function loadEtags(): EtagStore {
  ensureCache();
  try {
    const raw = fs.readFileSync(ETAG_FILE, 'utf8');
    return JSON.parse(raw) as EtagStore;
  } catch (error) {
    logger.warn(`Failed to read etag cache, resetting. ${(error as Error).message}`);
    fs.writeFileSync(ETAG_FILE, '{}', 'utf8');
    return {};
  }
}

function saveEtags(store: EtagStore): void {
  ensureCache();
  fs.writeFileSync(ETAG_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function responseCachePath(cacheKey: string): string {
  return path.join(RESPONSE_DIR, `${cacheKey}.json`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { etagCacheKey, timeoutMs = 15000, retries = 5, headers: extraHeaders = {} } = options;
  const etags = loadEtags();
  const headers: Record<string, string> = {
    'User-Agent': 'vlxhbtc-dashboard/1.0 (+https://github.com)',
    ...extraHeaders,
  };
  if (etagCacheKey && etags[etagCacheKey]) {
    headers['If-None-Match'] = etags[etagCacheKey];
  }
  let attempt = 0;
  let backoff = 250;
  let lastError: Error | undefined;
  while (attempt < retries) {
    attempt += 1;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 304) {
        if (!etagCacheKey) {
          throw new Error('Received 304 but no etag cache key provided');
        }
        const cachePath = responseCachePath(etagCacheKey);
        if (!fs.existsSync(cachePath)) {
          throw new Error(`ETag cache miss for ${etagCacheKey}`);
        }
        const cached = fs.readFileSync(cachePath, 'utf8');
        return JSON.parse(cached) as T;
      }
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
        logger.warn(`Request to ${url} failed with ${res.status}. Retrying in ${backoff}ms...`);
        await delay(backoff);
        backoff *= 2;
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
      }
      const text = await res.text();
      const data = JSON.parse(text) as T;
      if (etagCacheKey) {
        const etag = res.headers.get('etag');
        if (etag) {
          etags[etagCacheKey] = etag;
          saveEtags(etags);
        }
        const cachePath = responseCachePath(etagCacheKey);
        fs.writeFileSync(cachePath, text, 'utf8');
      }
      return data;
    } catch (error) {
      const err = error as Error;
      if (err.name === 'AbortError') {
        lastError = new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
      } else {
        lastError = err;
      }
      logger.warn(`Attempt ${attempt} for ${url} failed: ${lastError.message}`);
      await delay(backoff);
      backoff *= 2;
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
