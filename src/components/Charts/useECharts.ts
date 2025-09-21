import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';

export function useECharts(option: EChartsOption | null): MutableRefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const observedElementsRef = useRef<HTMLElement[]>([]);

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

    chart.setOption(option, true);
    const element = containerRef.current;
    if (element) {
      chart.resize({ width: element.clientWidth, height: element.clientHeight });
    } else {
      chart.resize();
    }
  }, [option]);

  return containerRef;
}
