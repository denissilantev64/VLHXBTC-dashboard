import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';

type TooltipConfig = Exclude<EChartsOption['tooltip'], undefined>;
type TooltipItem = TooltipConfig extends Array<infer Item> ? Item : TooltipConfig;
type TooltipPositioner = (
  point: [number, number],
  params: unknown,
  dom: HTMLDivElement | null,
  rect: unknown,
  size: { contentSize: [number, number]; viewSize: [number, number] },
) => unknown;

function createTooltipPositioner(
  getContainer: () => HTMLElement | null,
): TooltipPositioner {
  return ((point, _params, _dom, _rect, size) => {
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

    let left = chartLeft + point[0] - tooltipWidth / 2;
    const minLeft = chartLeft + 8;
    const maxLeft = chartRight - tooltipWidth - 8;
    if (left < minLeft) {
      left = minLeft;
    } else if (left > maxLeft) {
      left = maxLeft;
    }

    let top = chartTop + point[1] - tooltipHeight - 16;
    const minTop = chartTop + 8;
    const maxTop = chartBottom - tooltipHeight - 8;
    if (top < minTop) {
      top = chartTop + point[1] + 16;
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
): TooltipConfig {
  const positioner = createTooltipPositioner(getContainer);

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
    const getRelativePoint = (event: TouchEvent | MouseEvent | PointerEvent | undefined) => {
      if (!event) {
        return null;
      }

      if ('touches' in event && event.touches.length > 1) {
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

      chart.dispatchAction({ type: 'showTip', x: point.x, y: point.y });
    };

    const hideTooltip = () => {
      clearHideTooltipTimeout();
      chart.dispatchAction({ type: 'hideTip' });
    };

    const scheduleHideTooltip = () => {
      clearHideTooltipTimeout();
      hideTooltipTimeoutRef.current = window.setTimeout(() => {
        hideTooltip();
      }, 1200);
    };


    const handleTouchStart = (params: { event?: TouchEvent | MouseEvent | PointerEvent }) => {
      showTooltip(params.event);
    };

    const handleTouchMove = (params: { event?: TouchEvent | MouseEvent | PointerEvent }) => {
      showTooltip(params.event);
    };

    const handleTouchEnd = () => {
      scheduleHideTooltip();
    };

    const handleTouchCancel = () => {
      scheduleHideTooltip();
    };

    const handleGlobalOut = () => {

      hideTooltip();
    };

    zr.on('touchstart', handleTouchStart);
    zr.on('touchmove', handleTouchMove);
    zr.on('touchend', handleTouchEnd);
    zr.on('touchcancel', handleTouchCancel);
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

      zr.off('touchstart', handleTouchStart);
      zr.off('touchmove', handleTouchMove);
      zr.off('touchend', handleTouchEnd);
      zr.off('touchcancel', handleTouchCancel);
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

    const tooltip = enrichTooltipOption(option.tooltip, () => containerRef.current);
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
