# dHEDGE NAV vs BTC Dashboard

Automated data exporter and static dashboard that tracks the dHEDGE vault token price on Arbitrum and benchmarks performance against Bitcoin. The project collects on-chain NAV per share data, fetches BTC/USD prices from CoinGecko, derives comparison metrics, and publishes CSV datasets alongside a GitHub Pages dashboard with rich charts.

## Features

- Daily collection of the vault NAV per share (`tokenPrice()` on the PoolLogic contract).
- Daily BTC/USD and WBTC/USD prices from CoinGecko with ETag-aware caching.
- Derived NAV vs BTC analytics (ROI in BTC, ROI in USD, alpha vs BTC) exported as CSV.
- Automated GitHub Actions workflow that backfills data, updates CSVs, and publishes the dashboard to GitHub Pages without manual steps.
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

Run the daily jobs locally. The first run backfills 365 days of NAV data.

```bash
# Build TypeScript -> dist-node/
npm run build

# Run daily collectors (NAV, BTC, WBTC, derived metrics)
npm run daily
```

CSV outputs are written into the gitignored `data/` directory:

- `data/nav_tokenprice_usd_daily.csv` — `day,token_price_usd`
- `data/btc_usd_daily.csv` — `day,btc_usd`
- `data/wbtc_usd_daily.csv` — `day,wbtc_usd`
- `data/nav_btc_daily.csv` — `day,nav_usd,btc_usd,nav_btc,roi_in_btc,roi_in_usd,alpha_vs_btc`

> **Note:** Because `data/` is generated on the fly it is excluded from version control. Run `npm run daily` before `npm run build` or `npm run serve` to populate CSVs locally.

All CSV helpers guarantee sorted rows, unique keys, and a trailing newline.

### Environment Configuration

By default the exporter uses the public Arbitrum RPC. Override or add fallbacks with environment variables:

```bash
export ARBITRUM_RPC="https://arb1.arbitrum.io/rpc"
export ARBITRUM_RPC_FALLBACKS="https://arb1.arbitrum.io/rpc,https://arb-mainnet.g.alchemy.com/v2/demo"
export GITHUB_PAGES_BASE="/VLHXBTC-dashboard/" # optional for local GitHub Pages parity
```

Create a `.env` or add these variables in GitHub Secrets to use premium endpoints. The deploy workflow injects `GITHUB_PAGES_BASE` automatically so the built site uses the correct asset paths on GitHub Pages.

## GitHub Actions

The deploy pipeline lives under `.github/workflows/`:

- `deploy.yml` — runs on every push to `main` and once per day at 23:00 UTC. It installs dependencies, executes `npm run daily` to refresh CSV exports, builds the static dashboard with the GitHub Pages base path, and publishes the `dist/` artifact via `actions/deploy-pages`.


### Publishing to GitHub Pages

1. Open **Settings → Pages** inside this repository and set **Source = GitHub Actions**. This only needs to be done once.
2. Push to `main` or wait for the nightly schedule. The workflow uploads the `dist/` bundle and CSVs as a Pages artifact automatically.
3. (Optional) Add repository secrets for premium RPC/HTTP providers (e.g. `ARBITRUM_RPC`, `HTTPS_PROXY`) if you need higher-rate endpoints.

Once the deployment job finishes, the dashboard is available at `https://<owner>.github.io/VLHXBTC-dashboard/`. The workflow bundles freshly generated CSVs into the published artifact so the dashboard always reads the latest `/data/*.csv` files from Pages.


## Dashboard

The static dashboard is served from `public/` and deployed to GitHub Pages.

To preview locally:

```bash
npm run build
npm run serve
# open http://localhost:4173
```

The dashboard loads CSVs from the deployed site (`/data/*.csv`) so the scheduled workflow can publish fresh datasets without committing them. To source data from another repository, add `github-owner` and `github-repo` meta values or pass `?owner=<owner>&repo=<repo>` in the query string — the app will fall back to raw GitHub URLs when overrides are provided.

### Chart Controls & Cards

- **Time ranges** — presets filter the daily dataset to common windows (1D/1W/1M/3M/YTD/ALL).
- **Summary cards** — show the latest ROI in BTC, alpha vs BTC, and NAV denominated in BTC.
- **Auto refresh** — refreshes data every 10 minutes.

Adjust chart copy, colors, or fonts by editing `public/index.html` and `public/dashboard.js`.

## Data Sources & Caveats

- On-chain NAV: PoolLogic contract `tokenPrice()` on Arbitrum One (`0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9`). Binary search selects the block at each day cutoff.
- BTC/USD & WBTC/USD: CoinGecko `market_chart` API with ETag caching and automatic fallback to CryptoCompare when needed.
- Sanity checks reject NAV points deviating more than ±10% from recent medians and fall back to additional RPCs when available.
- All timestamps are UTC.

## Customization

- **PoolLogic address** — update the `POOL_LOGIC_ADDRESS` constant in `src/config.ts`.
- **RPC endpoints** — set `ARBITRUM_RPC` / `ARBITRUM_RPC_FALLBACKS` env vars.
- **Chart branding** — tweak typography/colors in `public/index.html` and `public/dashboard.js`.

## Repository Structure

```
├── data/                   # Generated CSV outputs (gitignored; run `npm run daily`)
├── public/                 # Static dashboard source consumed by Vite
├── src/                    # TypeScript source for exporters and builders
├── dist-node/              # Compiled Node.js scripts (`npm run build:node`)
├── dist/                   # Production dashboard bundle (`npm run build`)
└── .github/workflows/      # GitHub Actions for data refresh + deployment
```

## License

MIT
