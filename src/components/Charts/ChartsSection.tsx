import { useMemo } from 'react';
import type { FC } from 'react';
import type { DailyEntry, RangeKey } from '../../services/data';
import type { Translation } from '../../i18n';
import { ChartCard } from './ChartCard';
import { buildChangeOption, buildDiffOption, buildPriceOption } from './options';

interface ChartsSectionProps {
  data: DailyEntry[];
  translation: Translation;
  locale: string;
  range: RangeKey;
}

export const ChartsSection: FC<ChartsSectionProps> = ({ data, translation, locale, range }) => {
  const priceOption = useMemo(
    () => buildPriceOption(data, translation, locale, range),
    [data, translation, locale, range],
  );
  const changeOption = useMemo(
    () => buildChangeOption(data, translation, locale, range),
    [data, translation, locale, range],
  );
  const diffOption = useMemo(
    () => buildDiffOption(data, translation, locale, range),
    [data, translation, locale, range],
  );

  return (
    <section className="chart-grid">
      <ChartCard title={translation.charts.price.title} option={priceOption} />
      <ChartCard title={translation.charts.change.title} option={changeOption} />
      <ChartCard title={translation.charts.diff.title} option={diffOption} />
    </section>
  );
};
