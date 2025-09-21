import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';

export function useECharts(option: EChartsOption | null): MutableRefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const chart = echarts.init(element);
    chartRef.current = chart;
    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        chart.resize();
      });
      observer.observe(element);
      if (element.parentElement) {
        observer.observe(element.parentElement);
      }
      resizeObserverRef.current = observer;
    }
    chart.resize();
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserverRef.current) {
        if (element.parentElement) {
          try {
            resizeObserverRef.current.unobserve(element.parentElement);
          } catch {
            // ignore cleanup errors for detached nodes
          }
        }
        resizeObserverRef.current.disconnect();
      }
      resizeObserverRef.current = null;
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }
    if (!option) {
      chartRef.current.clear();
      return;
    }
    chartRef.current.setOption(option, true);
    chartRef.current.resize();
  }, [option]);

  return containerRef;
}
