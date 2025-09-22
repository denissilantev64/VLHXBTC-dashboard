import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';

type TooltipConfig = Exclude<EChartsOption['tooltip'], undefined>;
type TooltipItem = TooltipConfig extends Array<infer Item> ? Item : TooltipConfig;
type TooltipPoint = [number, number];

type TooltipPositioner = (
  point: TooltipPoint,
  params: unknown,
  dom: HTMLDivElement | null,
  rect: unknown,
  size: { contentSize: [number, number]; viewSize: [number, number] },
) => unknown;

function createTooltipPositioner(
  getContainer: () => HTMLElement | null,
  getCurrentPoint: () => TooltipPoint | null,
  getChart: () => EChartsType | null,
): TooltipPositioner {
  return ((point, params, _dom, _rect, size) => {
    const effectivePoint = getCurrentPoint() ?? point;

    const container = getContainer();
    const bounds = container?.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    const chartLeft = (bounds?.left ?? 0) + scrollX;
    const chartTop = (bounds?.top ?? 0) + scrollY;
    const chartRight = (bounds?.right ?? window.innerWidth) + scrollX;
    const chartBottom = (bounds?.bottom ?? window.innerHeight) + scrollY;

    const tooltipWidth = size.contentSize[0] ?? 0;
    const tooltipHeight = size.contentSize[1] ?? 0;

    const toFiniteNumber = (value: unknown): number | null => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      if (typeof value === 'string') {
        if (value.trim() === '') {
          return null;
        }
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          return numeric;
        }
        const parsedDate = Date.parse(value);
        return Number.isFinite(parsedDate) ? parsedDate : null;
      }
      return null;
    };

    type ExtractedPoint = { x: number | null; y: number | null };
    const ensurePoint = (input: unknown, point: ExtractedPoint): void => {
      if (input == null) {
        return;
      }

      if (Array.isArray(input)) {
        if (input.length >= 2) {
          const maybeX = toFiniteNumber(input[0]);
          const maybeY = toFiniteNumber(input[input.length - 1]);
          if (maybeX !== null && point.x === null) {
            point.x = maybeX;
          }
          if (maybeY !== null && point.y === null) {
            point.y = maybeY;
          }
        } else if (input.length === 1 && point.y === null) {
          const maybeY = toFiniteNumber(input[0]);
          if (maybeY !== null) {
            point.y = maybeY;
          }
        }
        return;
      }

      if (typeof input === 'object') {
        const record = input as Record<string, unknown>;
        if ('coord' in record) {
          ensurePoint(record['coord'], point);
        }
        if ('value' in record) {
          ensurePoint(record['value'], point);
        }
        if ('x' in record && record['x'] !== undefined && point.x === null) {
          const maybeX = toFiniteNumber(record['x']);
          if (maybeX !== null) {
            point.x = maybeX;
          }
        }
        if ('y' in record && record['y'] !== undefined && point.y === null) {
          const maybeY = toFiniteNumber(record['y']);
          if (maybeY !== null) {
            point.y = maybeY;
          }
        }
        return;
      }

      if (point.y === null) {
        const maybeY = toFiniteNumber(input);
        if (maybeY !== null) {
          point.y = maybeY;
        }
      }
    };

    const resolveDataPoint = (entry: unknown): { seriesIndex: number | null; point: ExtractedPoint } => {
      const result: ExtractedPoint = { x: null, y: null };
      if (!entry || typeof entry !== 'object') {
        return { seriesIndex: null, point: result };
      }

      const candidate = entry as Record<string, unknown>;
      const rawSeriesIndex = candidate['seriesIndex'];
      const seriesIndex = typeof rawSeriesIndex === 'number' ? rawSeriesIndex : null;

      ensurePoint(candidate['value'], result);
      ensurePoint(candidate['data'], result);

      if (result.x === null && 'axisValue' in candidate) {
        const maybeX = toFiniteNumber(candidate['axisValue']);
        if (maybeX !== null) {
          result.x = maybeX;
        }
      }

      if (result.y === null && 'axisValue' in candidate) {
        const axisDim = typeof candidate['axisDim'] === 'string' ? candidate['axisDim'] : null;
        if (axisDim === 'y') {
          const maybeY = toFiniteNumber(candidate['axisValue']);
          if (maybeY !== null) {
            result.y = maybeY;
          }
        }
      }

      return { seriesIndex, point: result };
    };

    let anchorPointX: number | null = null;
    let anchorPointY: number | null = null;
    const chart = getChart();
    if (chart) {
      const paramsList = Array.isArray(params) ? params : params ? [params] : [];
      for (const entry of paramsList) {
        const { seriesIndex, point: extracted } = resolveDataPoint(entry);
        if (seriesIndex === null || extracted.x === null || extracted.y === null) {
          continue;
        }

        const pixelPoint = chart.convertToPixel({ seriesIndex }, [extracted.x, extracted.y]);
        if (!Array.isArray(pixelPoint) || pixelPoint.length < 2) {
          continue;
        }

        const pixelX = pixelPoint[0];
        const pixelY = pixelPoint[1];
        if (!Number.isFinite(pixelX) || !Number.isFinite(pixelY)) {
          continue;
        }

        anchorPointX = chartLeft + pixelX;
        anchorPointY = chartTop + pixelY;
        break;
      }
    }

    const referenceX = anchorPointX ?? chartLeft + effectivePoint[0];
    let left = referenceX - tooltipWidth / 2;
    const minLeft = chartLeft + 8;
    const maxLeft = chartRight - tooltipWidth - 8;
    if (left < minLeft) {
      left = minLeft;
    } else if (left > maxLeft) {
      left = maxLeft;
    }

    const minTop = chartTop + 8;
    const maxTop = chartBottom - tooltipHeight - 8;
    const referenceY = anchorPointY ?? chartTop + effectivePoint[1];
    const gap = 16;

    const spaceAbove = referenceY - chartTop - tooltipHeight - gap;
    const spaceBelow = chartBottom - referenceY - tooltipHeight - gap;

    let top = referenceY - tooltipHeight - gap;

    if (spaceAbove < 0) {
      const belowPointerTop = referenceY + gap;
      const lackBelow = Math.max(0, -spaceBelow);

      top = belowPointerTop - lackBelow;

      if (lackBelow > 0 && top < minTop) {
        const remaining = minTop - top;
        top += remaining / 2;
      }
    }

    if (top > maxTop) {
      top = maxTop;
    }
    if (top < minTop) {
      top = minTop;
    }

    return { left, top };
  }) as TooltipPositioner;
}

function enrichTooltipOption(
  tooltip: EChartsOption['tooltip'],
  getContainer: () => HTMLElement | null,
  getCurrentPoint: () => TooltipPoint | null,
  getChart: () => EChartsType | null,
): TooltipConfig {
  const positioner = createTooltipPositioner(getContainer, getCurrentPoint, getChart);

  const enhance = (input?: TooltipItem): TooltipItem => {
    const base = { ...(input ?? {}) } as TooltipItem & Record<string, unknown>;

    if (base.position === undefined) {
      base.position = positioner;
    }
    if (base.confine === undefined) {
      base.confine = true;
    }
    if (base.appendToBody === undefined && base.appendTo === undefined) {
      base.appendToBody = true;
    }

    return base as TooltipItem;
  };

  if (tooltip === undefined) {
    return enhance() as TooltipConfig;
  }

  if (Array.isArray(tooltip)) {
    return tooltip.map((item) => enhance(item as TooltipItem)) as TooltipConfig;
  }

  return enhance(tooltip as TooltipItem) as TooltipConfig;
}

export function useECharts(option: EChartsOption | null): MutableRefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedElementsRef = useRef<HTMLElement[]>([]);
  const hideTooltipTimeoutRef = useRef<number | null>(null);
  const lastTooltipPointRef = useRef<TooltipPoint | null>(null);


  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const chart = echarts.init(element);
    chartRef.current = chart;

    const resizeChart = () => {
      chart.resize({ width: element.clientWidth, height: element.clientHeight });
    };

    window.addEventListener('resize', resizeChart);

    const zr = chart.getZr();

    const isPointerEvent = (
      event: TouchEvent | MouseEvent | PointerEvent | undefined,
    ): event is PointerEvent => {
      if (!event) {
        return false;
      }
      return 'pointerType' in event;
    };

    const shouldIgnoreEvent = (event: TouchEvent | MouseEvent | PointerEvent | undefined) => {
      if (!event) {
        return false;
      }

      if ('touches' in event && event.touches.length > 1) {
        return true;
      }

      if (isPointerEvent(event) && event.pointerType === 'touch' && event.isPrimary === false) {
        return true;
      }

      return false;
    };
    
    const getRelativePoint = (event: TouchEvent | MouseEvent | PointerEvent | undefined) => {
      if (!event) {
        return null;
      }

      if (shouldIgnoreEvent(event)) {
        return null;
      }

      const touch =
        'touches' in event && event.touches.length > 0
          ? event.touches[0]
          : 'changedTouches' in event && event.changedTouches.length > 0
            ? event.changedTouches[0]
            : null;

      const pointSource = touch ?? (('clientX' in event && 'clientY' in event) ? event : null);
      if (!pointSource) {
        return null;
      }

      const bounds = element.getBoundingClientRect();
      return {
        x: pointSource.clientX - bounds.left,
        y: pointSource.clientY - bounds.top,
      };
    };


    const clearHideTooltipTimeout = () => {
      if (hideTooltipTimeoutRef.current !== null) {
        window.clearTimeout(hideTooltipTimeoutRef.current);
        hideTooltipTimeoutRef.current = null;
      }
    };

    const showTooltip = (event: TouchEvent | MouseEvent | PointerEvent | undefined) => {
      clearHideTooltipTimeout();
      const point = getRelativePoint(event);
      if (!point) {
        return;
      }

      const width = element.clientWidth;
      const height = element.clientHeight;

      const clampedX = Math.min(Math.max(point.x, 0), width);
      const clampedY = Math.min(Math.max(point.y, 0), height);

      const constrainedPoint: TooltipPoint = [clampedX, clampedY];
      lastTooltipPointRef.current = constrainedPoint;

      chart.dispatchAction({ type: 'showTip', x: clampedX, y: clampedY });
    };

    const hideTooltip = () => {
      clearHideTooltipTimeout();
      lastTooltipPointRef.current = null;
      chart.dispatchAction({ type: 'hideTip' });
    };

    const scheduleHideTooltip = () => {
      clearHideTooltipTimeout();
      hideTooltipTimeoutRef.current = window.setTimeout(() => {
        hideTooltip();
      }, 1200);
    };

    const handlePointerActivate = (params: { event?: TouchEvent | MouseEvent | PointerEvent }) => {
      if (shouldIgnoreEvent(params.event)) {
        return;
      }
      showTooltip(params.event);
    };

    const handlePointerMove = (params: { event?: TouchEvent | MouseEvent | PointerEvent }) => {
      if (shouldIgnoreEvent(params.event)) {
        return;
      }
      showTooltip(params.event);
    };

    const handlePointerEnd = (params?: { event?: TouchEvent | MouseEvent | PointerEvent }) => {
      if (params && shouldIgnoreEvent(params.event)) {
        return;
      }
      scheduleHideTooltip();
    };

    const handlePointerCancel = (params?: { event?: TouchEvent | MouseEvent | PointerEvent }) => {
      if (params && shouldIgnoreEvent(params.event)) {
        return;
      }

      scheduleHideTooltip();
    };

    const handleGlobalOut = () => {
      hideTooltip();
    };

    zr.on('touchstart', handlePointerActivate);
    zr.on('touchmove', handlePointerMove);
    zr.on('touchend', handlePointerEnd);
    zr.on('touchcancel', handlePointerCancel);

    zr.on('pointerdown', handlePointerActivate);
    zr.on('pointermove', handlePointerMove);
    zr.on('pointerup', handlePointerEnd);
    zr.on('pointercancel', handlePointerCancel);

    zr.on('mousedown', handlePointerActivate);
    zr.on('mousemove', handlePointerMove);
    zr.on('mouseup', handlePointerEnd);

    zr.on('globalout', handleGlobalOut);


    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        resizeChart();
      });

      const observed: HTMLElement[] = [];
      let node: HTMLElement | null = element;
      while (node) {
        observer.observe(node);
        observed.push(node);
        node = node.parentElement;
      }

      resizeObserverRef.current = observer;
      observedElementsRef.current = observed;
    } else {
      resizeChart();
    }

    resizeChart();

    return () => {
      window.removeEventListener('resize', resizeChart);


      zr.off('touchstart', handlePointerActivate);
      zr.off('touchmove', handlePointerMove);
      zr.off('touchend', handlePointerEnd);
      zr.off('touchcancel', handlePointerCancel);

      zr.off('pointerdown', handlePointerActivate);
      zr.off('pointermove', handlePointerMove);
      zr.off('pointerup', handlePointerEnd);
      zr.off('pointercancel', handlePointerCancel);

      zr.off('mousedown', handlePointerActivate);
      zr.off('mousemove', handlePointerMove);
      zr.off('mouseup', handlePointerEnd);


      zr.off('globalout', handleGlobalOut);

      clearHideTooltipTimeout();

      const observer = resizeObserverRef.current;
      if (observer) {
        observedElementsRef.current.forEach((node) => {
          try {
            observer.unobserve(node);
          } catch {
            // ignore cleanup errors for detached nodes
          }
        });
        observer.disconnect();
      }
      resizeObserverRef.current = null;
      observedElementsRef.current = [];

      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    if (!option) {
      chart.clear();
      return;
    }

    const tooltip = enrichTooltipOption(
      option.tooltip,
      () => containerRef.current,
      () => lastTooltipPointRef.current,
      () => chartRef.current,
    );
    const enrichedOption: EChartsOption = { ...option, tooltip };

    chart.setOption(enrichedOption, true);
    const element = containerRef.current;
    if (element) {
      chart.resize({ width: element.clientWidth, height: element.clientHeight });
    } else {
      chart.resize();
    }

  }, [option]);

  return containerRef;
}
