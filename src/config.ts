export const POOL_LOGIC_ADDRESS = '0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9';
const DEFAULT_START_DATE = '2025-07-23';

function envOrUndefined(key: string): string | undefined {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function ensureInfuraProjectId(url: string, projectId: string | undefined): string {
  const trimmed = url.trim();
  if (/\/v3\/?$/.test(trimmed)) {
    if (!projectId) {
      throw new Error(
        'INFURA_ARBITRUM_RPC_URL ends with /v3/ but no project id is available. Provide INFURA_KEY or append the id to the URL.'
      );
    }
    const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
    return `${withoutTrailingSlash}/${projectId}`;
  }
  return trimmed;
}

function resolveRpcEndpoint(): string {
  const explicitRpc = envOrUndefined('ARBITRUM_RPC');
  const infuraProjectId =
    envOrUndefined('INFURA_PROJECT_ID') ??
    envOrUndefined('INFURA_API_KEY') ??
    envOrUndefined('INFURA_ARBITRUM_KEY') ??
    envOrUndefined('INFURA_KEY');

  const infuraRpcEnv =
    envOrUndefined('INFURA_ARBITRUM_RPC') ?? envOrUndefined('INFURA_ARBITRUM_RPC_URL');

  const infuraRpc = infuraRpcEnv
    ? ensureInfuraProjectId(infuraRpcEnv, infuraProjectId)
    : infuraProjectId
      ? `https://arbitrum-mainnet.infura.io/v3/${infuraProjectId}`
      : undefined;

  const rpc = explicitRpc ?? infuraRpc;

  if (rpc) {
    return rpc;
  }

  // Fall back to the public Arbitrum RPC so that static builds can
  // succeed even when no environment variables are configured. The
  // public endpoint has lower rate limits, but it is sufficient for the
  // build step where we just need to render the static site.
  return 'https://arb1.arbitrum.io/rpc';
}

export const ARBITRUM_RPC = resolveRpcEndpoint();

export const DAILY_NAV_CSV = 'public/data/nav_tokenprice_usd_daily.csv';
export const DAILY_WBTC_CSV = 'public/data/wbtc_usd_daily.csv';
export const DAILY_NAV_WBTC_CSV = 'public/data/nav_wbtc_daily.csv';
export const TOKEN_PRICE_START_DATE = envOrUndefined('TOKEN_PRICE_START_DATE') ?? DEFAULT_START_DATE;
export const PRICE_SERIES_START_DATE =
  envOrUndefined('PRICE_SERIES_START_DATE') ?? TOKEN_PRICE_START_DATE;
export const CHAINLINK_BTC_USD_FEED =
  envOrUndefined('CHAINLINK_BTC_USD_FEED') ?? '0x6ce185860a4963106506C203335A2910413708e9';

