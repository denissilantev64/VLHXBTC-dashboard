export type RangeKey = '1D' | '1M' | '3M' | '6M' | 'ALL';

interface RangeConfig {
  days?: number;
  all?: boolean;
}

export const RANGE_CONFIG: Record<RangeKey, RangeConfig> = {
  '1D': { days: 1 },
  '1M': { days: 30 },
  '3M': { days: 90 },
  '6M': { days: 180 },
  ALL: { all: true },
};

export const RANGE_ORDER: RangeKey[] = ['1D', '1M', '3M', '6M', 'ALL'];

const DATA_SOURCES = {
  nav: 'data/nav_btc_daily.csv',
  wbtc: 'data/wbtc_usd_daily.csv',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export const DATA_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export interface DailyEntry {
  date: Date;
  isoDate: string;
  navUsd: number;
  navBtc: number;
  roiBtc: number;
  roiUsd: number;
  alphaVsBtc: number;
  btcUsd: number;
  wbtcUsd: number;
}

export interface CardStat {
  price: number | null;
  change: number | null;
}

export interface SpreadStat {
  delta: number | null;
}

export interface DashboardStats {
  vlhx: CardStat;
  wbtc: CardStat;
  spread: SpreadStat;
}

export interface PercentChangePoint {
  timestamp: number;
  isoDate: string;
  change: number;
}

function resolveAssetPath(path: string): string {
  if (!path) {
    return '';
  }
  if (/^https?:/i.test(path)) {
    return path;
  }
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.replace(/^\//, '');
  return `${normalizedBase}${normalizedPath}`;
}

async function fetchCsv(path: string): Promise<string> {
  const url = resolveAssetPath(path);
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length <= 1) {
    return [];
  }
  const header = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};
    header.forEach((key, idx) => {
      row[key] = values[idx]?.trim() ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') {
    return Number.NaN;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function toDailyEntries(rows: Record<string, string>[], wbtcMap: Map<string, number>): DailyEntry[] {
  return rows
    .map((row) => {
      const date = new Date(`${row.day}T00:00:00Z`);
      return {
        date,
        isoDate: row.day,
        navUsd: parseNumber(row.nav_usd),
        navBtc: parseNumber(row.nav_btc),
        roiBtc: parseNumber(row.roi_in_btc) * 100,
        roiUsd: parseNumber(row.roi_in_usd) * 100,
        alphaVsBtc: parseNumber(row.alpha_vs_btc) * 100,
        btcUsd: parseNumber(row.btc_usd),
        wbtcUsd: parseNumber(wbtcMap.get(row.day)),
      } satisfies DailyEntry;
    })
    .filter((entry) => entry.date instanceof Date && !Number.isNaN(entry.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function fetchDashboardData(): Promise<DailyEntry[]> {
  const [navText, wbtcText] = await Promise.all([
    fetchCsv(DATA_SOURCES.nav),
    fetchCsv(DATA_SOURCES.wbtc),
  ]);

  const wbtcRows = parseCsv(wbtcText);
  const wbtcMap = new Map<string, number>();
  wbtcRows.forEach((row) => {
    if (!row.day) {
      return;
    }
    wbtcMap.set(row.day, parseNumber(row.wbtc_usd));
  });

  const navRows = parseCsv(navText);
  return toDailyEntries(navRows, wbtcMap);
}

export function filterByRange(range: RangeKey, dataset: DailyEntry[]): DailyEntry[] {
  const config = RANGE_CONFIG[range] ?? RANGE_CONFIG.ALL;
  if (dataset.length === 0) {
    return dataset;
  }
  if (config.all) {
    return dataset;
  }
  if (config.days) {
    const lastDate = dataset[dataset.length - 1].date;
    const offsetDays = Math.max(config.days - 1, 0);
    const start = new Date(lastDate.getTime() - offsetDays * DAY_MS);
    return dataset.filter((entry) => entry.date >= start);
  }
  return dataset;
}

function computeChange(start: number | null | undefined, end: number | null | undefined): number {
  if (!Number.isFinite(start ?? Number.NaN) || !Number.isFinite(end ?? Number.NaN)) {
    return Number.NaN;
  }
  if (!start) {
    return Number.NaN;
  }
  return ((end! - start) / Math.abs(start)) * 100;
}

function lastValid(entries: DailyEntry[], key: keyof DailyEntry): DailyEntry | undefined {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const value = entries[i][key];
    if (Number.isFinite(value)) {
      return entries[i];
    }
  }
  return undefined;
}

function firstValid(entries: DailyEntry[], key: keyof DailyEntry): DailyEntry | undefined {
  for (let i = 0; i < entries.length; i += 1) {
    const value = entries[i][key];
    if (Number.isFinite(value)) {
      return entries[i];
    }
  }
  return undefined;
}

export function computeDashboardStats(filtered: DailyEntry[]): DashboardStats {
  const navFirst = firstValid(filtered, 'navUsd');
  const navLast = lastValid(filtered, 'navUsd');
  const wbtcFirst = firstValid(filtered, 'wbtcUsd');
  const wbtcLast = lastValid(filtered, 'wbtcUsd');

  const navChange = computeChange(navFirst?.navUsd ?? null, navLast?.navUsd ?? null);
  const wbtcChange = computeChange(wbtcFirst?.wbtcUsd ?? null, wbtcLast?.wbtcUsd ?? null);
  const spreadChange =
    Number.isFinite(navChange) && Number.isFinite(wbtcChange) ? (navChange as number) - (wbtcChange as number) : Number.NaN;

  return {
    vlhx: {
      price: Number.isFinite(navLast?.navUsd) ? navLast?.navUsd ?? null : null,
      change: Number.isFinite(navChange) ? (navChange as number) : null,
    },
    wbtc: {
      price: Number.isFinite(wbtcLast?.wbtcUsd) ? wbtcLast?.wbtcUsd ?? null : null,
      change: Number.isFinite(wbtcChange) ? (wbtcChange as number) : null,
    },
    spread: {
      delta: Number.isFinite(spreadChange) ? (spreadChange as number) : null,
    },
  };
}

export function getAvailableRanges(dataset: DailyEntry[]): RangeKey[] {
  if (dataset.length === 0) {
    return RANGE_ORDER;
  }
  return RANGE_ORDER.filter((key) => {
    const config = RANGE_CONFIG[key];
    if (!config) {
      return false;
    }
    if (config.all) {
      return true;
    }
    if (!config.days) {
      return false;
    }
    const lastDate = dataset[dataset.length - 1].date;
    const start = new Date(lastDate.getTime() - Math.max(config.days - 1, 0) * DAY_MS);
    return dataset.some((entry) => entry.date <= start);
  });
}

export function normalizeRange(range: RangeKey, dataset: DailyEntry[]): RangeKey {
  const available = getAvailableRanges(dataset);
  if (available.includes(range)) {
    return range;
  }
  return available[0] ?? 'ALL';
}

export function formatCurrency(value: number | null | undefined, locale: string): string {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return '--';
  }
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value! < 2 ? 4 : 2,
  });
  return formatter.format(value!);
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return '--';
  }
  const formatted = (value as number).toFixed(digits);
  const prefix = (value as number) > 0 ? '+' : '';
  return `${prefix}${formatted}%`;
}

export function computePercentChangeData(filtered: DailyEntry[], key: keyof DailyEntry): PercentChangePoint[] {
  const valid = filtered.filter((entry) => Number.isFinite(entry[key] as number));
  if (valid.length === 0) {
    return [];
  }
  const base = valid[0][key] as number;
  return valid.map((entry) => ({
    timestamp: entry.date.getTime(),
    isoDate: entry.isoDate,
    change: computeChange(base, entry[key] as number),
  }));
}

export function computeDifferenceSeries(
  navChanges: PercentChangePoint[],
  wbtcChanges: PercentChangePoint[],
): Array<[number, number]> {
  const wbtcMap = new Map(wbtcChanges.map((item) => [item.isoDate, item.change]));
  return navChanges
    .map((item) => {
      const wbtcChange = wbtcMap.get(item.isoDate);
      if (!Number.isFinite(wbtcChange)) {
        return null;
      }
      return [item.timestamp, item.change - (wbtcChange as number)] as [number, number];
    })
    .filter((value): value is [number, number] => Array.isArray(value));
}
