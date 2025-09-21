import { useMemo } from 'react';
import type { FC } from 'react';
import type { DailyEntry } from '../../services/data';
import type { Translation } from '../../i18n';
import { ChartCard } from './ChartCard';
import { buildChangeOption, buildDiffOption, buildPriceOption } from './options';

interface ChartsSectionProps {
  data: DailyEntry[];
  translation: Translation;
  locale: string;
}

export const ChartsSection: FC<ChartsSectionProps> = ({ data, translation, locale }) => {
  const priceOption = useMemo(() => buildPriceOption(data, translation, locale), [data, translation, locale]);
  const changeOption = useMemo(() => buildChangeOption(data, translation, locale), [data, translation, locale]);
  const diffOption = useMemo(() => buildDiffOption(data, translation, locale), [data, translation, locale]);

  return (
    <section className="chart-grid">
      <ChartCard title={translation.charts.price.title} option={priceOption} />
      <ChartCard title={translation.charts.change.title} option={changeOption} />
      <ChartCard title={translation.charts.diff.title} option={diffOption} />
    </section>
  );
};
