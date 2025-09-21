import type { FC } from 'react';
import type { EChartsOption } from 'echarts';
import { useECharts } from './useECharts';

interface ChartCardProps {
  title: string;
  option: EChartsOption | null;
}

export const ChartCard: FC<ChartCardProps> = ({ title, option }) => {
  const chartRef = useECharts(option);
  return (
    <div className="chart">
      <h2>{title}</h2>
      <div ref={chartRef} className="chart-container" role="img" aria-label={title} />
    </div>
  );
};
