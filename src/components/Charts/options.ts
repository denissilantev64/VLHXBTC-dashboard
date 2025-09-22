import type { EChartsOption } from 'echarts';
import type { TooltipOption } from 'echarts/types/src/component/tooltip/TooltipModel';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import { colors } from '../../theme';
import {
  computeDifferenceSeries,
  computePercentChangeData,
  formatCurrency,
  formatPercent,
  type DailyEntry,
  type RangeKey,
} from '../../services/data';
import type { Translation } from '../../i18n';

interface LineSeriesConfig {
  name: string;
  data: Array<[number, number]>;
  color: string;
  yAxisIndex?: number;
}

type TooltipFormatter = Exclude<TooltipOption['formatter'], string | undefined>;

type ExtendedCallbackDataParams = CallbackDataParams & {
  axisValue?: string | number;
  axisValueLabel?: string;
};

function toParamsArray(
  input: CallbackDataParams | CallbackDataParams[] | undefined,
): ExtendedCallbackDataParams[] {
  if (!input) {
    return [];
  }
  const list = Array.isArray(input) ? input : [input];
  return list.filter((item): item is ExtendedCallbackDataParams => !!item && typeof item === 'object');
}

function extractTooltipNumber(value: unknown): number | null {
  if (Array.isArray(value)) {
    if (value.length >= 2) {
      const candidate = extractTooltipNumber(value[1]);
      if (candidate !== null) {
        return candidate;
      }
    }
    if (value.length >= 1) {
      return extractTooltipNumber(value[0]);
    }
    return null;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return extractTooltipNumber((value as Record<string, unknown>).value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractAxisCandidate(value: unknown): string | number | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return extractAxisCandidate(value[0]);
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : undefined;
  }
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return extractAxisCandidate((value as Record<string, unknown>).value);
  }
  return undefined;
}

function resolveTooltipAxisValue(param: ExtendedCallbackDataParams): string | number | undefined {
  if (typeof param.axisValue === 'number' || typeof param.axisValue === 'string') {
    return param.axisValue;
  }
  if (typeof param.axisValueLabel === 'string') {
    return param.axisValueLabel;
  }
  const fromValue = extractAxisCandidate(param.value);
  if (fromValue !== undefined) {
    return fromValue;
  }
  return extractAxisCandidate(param.data);
}


function formatTooltipDate(value: string | number | undefined, locale: string, range: RangeKey): string {
  if (value === undefined) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const options: Intl.DateTimeFormatOptions =
    range === '1D'
      ? {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'UTC',
        }
      : { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' };

  return new Intl.DateTimeFormat(locale, options).format(date).replace(/\u00a0/g, ' ');
}

function createTooltipFormatter(
  locale: string,
  formatValue: (value: number | null) => string,

  range: RangeKey,
): TooltipFormatter {
  return (input: CallbackDataParams | CallbackDataParams[], _asyncTicket: string) => {
    const params = toParamsArray(input);
    if (params.length === 0) {
      return '';
    }

    const axisValue = resolveTooltipAxisValue(params[0]);
    const dateLabel = formatTooltipDate(axisValue, locale, range);

    const items = params

      .map((item) => {
        const numeric = extractTooltipNumber(item.value ?? item.data);
        const marker = typeof item.marker === 'string' ? item.marker : '';
        const label = typeof item.seriesName === 'string' ? item.seriesName : '';
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <span style="display:flex;align-items:center;gap:8px;font-size:0.875rem;color:#ffffff;">${marker}${label}</span>
            <span style="font-size:0.875rem;font-weight:600;color:${colors.accent};">${formatValue(numeric)}</span>
          </div>`;
      })
      .filter((chunk): chunk is string => Boolean(chunk));

    if (items.length === 0) {
      return '';
    }

    const dateBlock = dateLabel
      ? `<div style="font-size:0.8125rem;font-weight:600;color:#ffffff;opacity:0.8;">${dateLabel}</div>`
      : '';

    return `<div style="display:flex;flex-direction:column;gap:12px;">${dateBlock}${items.join('')}</div>`;
  };
}

function formatAxisDate(value: string | number, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const formatted = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(date);

  return formatted.replace(/\u00a0/g, ' ').replace('.', '');
}

function formatAxisTime(value: string | number, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const formatted =
    new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(date);

  return formatted.replace(/\u00a0/g, ' ');
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

const ENHANCED_TOUCH_TRIGGER =
  'mousemove|click|touchstart|touchmove' as unknown as TooltipOption['triggerOn'];

const TARGET_LABEL_COUNTS: Record<RangeKey, number> = {
  '1D': 6,
  '1M': 6,
  '3M': 6,
  '6M': 6,
  '1Y': 6,
  ALL: 6,
};

function computeTimeBounds(
  seriesData: Array<Array<[number, number]>>,
  padding: number,
): { min: number; max: number } | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  seriesData.forEach((series) => {
    series.forEach(([timestamp]) => {
      if (!Number.isFinite(timestamp)) {
        return;
      }
      min = Math.min(min, timestamp);
      max = Math.max(max, timestamp);
    });
  });

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  if (min === max) {
    const safePadding = Math.max(padding, 60 * 60 * 1000);
    return { min: min - safePadding, max: max + safePadding };
  }

  return { min, max };
}

function createCommonChartOptions(
  locale: string,
  range: RangeKey,
  seriesData: Array<Array<[number, number]>>,
): EChartsOption {
  const isDailyRange = range === '1D';
  const minInterval = isDailyRange ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const bounds = computeTimeBounds(seriesData, minInterval);
  const targetLabels = TARGET_LABEL_COUNTS[range] ?? 6;
  const splitNumber = targetLabels;
  const axisTick = {
    show: true,
    interval: 'auto' as const,
    lineStyle: { color: colors.grid },
  };
  return {
    backgroundColor: colors.background,
    grid: { left: 52, right: 52, top: 32, bottom: 64 },
    textStyle: { color: colors.strongText, fontFamily: 'Inter, sans-serif' },
    xAxis: {
      type: 'time',
      minInterval,
      min: bounds?.min,
      max: bounds?.max,
      splitNumber,
      axisLine: { lineStyle: { color: colors.grid } },
      axisLabel: {
        color: colors.subtleText,
        hideOverlap: true,
        padding: [8, 0, 0, 0],
        interval: 'auto',
        formatter: (value: string | number) =>
          (isDailyRange ? formatAxisTime(value, locale) : formatAxisDate(value, locale)),
      },
      axisTick,
      splitLine: { show: false },
      axisPointer: {
        show: true,
        label: { show: false },
        handle: { show: false },
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: colors.subtleText },
      splitLine: { lineStyle: { color: colors.grid } },
      axisPointer: {
        show: true,
        label: { show: false },
        handle: { show: false },
      },
    },
    tooltip: {
      trigger: 'axis',
      show: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',

      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      padding: 16,
      renderMode: 'html',
      triggerOn: ENHANCED_TOUCH_TRIGGER,
      extraCssText:
        'backdrop-filter: blur(18px); border-radius: 12px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45); pointer-events: none;',
      axisPointer: {
        type: 'line',
        lineStyle: { color: 'rgba(255, 255, 255, 0.7)', type: 'dashed', width: 1 },
        label: { show: false },
        snap: true,
      },
    },
    legend: {
      show: false,
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

function computeBounds(
  values: Array<[number, number]>,
  paddingFactor = 0.12,
): { min: number; max: number } | null {
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
    const padding = Math.abs(min) * paddingFactor;
    const delta = padding || 1;
    return { min: min - delta, max: max + delta };
  }
  const spread = max - min;
  const padding = spread * paddingFactor;
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

export function buildPriceOption(
  filtered: DailyEntry[],
  translation: Translation,
  locale: string,
  range: RangeKey,
): EChartsOption | null {
  const { wbtc, vlhx } = buildPriceSeries(filtered);
  if (wbtc.length === 0 && vlhx.length === 0) {
    return null;
  }
  const option = createCommonChartOptions(locale, range, [wbtc, vlhx]);
  option.legend = { ...option.legend, data: [] };
  const pricePaddingFactor = 0.08;
  const wbtcBounds = computeBounds(wbtc, pricePaddingFactor);
  const vlhxBounds = computeBounds(vlhx, pricePaddingFactor);
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
    formatter: createTooltipFormatter(locale, (val) => formatCurrency(val, locale), range),
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

export function buildChangeOption(
  filtered: DailyEntry[],
  translation: Translation,
  locale: string,
  range: RangeKey,
): EChartsOption | null {
  const { navChanges, wbtcChanges } = buildChangeSeries(filtered);
  if (navChanges.length === 0 && wbtcChanges.length === 0) {
    return null;
  }
  const navSeries = navChanges.map((point) => [point.timestamp, point.change] as [number, number]);
  const wbtcSeries = wbtcChanges.map((point) => [point.timestamp, point.change] as [number, number]);
  const option = createCommonChartOptions(locale, range, [navSeries, wbtcSeries]);
  option.legend = { ...option.legend, data: [] };
  option.tooltip = {
    ...option.tooltip,
    formatter: createTooltipFormatter(locale, (val) => formatPercent(val, locale), range),
  };
  let minChange = Number.POSITIVE_INFINITY;
  let maxChange = Number.NEGATIVE_INFINITY;
  [navSeries, wbtcSeries].forEach((series) => {
    series.forEach(([, value]) => {
      if (Number.isFinite(value)) {
        minChange = Math.min(minChange, value);
        maxChange = Math.max(maxChange, value);
      }
    });
  });

  const hasChangeValues = Number.isFinite(minChange) && Number.isFinite(maxChange);
  const maxAbsChange = hasChangeValues
    ? Math.max(Math.abs(minChange), Math.abs(maxChange))
    : 0;
  const changePadding = maxAbsChange === 0 ? 1 : maxAbsChange * 0.1;
  const axisLimit = maxAbsChange + changePadding;

  option.yAxis = {
    type: 'value',
    axisLine: { show: false },
    axisLabel: { color: colors.subtleText, formatter: (value: number) => `${value.toFixed(1)}%` },
    splitLine: { lineStyle: { color: colors.grid } },
    axisPointer: { show: false },
    min: hasChangeValues ? -axisLimit : undefined,
    max: hasChangeValues ? axisLimit : undefined,
  };
  const series: unknown[] = [];
  if (wbtcSeries.length > 0) {
    option.legend?.data?.push(translation.charts.change.series.wbtc);
    series.push(
      buildLineSeries({
        name: translation.charts.change.series.wbtc,
        data: wbtcSeries,
        color: colors.secondary,
      }),
    );
  }
  if (navSeries.length > 0) {
    option.legend?.data?.push(translation.charts.change.series.vlhx);
    series.push(
      buildLineSeries({
        name: translation.charts.change.series.vlhx,
        data: navSeries,
        color: colors.accent,
      }),
    );
  }
  option.series = series as EChartsOption['series'];
  return option;
}

export function buildDiffOption(
  filtered: DailyEntry[],
  translation: Translation,
  locale: string,
  range: RangeKey,
): EChartsOption | null {
  const { navChanges, wbtcChanges } = buildChangeSeries(filtered);
  const diffSeries = computeDifferenceSeries(navChanges, wbtcChanges);
  if (diffSeries.length === 0) {
    return null;
  }
  const option = createCommonChartOptions(locale, range, [diffSeries]);
  option.legend = { ...option.legend, data: [translation.charts.diff.series.diff] };
  option.tooltip = {
    ...option.tooltip,
    formatter: createTooltipFormatter(locale, (val) => formatPercent(val, locale), range),
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
