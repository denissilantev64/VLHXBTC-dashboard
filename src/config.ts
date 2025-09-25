export const POOL_LOGIC_ADDRESS = '0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9';
const DEFAULT_ARBITRUM_RPC = 'https://arb1.arbitrum.io/rpc';
const DEFAULT_ARBITRUM_FALLBACKS = [
  'https://arbitrum.rpc.subquery.network/public',
  'https://1rpc.io/arb',
];
const DEFAULT_START_DATE = '2025-07-23';

function envOrUndefined(key: string): string | undefined {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const ARBITRUM_RPC = envOrUndefined('ARBITRUM_RPC') ?? DEFAULT_ARBITRUM_RPC;
const fallbackEnv = envOrUndefined('ARBITRUM_RPC_FALLBACKS');
const fallbackString =
  fallbackEnv ?? (ARBITRUM_RPC === DEFAULT_ARBITRUM_RPC ? DEFAULT_ARBITRUM_FALLBACKS.join(',') : '');
export const ARBITRUM_RPC_FALLBACKS = fallbackString
  .split(',')
  .map((url) => url.trim())
  .filter((url) => url.length > 0);

export const DAILY_NAV_CSV = 'public/data/nav_tokenprice_usd_daily.csv';
export const DAILY_WBTC_CSV = 'public/data/wbtc_usd_daily.csv';
export const DAILY_NAV_WBTC_CSV = 'public/data/nav_wbtc_daily.csv';
export const TOKEN_PRICE_START_DATE = envOrUndefined('TOKEN_PRICE_START_DATE') ?? DEFAULT_START_DATE;
export const PRICE_SERIES_START_DATE =
  envOrUndefined('PRICE_SERIES_START_DATE') ?? TOKEN_PRICE_START_DATE;

