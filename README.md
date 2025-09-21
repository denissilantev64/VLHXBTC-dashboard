# dHEDGE NAV vs BTC Dashboard

Automated data exporter and static dashboard that tracks the dHEDGE vault token price on Arbitrum and benchmarks performance against Bitcoin. The project collects on-chain NAV per share data, fetches BTC/USD prices from CoinGecko, derives comparison metrics, and publishes CSV datasets alongside a GitHub Pages dashboard with rich charts.

## Features

- Daily collection of the vault NAV per share (`tokenPrice()` on the PoolLogic contract).
- Daily BTC/USD and WBTC/USD prices from CoinGecko with ETag-aware caching.
- Derived NAV vs BTC analytics (ROI in BTC, ROI in USD, alpha vs BTC) exported as CSV.
- Production-ready GitHub Actions that backfill data, append new rows, commit updates, and deploy GitHub Pages.
- Lightweight React + Vite dashboard (ECharts) with preset time range filters (1D/1M/3M/6M/ALL) that reads CSVs directly from the repository.
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

Run the daily jobs locally. The first run backfills 365 days of NAV data.

```bash
# Build TypeScript collectors and the dashboard
npm run build

# Run daily collectors (NAV, BTC, WBTC, derived metrics)
npm run daily
```

CSV outputs are written into the `public/data/` directory:

- `public/data/nav_tokenprice_usd_daily.csv` — `day,token_price_usd`
- `public/data/btc_usd_daily.csv` — `day,btc_usd`
- `public/data/wbtc_usd_daily.csv` — `day,wbtc_usd`
- `public/data/nav_btc_daily.csv` — `day,nav_usd,btc_usd,nav_btc,roi_in_btc,roi_in_usd,alpha_vs_btc`

All CSV helpers guarantee sorted rows, unique keys, and a trailing newline.

### Environment Configuration

By default the exporter uses the public Arbitrum RPC. Override or add fallbacks with environment variables:

```bash
export ARBITRUM_RPC="https://arb1.arbitrum.io/rpc"
export ARBITRUM_RPC_FALLBACKS="https://arb1.arbitrum.io/rpc,https://arb-mainnet.g.alchemy.com/v2/demo"
```

Create a `.env` or add these variables in GitHub Secrets to use premium endpoints.

## GitHub Actions

One workflow lives under `.github/workflows/`:

- `daily.yml` — runs once per day at 23:00 UTC and via manual dispatch. It executes the NAV/BTC/WBTC collectors, derives metrics, commits CSVs, and deploys GitHub Pages with the dashboard.


### Publishing to GitHub Pages

1. Open **Settings → Pages** inside this repository and set **Source = GitHub Actions**. This only needs to be done once.
2. Trigger the workflow the first time via **Actions → Daily Data Update → Run workflow** (the scheduled cron run will handle subsequent days).
3. Wait for the `Deploy to GitHub Pages` job to finish — the Pages status badge in the run turns green when deployment succeeds.
4. (Optional) Add repository secrets for premium RPC/HTTP providers (e.g. `ARBITRUM_RPC`, `HTTPS_PROXY`) if you need higher-rate endpoints.

After the workflow completes the deployment step, the dashboard is available at `https://<owner>.github.io/<repo>/` and serves the CSVs from `/data/` (copied from `public/data/`).


## Dashboard

The static dashboard is served from `public/` and deployed to GitHub Pages.

To work on the dashboard locally:

```bash
npm run dev
# open http://localhost:5173

# build a production bundle and preview it
npm run build
npm run preview
```

The dashboard loads CSVs from the repository using relative URLs, so it works automatically on GitHub Pages under a sub-path configured via `import.meta.env.BASE_URL`.

### Chart Controls & Cards

- **Time ranges** — presets filter the daily dataset to common windows (1D/1M/3M/6M/ALL).
- **Summary cards** — show the latest VLHXBTC and WBTC prices, plus the performance spread over the selected window.
- **Auto refresh** — refreshes data every 10 minutes.

Adjust chart copy, colors, or fonts by editing `src/App.tsx`, `src/components/**/*`, or `src/styles/global.css`.

## Data Sources & Caveats

- On-chain NAV: PoolLogic contract `tokenPrice()` on Arbitrum One (`0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9`). Binary search selects the block at each day cutoff.
- BTC/USD & WBTC/USD: CoinGecko `market_chart` API with ETag caching and automatic fallback to CryptoCompare when needed.
- Sanity checks reject NAV points deviating more than ±10% from recent medians and fall back to additional RPCs when available.
- All timestamps are UTC.

## Customization

- **PoolLogic address** — update the `POOL_LOGIC_ADDRESS` constant in `src/config.ts`.
- **RPC endpoints** — set `ARBITRUM_RPC` / `ARBITRUM_RPC_FALLBACKS` env vars.
- **Chart branding** — tweak typography/colors in `src/styles/global.css` and chart components under `src/components/`.

## Repository Structure

```
├── public/                 # Static assets for GitHub Pages (includes data/ CSVs)
├── src/                    # TypeScript source for exporters, builders, and React dashboard
├── dist/                   # Compiled JS (ignored until `npm run build`)
└── .github/workflows/      # GitHub Actions for daily automation
```

## License

MIT
