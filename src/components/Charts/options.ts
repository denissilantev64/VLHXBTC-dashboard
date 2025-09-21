import type { EChartsOption } from 'echarts';
import type { TooltipOption } from 'echarts/types/src/component/tooltip/TooltipModel';
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

interface TooltipParams {
  axisValue?: unknown;
  value?: OptionDataValue | OptionDataValue[];
  data?: OptionDataValue | OptionDataValue[];
  seriesName?: string;
  marker?: string;
}

type TooltipFormatterParams = unknown;
type TooltipFormatter = Exclude<TooltipOption['formatter'], string | undefined>;

function toOptionDataValue(input: unknown): OptionDataValue | OptionDataValue[] | undefined {
  if (input === null || input === undefined) {
    return undefined;
  }
  if (Array.isArray(input)) {
    return input as OptionDataValue[];
  }
  if (input instanceof Date) {
    return input;
  }
  if (typeof input === 'object') {
    return undefined;
  }
  if (typeof input === 'number' || typeof input === 'string') {
    return input as OptionDataValue;
  }
  return undefined;
}

function normalizeTooltipParams(input: TooltipFormatterParams): TooltipParams[] {
  const entries = Array.isArray(input) ? input : [input];
  return entries
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const markerValue = record.marker;
      return {
        axisValue: record.axisValue,
        value: toOptionDataValue(record.value),
        data: toOptionDataValue(record.data),
        seriesName: typeof record.seriesName === 'string' ? record.seriesName : undefined,
        marker: typeof markerValue === 'string' ? markerValue : '',
      };
    })
    .filter(Boolean) as TooltipParams[];
}

function normalizeTooltipValue(input: OptionDataValue | OptionDataValue[] | undefined): number {
  if (Array.isArray(input)) {
    const candidate = input[1] ?? input[0];
    if (candidate === undefined) {
      return Number.NaN;
    }
    return extractNumericValue(candidate);
  }
  if (input === undefined) {
    return Number.NaN;
  }
  return extractNumericValue(input);
}

function resolveTooltipAxisValue(param: TooltipParams): string | number | undefined {
  if (typeof param.axisValue === 'number' || typeof param.axisValue === 'string') {
    return param.axisValue;
  }
  if (Array.isArray(param.data)) {
    const candidate = param.data[0];
    if (typeof candidate === 'number' || typeof candidate === 'string') {
      return candidate;
    }
  }
  if (Array.isArray(param.value)) {
    const candidate = param.value[0];
    if (typeof candidate === 'number' || typeof candidate === 'string') {
      return candidate;
    }
  }
  return undefined;
}

function formatTooltipDate(value: string | number | undefined, locale: string): string {
  if (value === undefined) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
    .format(date)
    .replace(/\u00a0/g, ' ');
}

function createTooltipFormatter(locale: string, formatValue: (value: number) => string): TooltipFormatter {
  return (input: TooltipFormatterParams, _asyncTicket: string) => {
    const params = normalizeTooltipParams(input);
    if (!params.length) {
      return '';
    }
    const axisValue = resolveTooltipAxisValue(params[0]);
    const dateLabel = formatTooltipDate(axisValue, locale);
    const rows = params
      .map((item) => {
        const numeric = normalizeTooltipValue(item.value ?? item.data);
        if (!Number.isFinite(numeric)) {
          return '';
        }
        const marker = item.marker ?? '';
        const label = item.seriesName ?? '';
        const formattedValue = formatValue(numeric);
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <span style="display:flex;align-items:center;gap:8px;font-size:0.875rem;color:#ffffff;">${marker}${label}</span>
            <span style="font-size:0.875rem;font-weight:600;color:${colors.accent};">${formattedValue}</span>
          </div>`;
      })
      .filter(Boolean)
      .join('');
    if (!rows) {
      return '';
    }
    const dateBlock = dateLabel
      ? `<div style="font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;opacity:0.72;">${dateLabel}</div>`
      : '';
    return `<div style="display:flex;flex-direction:column;gap:12px;">${dateBlock}${rows}</div>`;
  };
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
      axisPointer: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: colors.subtleText },
      splitLine: { lineStyle: { color: colors.grid } },
      axisPointer: { show: false },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderWidth: 0,
      padding: 16,
      extraCssText: 'backdrop-filter: blur(18px); border-radius: 12px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);',
      axisPointer: {
        type: 'line',
        lineStyle: { color: colors.accent, width: 1 },
        label: { show: false },
      },
    },
    legend: {
      top: 0,
      textStyle: { color: colors.subtleText, fontSize: 12 },
      icon: LEGEND_LINE_ICON,
      itemWidth: 24,
      itemHeight: 6,
      data: [],
    },
    color: [colors.accent, colors.secondary, colors.subtleText],
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
    lineStyle: {
      width: 2,
      color,
      shadowColor: hexToRgba(color, 0.45),
      shadowBlur: 8,
      shadowOffsetY: 0,
    },
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

function computeBounds(values: Array<[number, number]>): { min: number; max: number } | null {
  if (!values.length) {
    return null;
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  values.forEach(([, value]) => {
    if (Number.isFinite(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }
  if (min === max) {
    const delta = Math.abs(min) * 0.05 || 1;
    return { min: min - delta, max: max + delta };
  }
  const spread = max - min;
  const padding = spread * 0.12;
  return { min: min - padding, max: max + padding };
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
  const wbtcBounds = computeBounds(wbtc);
  const vlhxBounds = computeBounds(vlhx);
  option.yAxis = [
    {
      type: 'value',
      axisLine: { show: false },
      axisLabel: {
        color: colors.subtleText,
        formatter: (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: value < 200 ? 2 : 0 }).format(value),
      },
      splitLine: { lineStyle: { color: colors.grid } },
      min: wbtcBounds?.min,
      max: wbtcBounds?.max,
      scale: true,
      axisPointer: { show: false },
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
      min: vlhxBounds?.min,
      max: vlhxBounds?.max,
      scale: true,
      axisPointer: { show: false },
    },
  ];
  option.tooltip = {
    ...option.tooltip,
    formatter: createTooltipFormatter(locale, (val) => formatCurrency(val, locale)),
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
    formatter: createTooltipFormatter(locale, (val) => formatPercent(val)),
  };
  option.yAxis = {
    type: 'value',
    axisLine: { show: false },
    axisLabel: { color: colors.subtleText, formatter: (value: number) => `${value.toFixed(1)}%` },
    splitLine: { lineStyle: { color: colors.grid } },
    axisPointer: { show: false },
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
    formatter: createTooltipFormatter(locale, (val) => formatPercent(val)),
  };
  option.yAxis = {
    type: 'value',
    axisLine: { show: false },
    axisLabel: { color: colors.subtleText, formatter: (value: number) => `${value.toFixed(1)}%` },
    splitLine: { lineStyle: { color: colors.grid } },
    axisPointer: { show: false },
  };
  option.color = [colors.accent];
  option.series = [
    buildLineSeries({
      name: translation.charts.diff.series.diff,
      data: diffSeries,
      color: colors.accent,
    }),
  ] as EChartsOption['series'];
  return option;
}
