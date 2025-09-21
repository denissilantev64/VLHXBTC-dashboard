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
    <div className="flex flex-col gap-4 rounded-[8px] border border-white/40 px-[clamp(20px,2.5vw,32px)] pb-[clamp(16px,2vw,28px)] pt-[clamp(20px,2.5vw,32px)]">
      <h2 className="m-0 text-[clamp(1.125rem,1.4vw,1.5rem)] font-semibold">{title}</h2>
      <div className="max-w-full w-full overflow-x-auto">
        <div
          ref={chartRef}
          className="chart-card__canvas h-[clamp(240px,32vw,420px)] w-full"
          role="img"
          aria-label={title}
        />
      </div>
    </div>
  );
};
