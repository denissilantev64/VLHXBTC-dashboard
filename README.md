# dHEDGE NAV vs BTC Dashboard

Automated data exporter and static dashboard that tracks the dHEDGE vault token price on Arbitrum and benchmarks performance against Bitcoin. The project collects on-chain NAV per share data, fetches BTC/USD prices from CoinGecko, derives comparison metrics, and publishes CSV datasets alongside a GitHub Pages dashboard with rich charts.

## Features

- Hourly and daily collection of the vault NAV per share (`tokenPrice()` on the PoolLogic contract).
- Hourly (90 days) and daily (full history) BTC/USD prices from CoinGecko with ETag-aware caching.
- Derived NAV vs BTC analytics (ROI in BTC, ROI in USD, alpha vs BTC) exported as CSV.
- Production-ready GitHub Actions that backfill data, append new rows, commit updates, and deploy GitHub Pages.
- Lightweight static dashboard (ECharts) with preset time range filters (1D/1W/1M/3M/YTD/ALL) that reads CSVs directly from the repository.
- Robust error handling, exponential backoff for HTTP requests, RPC fallbacks, and data sanity checks.

## Getting Started

### Requirements

- Node.js 20+
- npm 9+

### Installation

```bash
npm install
```

### Local Data Export

Run the daily and hourly jobs locally. The first run backfills 365 days of NAV data and 72 hours of hourly NAV data.

```bash
# Build TypeScript -> dist/
npm run build

# Run daily collectors (NAV, BTC, derived metrics)
npm run daily

# Run hourly collectors (NAV, BTC, derived metrics)
npm run hourly
```

CSV outputs are written into the `data/` directory:

- `data/nav_tokenprice_usd_daily.csv` — `day,token_price_usd`
- `data/nav_tokenprice_usd_hourly.csv` — `ts,token_price_usd`
- `data/btc_usd_daily.csv` — `day,btc_usd`
- `data/btc_usd_hourly.csv` — `ts,btc_usd`
- `data/nav_btc_daily.csv` — `day,nav_usd,btc_usd,nav_btc,roi_in_btc,roi_in_usd,alpha_vs_btc`
- `data/nav_btc_hourly.csv` — `ts,nav_usd,btc_usd,nav_btc,roi_in_btc,roi_in_usd,alpha_vs_btc`

All CSV helpers guarantee sorted rows, unique keys, and a trailing newline.

### Environment Configuration

By default the exporter uses the public Arbitrum RPC. Override or add fallbacks with environment variables:

```bash
export ARBITRUM_RPC="https://arb1.arbitrum.io/rpc"
export ARBITRUM_RPC_FALLBACKS="https://arb1.arbitrum.io/rpc,https://arb-mainnet.g.alchemy.com/v2/demo"
```

Create a `.env` or add these variables in GitHub Secrets to use premium endpoints.

## GitHub Actions

Two workflows live under `.github/workflows/`:

- `hourly.yml` — runs every hour (`0 * * * *`) and via manual dispatch. Executes hourly NAV + BTC fetchers and derived metric builder, then commits updated CSVs.
- `daily.yml` — runs daily at 23:20 UTC and via manual dispatch. Executes daily NAV + BTC fetchers, builds daily metrics, commits CSVs, and deploys GitHub Pages with the dashboard.

Both workflows configure `user.name`/`user.email`, only commit when data changes, and push to `main`.

## Dashboard

The static dashboard is served from `public/` and deployed to GitHub Pages.

To preview locally:

```bash
npm run build
npm run serve
# open http://localhost:8080
```

The dashboard loads CSVs from the repository using raw GitHub URLs. When hosted on GitHub Pages (e.g., `https://<owner>.github.io/<repo>/`), it automatically infers the repo owner/name. For alternative hosting, add `github-owner` and `github-repo` meta values or pass `?owner=<owner>&repo=<repo>` in the query string.

### Chart Controls & Cards

- **Time ranges** — 1D/1W use hourly data; longer ranges use daily data.
- **Summary cards** — show the latest ROI in BTC, alpha vs BTC, and NAV denominated in BTC.
- **Auto refresh** — refreshes data every 10 minutes.

Adjust chart copy, colors, or fonts by editing `public/index.html` and `public/dashboard.js`.

## Data Sources & Caveats

- On-chain NAV: PoolLogic contract `tokenPrice()` on Arbitrum One (`0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9`). Binary search selects the block at each hour/day cutoff.
- BTC/USD: CoinGecko `market_chart` API with ETag caching to minimize rate limits.
- Sanity checks reject NAV points deviating more than ±10% from recent medians and fall back to additional RPCs when available.
- All timestamps are UTC.

## Customization

- **PoolLogic address** — update the `POOL_LOGIC_ADDRESS` constant in `src/config.ts`.
- **RPC endpoints** — set `ARBITRUM_RPC` / `ARBITRUM_RPC_FALLBACKS` env vars.
- **Chart branding** — tweak typography/colors in `public/index.html` and `public/dashboard.js`.

## Repository Structure

```
├── data/                   # CSV artifacts committed to the repo
├── public/                 # Static dashboard deployed to GitHub Pages
├── src/                    # TypeScript source for exporters and builders
├── dist/                   # Compiled JS (ignored until `npm run build`)
└── .github/workflows/      # GitHub Actions for hourly & daily automation
```

## License

MIT
