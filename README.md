# dHEDGE NAV vs BTC Dashboard

Automated data exporter and static dashboard that tracks the dHEDGE vault token price on Arbitrum and benchmarks performance against Wrapped BTC (WBTC). The project collects on-chain NAV per share data, fetches WBTC/USD prices from multiple providers, derives comparison metrics, and publishes CSV datasets alongside a GitHub Pages dashboard with rich charts.

## Features

- Daily collection of the vault NAV per share (`tokenPrice()` on the PoolLogic contract).
- Daily WBTC/USD prices from CoinMarketCap (with automatic CoinGecko/CryptoCompare fallbacks) and ETag-aware caching.
- Derived NAV vs WBTC analytics (ROI in WBTC, ROI in USD, alpha vs WBTC) exported as CSV.
- Production-ready GitHub Actions pipeline that refreshes datasets, builds the dashboard, and deploys GitHub Pages without manual commits.
- Lightweight React + Vite dashboard (ECharts) with preset time range filters (1M/2M/3M/6M/ALL) that reads CSVs directly from the repository.
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
# Compile collectors and refresh CSV exports (first run backfills 365 days)
npm run daily

# Build the dashboard bundle with the freshly generated CSVs
npm run build
```

CSV outputs are written into the `public/data/` directory:

- `public/data/nav_tokenprice_usd_daily.csv` — `day,token_price_usd`
- `public/data/wbtc_usd_daily.csv` — `day,wbtc_usd`
- `public/data/nav_wbtc_daily.csv` — `day,nav_usd,wbtc_usd,nav_wbtc,roi_in_wbtc,roi_in_usd,alpha_vs_wbtc`

All CSV helpers guarantee sorted rows, unique keys, and a trailing newline.

### Environment Configuration

The exporter requires a reliable Arbitrum RPC. Configure your Infura endpoint via environment variables:

```bash
# Option 1: provide the full RPC URL
export ARBITRUM_RPC="https://arbitrum-mainnet.infura.io/v3/<your-project-id>"

# Option 2: provide the Infura project id/key and let the app build the URL
export INFURA_KEY="<your-project-id>"
# also supported: INFURA_PROJECT_ID / INFURA_API_KEY / INFURA_ARBITRUM_KEY

# Option 3: store the fully qualified URL separately
# (if you leave it as `.../v3/`, the app will append the id from INFURA_KEY; without any key Infura rejects the call)
export INFURA_ARBITRUM_RPC_URL="https://arbitrum-mainnet.infura.io/v3/<your-project-id>"

export COINMARKETCAP_API_KEY="your-api-key"
```

Add these variables to a `.env` file or GitHub Secrets for CI runs.


## GitHub Actions

One workflow lives under `.github/workflows/`:

- `deploy.yml` — runs on every push to `main` and once per day at 23:00 UTC. It installs dependencies, executes the collectors via `npm run daily`, builds the static dashboard, and uploads the `dist/` artifact for deployment.


### Publishing to GitHub Pages

1. Open **Settings → Pages** inside this repository and set **Source = GitHub Actions**. This only needs to be done once.
2. Push to `main` or wait for the nightly cron run. The workflow refreshes CSVs, builds the dashboard, and deploys automatically — no manual commits or uploads are required.
3. (Optional) Add repository secrets for premium RPC/HTTP providers (e.g. `ARBITRUM_RPC`, `HTTPS_PROXY`) if you need higher-rate endpoints.

The production dashboard is served from GitHub Pages at `https://denissilantev64.github.io/VLHXBTC-dashboard/`.

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

The dashboard loads CSVs from the repository using relative URLs, so it works automatically on GitHub Pages under a sub-path configured via `import.meta.env.BASE_URL`. The Vite configuration defaults the base path to `./`, keeping asset requests relative for both GitHub Pages and custom domains without extra environment variables.

### Chart Controls & Cards

- **Time ranges** — presets filter the daily dataset to common windows (1M/2M/3M/6M/ALL).
- **Summary cards** — show the latest VLHXBTC and WBTC prices, plus the performance spread over the selected window.
- **Auto refresh** — refreshes data every 10 minutes.

Adjust chart copy, colors, or fonts by editing `src/App.tsx`, `src/components/**/*`, or `src/styles/global.css`.

## Data Sources & Caveats

- On-chain NAV: PoolLogic contract `tokenPrice()` on Arbitrum One (`0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9`). Binary search selects the block at each day cutoff.
- WBTC/USD: CoinMarketCap `ohlcv/historical` API with automatic fallbacks to CoinGecko and CryptoCompare when needed.
- Sanity checks reject NAV points deviating more than ±10% from recent medians and fall back to additional RPCs when available.
- All timestamps are UTC.

## Customization

- **PoolLogic address** — update the `POOL_LOGIC_ADDRESS` constant in `src/config.ts`.
- **RPC endpoint** — set `ARBITRUM_RPC`, an Infura key via `INFURA_KEY`, or `INFURA_ARBITRUM_RPC_URL`.
- **Chart branding** — tweak typography/colors in `src/styles/global.css` and chart components under `src/components/`.

## Repository Structure

```
├── public/                 # Static assets for GitHub Pages (includes data/ CSVs)
├── src/                    # TypeScript source for exporters, builders, and React dashboard
├── dist/                   # Compiled JS for both collectors and dashboard (`npm run build`)
└── .github/workflows/      # GitHub Actions for automated deployment

```

## License

MIT
