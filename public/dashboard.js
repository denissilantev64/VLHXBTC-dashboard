const RANGE_CONFIG = {
  '1D': { days: 1 },
  '1W': { days: 7 },
  '1M': { days: 30 },
  '3M': { days: 90 },
  YTD: { ytd: true },
  ALL: { all: true },
};

const TRANSLATIONS = {
  ru: {
    title: 'Valhalla BTC против WBTC',
    description:
      'Ежедневные данные фонда Valhalla BTC, сравнение с динамикой WBTC. Информация обновляется автоматически каждые 10 минут.',
    footer: 'Данные получены из открытых источников (CoinGecko, Arbitrum) и обновляются ежедневно. Визуализация с помощью ECharts.',
    filters: {
      '1D': '1Д',
      '1W': '1Н',
      '1M': '1М',
      '3M': '3М',
      YTD: 'СГ',
      ALL: 'Всё',
    },
    cards: {
      vlhx: { label: 'VLHXBTC', change: 'Изменение за период' },
      wbtc: { label: 'WBTC', change: 'Изменение за период' },
      spread: { label: 'Разница в изменении', note: 'Изменение VLHXBTC минус изменение WBTC' },
    },
    charts: {
      price: {
        title: 'Цена WBTC и VLHXBTC (USD)',
        series: {
          wbtc: 'Цена WBTC',
          vlhx: 'Цена VLHXBTC',
        },
      },
      change: {
        title: 'Изменение цен WBTC и VLHXBTC (%)',
        series: {
          wbtc: 'Изменение WBTC',
          vlhx: 'Изменение VLHXBTC',
        },
      },
      diff: {
        title: 'Разница изменения (%)',
        series: {
          diff: 'Разница изменений',
        },
      },
    },
  },
  en: {
    title: 'Valhalla BTC vs WBTC',
    description:
      'Daily metrics for the Valhalla BTC fund benchmarked against WBTC. Data refreshes automatically every 10 minutes.',
    footer: 'Data is sourced from public feeds (CoinGecko, Arbitrum) and updates daily. Visualised with ECharts.',
    filters: {
      '1D': '1D',
      '1W': '1W',
      '1M': '1M',
      '3M': '3M',
      YTD: 'YTD',
      ALL: 'All',
    },
    cards: {
      vlhx: { label: 'VLHXBTC', change: 'Change over period' },
      wbtc: { label: 'WBTC', change: 'Change over period' },
      spread: { label: 'Performance spread', note: 'VLHXBTC change minus WBTC change' },
    },
    charts: {
      price: {
        title: 'WBTC and VLHXBTC Price (USD)',
        series: {
          wbtc: 'WBTC Price',
          vlhx: 'VLHXBTC Price',
        },
      },
      change: {
        title: 'WBTC and VLHXBTC Price Change (%)',
        series: {
          wbtc: 'WBTC Change',
          vlhx: 'VLHXBTC Change',
        },
      },
      diff: {
        title: 'Change Difference (%)',
        series: {
          diff: 'Change spread',
        },
      },
    },
  },
};

const COLORS = {
  accent: '#00e0ff',
  secondary: '#7b61ff',
  danger: '#ff6b6b',
  background: 'rgba(17, 17, 26, 0.9)',
  grid: 'rgba(255, 255, 255, 0.08)',
  subtleText: '#7c7c8f',
  strongText: '#f5f5f5',
};

const state = {
  daily: [],
  range: '1D',
  charts: {},
  language: 'ru',
};

function getTranslations() {
  return TRANSLATIONS[state.language] || TRANSLATIONS.ru;
}

function getLocale() {
  return state.language === 'ru' ? 'ru-RU' : 'en-US';
}

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

function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return Number.NaN;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : Number.NaN;
}

function toDailyData(rows, wbtcMap = new Map()) {
  return rows
    .map((row) => {
      const date = new Date(`${row.day}T00:00:00Z`);
      return {
        date,
        isoDate: row.day,
        nav_usd: parseNumber(row.nav_usd),
        nav_btc: parseNumber(row.nav_btc),
        roi_in_btc: parseNumber(row.roi_in_btc) * 100,
        roi_in_usd: parseNumber(row.roi_in_usd) * 100,
        alpha_vs_btc: parseNumber(row.alpha_vs_btc) * 100,
        btc_usd: parseNumber(row.btc_usd),
        wbtc_usd: parseNumber(wbtcMap.get(row.day)),
      };
    })
    .filter((row) => row.date instanceof Date && !Number.isNaN(row.date.getTime()))
    .sort((a, b) => a.date - b.date);
}

function filterData(rangeKey) {
  const config = RANGE_CONFIG[rangeKey] || RANGE_CONFIG.ALL;
  const dataset = state.daily;
  if (config.all || dataset.length === 0) {
    return dataset;
  }
  const now = new Date();
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

function formatCurrency(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 2 ? 4 : 2,
  }).format(value);
}

function formatPercent(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  const formatted = value.toFixed(digits);
  return `${value > 0 ? '+' : ''}${formatted}%`;
}

function computeChange(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) {
    return Number.NaN;
  }
  return ((end - start) / Math.abs(start)) * 100;
}

function computePercentChangeData(filtered, key) {
  const valid = filtered.filter((row) => Number.isFinite(row[key]));
  if (valid.length === 0) {
    return [];
  }
  const base = valid[0][key];
  return valid.map((row) => ({
    timestamp: row.date.getTime(),
    isoDate: row.isoDate,
    change: computeChange(base, row[key]),
  }));
}

function computeDifferenceSeries(navChanges, wbtcChanges) {
  const wbtcMap = new Map(wbtcChanges.map((item) => [item.isoDate, item.change]));
  return navChanges
    .map((item) => {
      const wbtcChange = wbtcMap.get(item.isoDate);
      if (!Number.isFinite(wbtcChange)) {
        return null;
      }
      return [item.timestamp, item.change - wbtcChange];
    })
    .filter(Boolean);
}

function setDeltaClass(element, value) {
  element.classList.remove('positive', 'negative');
  if (!Number.isFinite(value)) {
    return;
  }
  element.classList.add(value >= 0 ? 'positive' : 'negative');
}

function updateCards(filtered) {
  const t = getTranslations();
  const navRows = filtered.filter((row) => Number.isFinite(row.nav_usd));
  const wbtcRows = filtered.filter((row) => Number.isFinite(row.wbtc_usd));

  const navFirst = navRows[0];
  const navLast = navRows[navRows.length - 1];
  const wbtcFirst = wbtcRows[0];
  const wbtcLast = wbtcRows[wbtcRows.length - 1];

  const navChange = computeChange(navFirst?.nav_usd, navLast?.nav_usd);
  const wbtcChange = computeChange(wbtcFirst?.wbtc_usd, wbtcLast?.wbtc_usd);
  const spreadChange = Number.isFinite(navChange) && Number.isFinite(wbtcChange) ? navChange - wbtcChange : Number.NaN;

  const vlhxPriceEl = document.getElementById('card-vlhx-price');
  const vlhxChangeEl = document.getElementById('card-vlhx-change');
  const wbtcPriceEl = document.getElementById('card-wbtc-price');
  const wbtcChangeEl = document.getElementById('card-wbtc-change');
  const spreadEl = document.getElementById('card-spread');
  const spreadNoteEl = document.getElementById('card-spread-note');

  vlhxPriceEl.textContent = formatCurrency(navLast?.nav_usd);
  vlhxChangeEl.textContent = `${t.cards.vlhx.change}: ${formatPercent(navChange)}`;
  setDeltaClass(vlhxChangeEl, navChange);

  wbtcPriceEl.textContent = formatCurrency(wbtcLast?.wbtc_usd);
  wbtcChangeEl.textContent = `${t.cards.wbtc.change}: ${formatPercent(wbtcChange)}`;
  setDeltaClass(wbtcChangeEl, wbtcChange);

  spreadEl.textContent = formatPercent(spreadChange);
  setDeltaClass(spreadEl, spreadChange);
  spreadNoteEl.textContent = t.cards.spread.note;
}

function createCommonChartOptions() {
  return {
    backgroundColor: COLORS.background,
    grid: {
      left: 48,
      right: 24,
      top: 32,
      bottom: 48,
    },
    textStyle: {
      color: COLORS.strongText,
      fontFamily: 'Inter, sans-serif',
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: { color: COLORS.subtleText },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: COLORS.subtleText },
      splitLine: { lineStyle: { color: COLORS.grid } },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: COLORS.accent, width: 1 },
      },
    },
    legend: {
      top: 0,
      textStyle: { color: COLORS.subtleText },
    },
    color: [COLORS.accent, COLORS.secondary, COLORS.danger],
  };
}

function updatePriceChart(filtered) {
  const chart = state.charts.price;
  if (!chart) return;
  const t = getTranslations();
  const locale = getLocale();
  const wbtcSeries = [];
  const vlhxSeries = [];

  filtered.forEach((row) => {
    const timestamp = row.date.getTime();
    if (Number.isFinite(row.wbtc_usd)) {
      wbtcSeries.push([timestamp, row.wbtc_usd]);
    }
    if (Number.isFinite(row.nav_usd)) {
      vlhxSeries.push([timestamp, row.nav_usd]);
    }
  });

  if (wbtcSeries.length === 0 && vlhxSeries.length === 0) {
    chart.clear();
    return;
  }

  const option = createCommonChartOptions();
  option.legend.data = [];
  option.yAxis.axisLabel.formatter = (value) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: value < 2 ? 4 : 0 }).format(value);
  option.tooltip.valueFormatter = (value) => formatCurrency(Number(value));
  option.series = [];

  if (wbtcSeries.length > 0) {
    option.legend.data.push(t.charts.price.series.wbtc);
    option.series.push({
      name: t.charts.price.series.wbtc,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: wbtcSeries,
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.08 },
    });
  }

  if (vlhxSeries.length > 0) {
    option.legend.data.push(t.charts.price.series.vlhx);
    option.series.push({
      name: t.charts.price.series.vlhx,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: vlhxSeries,
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.08 },
    });
  }
  chart.setOption(option, true);
}

function updateChangeChart(filtered) {
  const chart = state.charts.change;
  if (!chart) return;
  const t = getTranslations();

  const navChanges = computePercentChangeData(filtered, 'nav_usd');
  const wbtcChanges = computePercentChangeData(filtered, 'wbtc_usd');

  if (navChanges.length === 0 && wbtcChanges.length === 0) {
    chart.clear();
    return;
  }

  const option = createCommonChartOptions();
  option.legend.data = [];
  option.yAxis.axisLabel.formatter = (value) => `${value.toFixed(1)}%`;
  option.tooltip.valueFormatter = (value) => formatPercent(Number(value));
  option.series = [];

  if (wbtcChanges.length > 0) {
    option.legend.data.push(t.charts.change.series.wbtc);
    option.series.push({
      name: t.charts.change.series.wbtc,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: wbtcChanges.map((item) => [item.timestamp, item.change]),
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.08 },
    });
  }

  if (navChanges.length > 0) {
    option.legend.data.push(t.charts.change.series.vlhx);
    option.series.push({
      name: t.charts.change.series.vlhx,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: navChanges.map((item) => [item.timestamp, item.change]),
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.08 },
    });
  }
  chart.setOption(option, true);
}

function updateDiffChart(filtered) {
  const chart = state.charts.diff;
  if (!chart) return;
  const t = getTranslations();

  const navChanges = computePercentChangeData(filtered, 'nav_usd');
  const wbtcChanges = computePercentChangeData(filtered, 'wbtc_usd');
  const diffSeries = computeDifferenceSeries(navChanges, wbtcChanges);

  if (diffSeries.length === 0) {
    chart.clear();
    return;
  }

  const option = createCommonChartOptions();
  option.legend.data = [t.charts.diff.series.diff];
  option.yAxis.axisLabel.formatter = (value) => `${value.toFixed(1)}%`;
  option.tooltip.valueFormatter = (value) => formatPercent(Number(value));
  option.color = [COLORS.accent];
  option.series = [
    {
      name: t.charts.diff.series.diff,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: diffSeries,
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.12 },
    },
  ];
  chart.setOption(option, true);
}

function updateCharts(filtered) {
  updatePriceChart(filtered);
  updateChangeChart(filtered);
  updateDiffChart(filtered);
}

function refreshUI() {
  const filtered = filterData(state.range);
  updateCards(filtered);
  updateCharts(filtered);
}

async function loadData() {
  const dailyPath = getMetaContent('data-nav-daily');
  const wbtcPath = getMetaContent('data-wbtc-daily');
  try {
    const [dailyText, wbtcText] = await Promise.all([fetchCsv(dailyPath), fetchCsv(wbtcPath)]);
    const wbtcRows = parseCsv(wbtcText);
    const wbtcMap = new Map(wbtcRows.map((row) => [row.day, parseNumber(row.wbtc_usd)]));
    state.daily = toDailyData(parseCsv(dailyText), wbtcMap);
    refreshUI();
  } catch (error) {
    console.error('Failed to load dashboard data', error);
  }
}

function updateFilterLabels() {
  const t = getTranslations();
  document.querySelectorAll('.filters button').forEach((button) => {
    const range = button.dataset.range;
    button.textContent = t.filters[range] || range;
    button.classList.toggle('active', range === state.range);
  });
}

function applyTranslations() {
  const t = getTranslations();
  document.getElementById('header-title').textContent = t.title;
  document.getElementById('header-description').textContent = t.description;
  document.getElementById('footer-text').textContent = t.footer;
  document.getElementById('chart-price-title').textContent = t.charts.price.title;
  document.getElementById('chart-change-title').textContent = t.charts.change.title;
  document.getElementById('chart-diff-title').textContent = t.charts.diff.title;

  document.querySelector('[data-i18n="card-vlhx-label"]').textContent = t.cards.vlhx.label;
  document.querySelector('[data-i18n="card-wbtc-label"]').textContent = t.cards.wbtc.label;
  document.querySelector('[data-i18n="card-spread-label"]').textContent = t.cards.spread.label;

  updateFilterLabels();
  document.documentElement.setAttribute('lang', state.language);
}

function updateLanguageButtons() {
  document.querySelectorAll('.language-switcher button').forEach((button) => {
    const lang = button.dataset.language;
    button.classList.toggle('active', lang === state.language);
    button.textContent = lang.toUpperCase();
  });
}

function setLanguage(lang) {
  if (!TRANSLATIONS[lang] || lang === state.language) {
    return;
  }
  state.language = lang;
  applyTranslations();
  updateLanguageButtons();
  refreshUI();
}

function initCharts() {
  state.charts.price = echarts.init(document.getElementById('chart-price'));
  state.charts.change = echarts.init(document.getElementById('chart-change'));
  state.charts.diff = echarts.init(document.getElementById('chart-diff'));
  window.addEventListener('resize', () => {
    Object.values(state.charts).forEach((chart) => chart && chart.resize());
  });
}

function initFilters() {
  document.querySelectorAll('.filters button').forEach((button) => {
    button.addEventListener('click', () => {
      const range = button.dataset.range;
      if (range === state.range) {
        return;
      }
      state.range = range;
      updateFilterLabels();
      refreshUI();
    });
  });
  updateFilterLabels();
}

function initLanguageSwitcher() {
  document.querySelectorAll('.language-switcher button').forEach((button) => {
    button.addEventListener('click', () => {
      const lang = button.dataset.language;
      setLanguage(lang);
    });
  });
  updateLanguageButtons();
}

document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  initLanguageSwitcher();
  initCharts();
  initFilters();
  refreshUI();
  loadData();
  setInterval(loadData, 10 * 60 * 1000);
});
