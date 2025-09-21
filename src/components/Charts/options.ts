import type { EChartsOption } from 'echarts';
import type { OptionDataValue } from 'echarts/types/src/util/types';
import { colors, LEGEND_LINE_ICON } from '../../theme';
import {
  computeDifferenceSeries,
  computePercentChangeData,
  formatCurrency,
  formatPercent,
  type DailyEntry,
} from '../../services/data';
import type { Translation } from '../../i18n';

interface LineSeriesConfig {
  name: string;
  data: Array<[number, number]>;
  color: string;
  yAxisIndex?: number;
}

function extractNumericValue(value: OptionDataValue | OptionDataValue[]): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === 'number') {
    return raw;
  }
  if (raw instanceof Date) {
    return raw.getTime();
  }
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function createValueFormatter(format: (value: number) => string) {
  return (value: OptionDataValue | OptionDataValue[], _dataIndex: number) => format(extractNumericValue(value));
}

function formatAxisDate(value: string | number, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const formatted = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(date);
  return formatted.replace(/\u00a0/g, ' ').replace('.', '').replace(' ', '\n');
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) {
    return hex;
  }
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createCommonChartOptions(locale: string): EChartsOption {
  return {
    backgroundColor: colors.background,
    grid: { left: 52, right: 52, top: 48, bottom: 64 },
    textStyle: { color: colors.strongText, fontFamily: 'Inter, sans-serif' },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: colors.grid } },
      axisLabel: { color: colors.subtleText, hideOverlap: true, padding: [8, 0, 0, 0], formatter: (value: string | number) => formatAxisDate(value, locale) },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: colors.subtleText },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: colors.accent, width: 1 } },
    },
    legend: {
      top: 0,
      textStyle: { color: colors.subtleText, fontSize: 12 },
      icon: LEGEND_LINE_ICON,
      itemWidth: 24,
      itemHeight: 6,
      data: [],
    },
    color: [colors.accent, colors.secondary, colors.warning],
  } satisfies EChartsOption;
}

function buildLineSeries({ name, data, color, yAxisIndex = 0 }: LineSeriesConfig) {
  return {
    name,
    type: 'line',
    smooth: true,
    showSymbol: false,
    data,
    yAxisIndex,
    color,
    lineStyle: { width: 2, color },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: hexToRgba(color, 0.18) },
          { offset: 1, color: hexToRgba(color, 0) },
        ],
      },
    },
  };
}

function buildPriceSeries(filtered: DailyEntry[]) {
  const wbtc: Array<[number, number]> = [];
  const vlhx: Array<[number, number]> = [];
  filtered.forEach((row) => {
    const timestamp = row.date.getTime();
    if (Number.isFinite(row.wbtcUsd)) {
      wbtc.push([timestamp, row.wbtcUsd]);
    }
    if (Number.isFinite(row.navUsd)) {
      vlhx.push([timestamp, row.navUsd]);
    }
  });
  return { wbtc, vlhx };
}

function buildChangeSeries(filtered: DailyEntry[]) {
  const navChanges = computePercentChangeData(filtered, 'navUsd');
  const wbtcChanges = computePercentChangeData(filtered, 'wbtcUsd');
  return { navChanges, wbtcChanges };
}

export function buildPriceOption(filtered: DailyEntry[], translation: Translation, locale: string): EChartsOption | null {
  const { wbtc, vlhx } = buildPriceSeries(filtered);
  if (wbtc.length === 0 && vlhx.length === 0) {
    return null;
  }
  const option = createCommonChartOptions(locale);
  option.legend = { ...option.legend, data: [] };
  option.yAxis = [
    {
      type: 'value',
      axisLine: { show: false },
      axisLabel: {
        color: colors.subtleText,
        formatter: (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: value < 200 ? 2 : 0 }).format(value),
      },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    {
      type: 'value',
      axisLine: { show: false },
      axisLabel: {
        color: colors.subtleText,
        formatter: (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: value < 2 ? 4 : 2 }).format(value),
      },
      splitLine: { show: false },
      position: 'right',
    },
  ];
  option.tooltip = {
    ...option.tooltip,
    valueFormatter: createValueFormatter((val) => formatCurrency(val, locale)),
  };
  const series: unknown[] = [];
  if (wbtc.length > 0) {
    option.legend?.data?.push(translation.charts.price.series.wbtc);
    series.push(
      buildLineSeries({
        name: translation.charts.price.series.wbtc,
        data: wbtc,
        color: colors.secondary,
        yAxisIndex: 0,
      }),
    );
  }
  if (vlhx.length > 0) {
    option.legend?.data?.push(translation.charts.price.series.vlhx);
    series.push(
      buildLineSeries({
        name: translation.charts.price.series.vlhx,
        data: vlhx,
        color: colors.accent,
        yAxisIndex: 1,
      }),
    );
  }
  option.series = series as EChartsOption['series'];
  return option;
}

export function buildChangeOption(filtered: DailyEntry[], translation: Translation, locale: string): EChartsOption | null {
  const { navChanges, wbtcChanges } = buildChangeSeries(filtered);
  if (navChanges.length === 0 && wbtcChanges.length === 0) {
    return null;
  }
  const option = createCommonChartOptions(locale);
  option.legend = { ...option.legend, data: [] };
  option.tooltip = {
    ...option.tooltip,
    valueFormatter: createValueFormatter((val) => formatPercent(val)),
  };
  option.yAxis = {
    type: 'value',
    axisLine: { show: false },
    axisLabel: { color: colors.subtleText, formatter: (value: number) => `${value.toFixed(1)}%` },
    splitLine: { lineStyle: { color: colors.grid } },
  };
  const series: unknown[] = [];
  if (wbtcChanges.length > 0) {
    option.legend?.data?.push(translation.charts.change.series.wbtc);
    series.push(
      buildLineSeries({
        name: translation.charts.change.series.wbtc,
        data: wbtcChanges.map((point) => [point.timestamp, point.change]),
        color: colors.secondary,
      }),
    );
  }
  if (navChanges.length > 0) {
    option.legend?.data?.push(translation.charts.change.series.vlhx);
    series.push(
      buildLineSeries({
        name: translation.charts.change.series.vlhx,
        data: navChanges.map((point) => [point.timestamp, point.change]),
        color: colors.accent,
      }),
    );
  }
  option.series = series as EChartsOption['series'];
  return option;
}

export function buildDiffOption(filtered: DailyEntry[], translation: Translation, locale: string): EChartsOption | null {
  const { navChanges, wbtcChanges } = buildChangeSeries(filtered);
  const diffSeries = computeDifferenceSeries(navChanges, wbtcChanges);
  if (diffSeries.length === 0) {
    return null;
  }
  const option = createCommonChartOptions(locale);
  option.legend = { ...option.legend, data: [translation.charts.diff.series.diff] };
  option.tooltip = {
    ...option.tooltip,
    valueFormatter: createValueFormatter((val) => formatPercent(val)),
  };
  option.yAxis = {
    type: 'value',
    axisLine: { show: false },
    axisLabel: { color: colors.subtleText, formatter: (value: number) => `${value.toFixed(1)}%` },
    splitLine: { lineStyle: { color: colors.grid } },
  };
  option.color = [colors.warning];
  option.series = [
    buildLineSeries({
      name: translation.charts.diff.series.diff,
      data: diffSeries,
      color: colors.warning,
    }),
  ] as EChartsOption['series'];
  return option;
}
