import type { FC } from 'react';
import type { DashboardStats } from '../../services/data';
import { formatCurrency, formatPercent } from '../../services/data';
import type { Translation } from '../../i18n';

interface CardsSectionProps {
  stats: DashboardStats;
  translation: Translation;
  locale: string;
}

function getDeltaClass(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return '';
  }
  if ((value as number) > 0) {
    return 'positive';
  }
  if ((value as number) < 0) {
    return 'negative';
  }
  return '';
}

export const CardsSection: FC<CardsSectionProps> = ({ stats, translation, locale }) => {
  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <article
        className="flex flex-col gap-3 rounded-[8px] border border-white/40 p-[clamp(20px,2.5vw,28px)]"
        aria-live="polite"
      >
        <span className="label text-[clamp(0.75rem,1vw,0.875rem)] font-semibold text-neutral-400">
          {translation.cards.vlhx.label}
        </span>
        <span className="value text-[clamp(1.75rem,3vw,2.5rem)] font-bold">
          {formatCurrency(stats.vlhx.price, locale)}
        </span>
        <span
          className={`delta text-[clamp(0.75rem,1vw,0.875rem)] font-semibold text-neutral-400 ${getDeltaClass(stats.vlhx.change)}`}
        >
          {translation.cards.vlhx.change}: {formatPercent(stats.vlhx.change, locale)}
        </span>
      </article>
      <article
        className="flex flex-col gap-3 rounded-[8px] border border-white/40 p-[clamp(20px,2.5vw,28px)]"
        aria-live="polite"
      >
        <span className="label text-[clamp(0.75rem,1vw,0.875rem)] font-semibold text-neutral-400">
          {translation.cards.wbtc.label}
        </span>
        <span className="value text-[clamp(1.75rem,3vw,2.5rem)] font-bold">
          {formatCurrency(stats.wbtc.price, locale)}
        </span>
        <span
          className={`delta text-[clamp(0.75rem,1vw,0.875rem)] font-semibold text-neutral-400 ${getDeltaClass(stats.wbtc.change)}`}
        >
          {translation.cards.wbtc.change}: {formatPercent(stats.wbtc.change, locale)}
        </span>
      </article>
      <article
        className="flex flex-col gap-3 rounded-[8px] border border-white/40 p-[clamp(20px,2.5vw,28px)]"
        aria-live="polite"
      >
        <span className="label text-[clamp(0.75rem,1vw,0.875rem)] font-semibold text-neutral-400">
          {translation.cards.spread.label}
        </span>
        <span className={`value text-[clamp(1.75rem,3vw,2.5rem)] font-bold ${getDeltaClass(stats.spread.delta)}`}>
          {formatPercent(stats.spread.delta, locale)}
        </span>
        <span className="delta text-[clamp(0.75rem,1vw,0.875rem)] font-semibold text-neutral-400">
          {translation.cards.spread.note}
        </span>
      </article>
    </section>
  );
};
