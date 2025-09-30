import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';

type TooltipConfig = Exclude<EChartsOption['tooltip'], undefined>;
type TooltipItem = TooltipConfig extends Array<infer Item> ? Item : TooltipConfig;
type TooltipPoint = [number, number];

type ExtractedPoint = { x: number | null; y: number | null };

type TooltipAnchor =
  | { type: 'pixel'; point: TooltipPoint }
  | { type: 'indices'; seriesIndex: number; dataIndex: number };

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

const populatePointFromInput = (input: unknown, point: ExtractedPoint): void => {
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
      populatePointFromInput(record['coord'], point);
    }
    if ('value' in record) {
      populatePointFromInput(record['value'], point);
    }
    if ('data' in record) {
      populatePointFromInput(record['data'], point);
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

const extractPointFromEntry = (entry: unknown): ExtractedPoint => {
  const result: ExtractedPoint = { x: null, y: null };
  populatePointFromInput(entry, result);
  return result;
};

const parseCssPixelValue = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const computeAvailableWidth = (element: HTMLElement): number | null => {
  if (typeof window === 'undefined' || !('getComputedStyle' in window)) {
    return element.clientWidth || null;
  }

  let current: HTMLElement | null = element;
  let width: number | null = null;

  while (current) {
    const clientWidth = current.clientWidth;
    if (clientWidth > 0) {
      const styles = window.getComputedStyle(current);
      const paddingLeft = parseCssPixelValue(styles.paddingLeft);
      const paddingRight = parseCssPixelValue(styles.paddingRight);
      const available = clientWidth - paddingLeft - paddingRight;

      if (available > 0) {
        width = width === null ? available : Math.min(width, available);
      }
    }

    current = current.parentElement;
  }

  return width;
};

const resizeChartToContainer = (chart: EChartsType | null): void => {
  if (!chart) {
    return;
  }

  const dom = chart.getDom?.();

  if (!(dom instanceof HTMLElement)) {
    chart.resize();
    return;
  }

  dom.style.maxWidth = '100%';
  dom.style.removeProperty('height');

  const executeResize = () => {
    const availableWidth = computeAvailableWidth(dom);

    if (availableWidth && availableWidth > 0) {
      dom.style.width = `${availableWidth}px`;
      chart.resize({ width: availableWidth });
      return;
    }

    dom.style.removeProperty('width');
    chart.resize();
  };

  if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
    window.requestAnimationFrame(executeResize);
  } else {
    executeResize();
  }
};

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
  getTooltipAnchor: () => TooltipAnchor | null,
): TooltipPositioner {
  return ((point, params, _dom, _rect, size) => {
    const effectivePoint = getCurrentPoint() ?? point;

    const container = getContainer();
    const bounds = container?.getBoundingClientRect();

    const tooltipWidth = size.contentSize[0] ?? 0;
    const tooltipHeight = size.contentSize[1] ?? 0;

    const fallbackWidth = size.viewSize?.[0] ?? 0;
    const fallbackHeight = size.viewSize?.[1] ?? 0;
    const containerWidth = (bounds?.width ?? fallbackWidth) || tooltipWidth + 16;
    const containerHeight = (bounds?.height ?? fallbackHeight) || tooltipHeight + 16;

    const chart = getChart();
    const anchor = getTooltipAnchor();
    let anchorPixel: TooltipPoint | null = null;

    if (anchor) {
      if (anchor.type === 'pixel') {
        anchorPixel = anchor.point;
      } else if (anchor.type === 'indices' && chart) {
        const option = chart.getOption();
        const rawSeriesList = Array.isArray(option.series)
          ? option.series
          : option.series != null
            ? [option.series]
            : [];

        const series = rawSeriesList[anchor.seriesIndex];
        if (series && typeof series === 'object') {
          const data = (series as { data?: unknown }).data;
          if (Array.isArray(data) && anchor.dataIndex >= 0 && anchor.dataIndex < data.length) {
            const coordinates = extractPointFromEntry(data[anchor.dataIndex]);
            if (coordinates.x !== null && coordinates.y !== null) {
              const converted = chart.convertToPixel(
                { seriesIndex: anchor.seriesIndex },
                [coordinates.x, coordinates.y],
              );
              if (Array.isArray(converted) && converted.length >= 2) {
                const [pixelX, pixelY] = converted;
                if (Number.isFinite(pixelX) && Number.isFinite(pixelY)) {
                  anchorPixel = [pixelX, pixelY];
                }
              }
            }
          }
        }
      }
    }

    const resolveDataPoint = (entry: unknown): { seriesIndex: number | null; point: ExtractedPoint } => {
      const result = extractPointFromEntry(entry);
      if (!entry || typeof entry !== 'object') {
        return { seriesIndex: null, point: result };
      }

      const candidate = entry as Record<string, unknown>;
      const rawSeriesIndex = candidate['seriesIndex'];
      const seriesIndex = typeof rawSeriesIndex === 'number' ? rawSeriesIndex : null;

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
    if (!anchorPixel && chart) {
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

        anchorPixel = [pixelX, pixelY];
        break;
      }
    }

    if (anchorPixel) {
      const [pixelX, pixelY] = anchorPixel;
      anchorPointX = pixelX;
      anchorPointY = pixelY;
    }

    const referenceX = anchorPointX ?? effectivePoint[0];
    let left = referenceX - tooltipWidth / 2;
    let minLeft = 8;
    let maxLeft = containerWidth - tooltipWidth - 8;
    if (maxLeft < minLeft) {
      const center = (containerWidth - tooltipWidth) / 2;
      minLeft = center;
      maxLeft = center;
    }
    if (left < minLeft) {
      left = minLeft;
    } else if (left > maxLeft) {
      left = maxLeft;
    }

    const pointerY = anchorPointY ?? effectivePoint[1];
    const gap = 16;

    let minTop = 8;
    let maxTop = containerHeight - tooltipHeight - 8;
    if (maxTop < minTop) {
      const center = (containerHeight - tooltipHeight) / 2;
      minTop = center;
      maxTop = center;
    }

    const preferAboveTop = pointerY - tooltipHeight - gap;
    const preferBelowTop = pointerY + gap;

    let top: number;

    if (preferAboveTop >= minTop) {
      top = preferAboveTop;
    } else if (preferBelowTop <= maxTop) {
      const shortageAbove = minTop - preferAboveTop;
      top = Math.max(minTop, preferBelowTop - shortageAbove);
    } else {
      const centeredTop = pointerY - tooltipHeight / 2;
      top = centeredTop;
    }

    if (top < minTop) {
      top = minTop;
    }
    if (top > maxTop) {
      top = maxTop;
    }

    return { left, top };
  }) as TooltipPositioner;
}

function enrichTooltipOption(
  tooltip: EChartsOption['tooltip'],
  getContainer: () => HTMLElement | null,
  getCurrentPoint: () => TooltipPoint | null,
  getChart: () => EChartsType | null,
  getTooltipAnchor: () => TooltipAnchor | null,
): TooltipConfig {
  const positioner = createTooltipPositioner(
    getContainer,
    getCurrentPoint,
    getChart,
    getTooltipAnchor,
  );

  const enhance = (input?: TooltipItem): TooltipItem => {
    const base = { ...(input ?? {}) } as TooltipItem & Record<string, unknown>;
    const container = getContainer();

    if (base.position === undefined) {
      base.position = positioner;
    }
    if (base.confine === undefined) {
      base.confine = true;
    }
    if (container && base.appendTo === undefined) {
      base.appendTo = container;
    }
    if (base.appendToBody === undefined || base.appendToBody === true) {
      base.appendToBody = false;
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
  const lastTooltipAnchorRef = useRef<TooltipAnchor | null>(null);
  const lastInputTypeRef = useRef<'touch' | 'mouse' | null>(null);


  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const chart = echarts.init(element);
    chartRef.current = chart;

    const resizeChart = () => {
      resizeChartToContainer(chart);
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

    const isTouchLikeEvent = (
      event: TouchEvent | MouseEvent | PointerEvent,
    ): event is TouchEvent => {
      return 'touches' in event || 'changedTouches' in event;
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

    const determineEventInputType = (
      event: TouchEvent | MouseEvent | PointerEvent | undefined,
    ): 'touch' | 'mouse' | null => {
      if (!event) {
        return null;
      }

      if (isTouchLikeEvent(event)) {
        if (event.touches && event.touches.length > 0) {
          return 'touch';
        }
        if (event.changedTouches && event.changedTouches.length > 0) {
          return 'touch';
        }
        return 'touch';
      }

      if (isPointerEvent(event)) {
        if (event.pointerType === 'touch') {
          return 'touch';
        }
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
          return 'mouse';
        }
      }

      return 'mouse';
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

      const inputType = lastInputTypeRef.current ?? determineEventInputType(event);
      if (inputType !== 'touch') {
        lastTooltipAnchorRef.current = null;
        chart.dispatchAction({ type: 'updateAxisPointer', x: clampedX, y: clampedY });
        chart.dispatchAction({ type: 'showTip', x: clampedX, y: clampedY });
        return;
      }

      const extractTimestamp = (entry: unknown): number | null => {
        if (entry == null) {
          return null;
        }
        if (Array.isArray(entry)) {
          if (entry.length === 0) {
            return null;
          }
          return toFiniteNumber(entry[0]);
        }
        if (typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          if ('value' in record) {
            const fromValue = extractTimestamp(record['value']);
            if (fromValue !== null) {
              return fromValue;
            }
          }
          if ('x' in record) {
            const maybeX = toFiniteNumber(record['x']);
            if (maybeX !== null) {
              return maybeX;
            }
          }
          if ('axisValue' in record) {
            const maybeAxisValue = toFiniteNumber(record['axisValue']);
            if (maybeAxisValue !== null) {
              return maybeAxisValue;
            }
          }
        }
        return toFiniteNumber(entry);
      };

      let matchedSeriesIndex: number | null = null;
      let matchedDataIndex: number | null = null;

      const axisCoordinate = chart.convertFromPixel({ xAxisIndex: 0 }, clampedX) as unknown;
      let axisValue: number | null;
      if (typeof axisCoordinate === 'number') {
        axisValue = Number.isFinite(axisCoordinate) ? axisCoordinate : null;
      } else if (Array.isArray(axisCoordinate) && axisCoordinate.length > 0) {
        axisValue = toFiniteNumber(axisCoordinate[0]);
      } else {
        axisValue = toFiniteNumber(axisCoordinate);
      }

      if (axisValue !== null) {
        const option = chart.getOption();
        const rawSeriesList = Array.isArray(option.series)
          ? option.series
          : option.series != null
            ? [option.series]
            : [];

        for (let seriesIndex = 0; seriesIndex < rawSeriesList.length; seriesIndex += 1) {
          const series = rawSeriesList[seriesIndex];
          if (!series || typeof series !== 'object') {
            continue;
          }

          const data = (series as { data?: unknown }).data;
          if (!Array.isArray(data) || data.length === 0) {
            continue;
          }

          let bestIndex = -1;
          let bestDistance = Number.POSITIVE_INFINITY;

          for (let dataIndex = 0; dataIndex < data.length; dataIndex += 1) {
            const timestamp = extractTimestamp(data[dataIndex]);
            if (timestamp === null) {
              continue;
            }

            const distance = Math.abs(timestamp - axisValue);
            if (distance < bestDistance) {
              bestIndex = dataIndex;
              bestDistance = distance;
            }

            if (distance === 0) {
              break;
            }
          }

          if (bestIndex >= 0) {
            matchedSeriesIndex = seriesIndex;
            matchedDataIndex = bestIndex;
            break;
          }
        }
      }

      if (matchedSeriesIndex !== null && matchedDataIndex !== null) {
        lastTooltipAnchorRef.current = {
          type: 'indices',
          seriesIndex: matchedSeriesIndex,
          dataIndex: matchedDataIndex,
        };

        chart.dispatchAction({
          type: 'updateAxisPointer',
          seriesIndex: matchedSeriesIndex,
          dataIndex: matchedDataIndex,
        });
        chart.dispatchAction({
          type: 'showTip',
          seriesIndex: matchedSeriesIndex,
          dataIndex: matchedDataIndex,
        });
        return;
      }

      const previousAnchor = lastTooltipAnchorRef.current;
      if (previousAnchor?.type === 'indices') {
        const { seriesIndex, dataIndex } = previousAnchor;
        chart.dispatchAction({ type: 'updateAxisPointer', seriesIndex, dataIndex });
        chart.dispatchAction({ type: 'showTip', seriesIndex, dataIndex });
      }
    };

    const hideTooltip = () => {
      clearHideTooltipTimeout();
      lastTooltipPointRef.current = null;
      lastTooltipAnchorRef.current = null;
      lastInputTypeRef.current = null;
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
      lastInputTypeRef.current = determineEventInputType(params.event) ?? lastInputTypeRef.current;
      showTooltip(params.event);
    };

    const handlePointerMove = (params: { event?: TouchEvent | MouseEvent | PointerEvent }) => {
      if (shouldIgnoreEvent(params.event)) {
        return;
      }
      lastInputTypeRef.current = determineEventInputType(params.event) ?? lastInputTypeRef.current;
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
      () => lastTooltipAnchorRef.current,
    );
    const enrichedOption: EChartsOption = { ...option, tooltip };

    chart.setOption(enrichedOption, true);
    resizeChartToContainer(chart);

  }, [option]);

  return containerRef;
}
