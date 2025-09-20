export const POOL_LOGIC_ADDRESS = '0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9';
export const ARBITRUM_RPC = process.env.ARBITRUM_RPC ?? 'https://arb1.arbitrum.io/rpc';
export const ARBITRUM_RPC_FALLBACKS = (process.env.ARBITRUM_RPC_FALLBACKS ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter((url) => url.length > 0);

export const DAILY_NAV_CSV = 'data/nav_tokenprice_usd_daily.csv';
export const HOURLY_NAV_CSV = 'data/nav_tokenprice_usd_hourly.csv';
export const DAILY_BTC_CSV = 'data/btc_usd_daily.csv';
export const HOURLY_BTC_CSV = 'data/btc_usd_hourly.csv';
export const DAILY_NAV_BTC_CSV = 'data/nav_btc_daily.csv';
export const HOURLY_NAV_BTC_CSV = 'data/nav_btc_hourly.csv';
export const TOKEN_PRICE_START_DATE = process.env.TOKEN_PRICE_START_DATE ?? '2025-09-15';
