const RANGE_CONFIG = {
  '1D': { days: 1 },
  '1W': { days: 7 },
  '1M': { days: 30 },
  '3M': { days: 90 },
  YTD: { ytd: true },
  ALL: { all: true },
};

const state = {
  daily: [],
  range: '1D',
  charts: {},
};

function getMetaContent(name) {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el ? el.content.trim() : '';
}

function detectRepo() {
  const ownerParam = new URLSearchParams(window.location.search).get('owner');
  const repoParam = new URLSearchParams(window.location.search).get('repo');
  const ownerMeta = getMetaContent('github-owner');
  const repoMeta = getMetaContent('github-repo');
  if (ownerParam && repoParam) {
    return { owner: ownerParam, repo: repoParam };
  }
  if (ownerMeta && repoMeta) {
    return { owner: ownerMeta, repo: repoMeta };
  }
  const host = window.location.hostname;
  if (host.endsWith('.github.io')) {
    const owner = host.replace('.github.io', '');
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return { owner, repo: pathParts[0] };
    }
  }
  return null;
}

function resolveCsvUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:/i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const repo = detectRepo();
  if (!repo) {
    return pathOrUrl;
  }
  const path = pathOrUrl.replace(/^\//, '');
  return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/main/${path}`;
}

async function fetchCsv(pathOrUrl) {
  const url = resolveCsvUrl(pathOrUrl);
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length <= 1) {
    return [];
  }
  const header = lines[0].split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(',');
    const row = {};
    header.forEach((key, idx) => {
      row[key] = values[idx];
    });
    rows.push(row);
  }
  return rows;
}

function toDailyData(rows) {
  return rows.map((row) => ({
    date: new Date(`${row.day}T00:00:00Z`),
    nav_btc: Number(row.nav_btc),
    roi_in_btc: Number(row.roi_in_btc) * 100,
    roi_in_usd: Number(row.roi_in_usd) * 100,
    alpha_vs_btc: Number(row.alpha_vs_btc) * 100,
  }));
}

function filterData(rangeKey) {
  const config = RANGE_CONFIG[rangeKey] || RANGE_CONFIG['ALL'];
  const now = new Date();
  const dataset = state.daily;
  if (config.all || dataset.length === 0) {
    return dataset;
  }
  if (config.ytd) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return dataset.filter((row) => row.date >= start);
  }
  if (config.days) {
    const start = new Date(now.getTime() - config.days * 24 * 60 * 60 * 1000);
    return dataset.filter((row) => row.date >= start);
  }
  return dataset;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatBtc(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  return `${value.toFixed(8)} BTC`;
}

function updateCards() {
  const source = state.daily;
  if (source.length === 0) {
    return;
  }
  const latest = source[source.length - 1];
  document.getElementById('roi-btc').textContent = formatPercent(latest.roi_in_btc);
  document.getElementById('alpha-btc').textContent = formatPercent(latest.alpha_vs_btc);
  document.getElementById('nav-btc').textContent = formatBtc(latest.nav_btc);
}

function initCharts() {
  state.charts.roi = echarts.init(document.getElementById('chart-roi-btc'));
  state.charts.alpha = echarts.init(document.getElementById('chart-alpha'));
  state.charts.nav = echarts.init(document.getElementById('chart-nav'));
  window.addEventListener('resize', () => {
    Object.values(state.charts).forEach((chart) => chart.resize());
  });
}

function chartOptions(title, dataKey, data) {
  const seriesData = data.map((row) => [row.date.getTime(), row[dataKey]]);
  const isPercent = dataKey !== 'nav_btc';
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) =>
        isPercent ? `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%` : `${Number(value).toFixed(8)} BTC`,
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        color: '#94a3b8',
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#94a3b8',
        formatter: (value) => (isPercent ? `${value.toFixed(0)}%` : value.toFixed(4)),
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(148, 163, 184, 0.2)',
        },
      },
    },
    grid: {
      left: 40,
      right: 16,
      top: 20,
      bottom: 40,
    },
    series: [
      {
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: seriesData,
        lineStyle: {
          width: 2,
        },
        areaStyle: {
          opacity: 0.08,
        },
      },
    ],
    textStyle: {
      color: '#e2e8f0',
    },
    backgroundColor: 'transparent',
  };
}

function updateCharts(rangeKey) {
  const filtered = filterData(rangeKey);
  Object.entries({
    roi: 'roi_in_btc',
    alpha: 'alpha_vs_btc',
    nav: 'nav_btc',
  }).forEach(([chartKey, dataKey]) => {
    const chart = state.charts[chartKey];
    if (!chart) return;
    if (filtered.length === 0) {
      chart.clear();
      return;
    }
    chart.setOption(chartOptions(chartKey, dataKey, filtered));
  });
}

async function loadData() {
  const dailyPath = getMetaContent('data-nav-daily');
  try {
    const dailyText = await fetchCsv(dailyPath);
    state.daily = toDailyData(parseCsv(dailyText));
    updateCards();
    updateCharts(state.range);
  } catch (error) {
    console.error('Failed to load dashboard data', error);
  }
}

function initFilters() {
  document.querySelectorAll('.filters button').forEach((button) => {
    button.addEventListener('click', () => {
      const range = button.dataset.range;
      state.range = range;
      document.querySelectorAll('.filters button').forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      updateCharts(range);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  initFilters();
  loadData();
  setInterval(loadData, 10 * 60 * 1000);
});
