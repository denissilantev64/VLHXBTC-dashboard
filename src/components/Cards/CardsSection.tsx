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
    <section className="cards">
      <article className="card" aria-live="polite">
        <span className="label">{translation.cards.vlhx.label}</span>
        <span className="value">{formatCurrency(stats.vlhx.price, locale)}</span>
        <span className={`delta ${getDeltaClass(stats.vlhx.change)}`}>
          {translation.cards.vlhx.change}: {formatPercent(stats.vlhx.change)}
        </span>
      </article>
      <article className="card" aria-live="polite">
        <span className="label">{translation.cards.wbtc.label}</span>
        <span className="value">{formatCurrency(stats.wbtc.price, locale)}</span>
        <span className={`delta ${getDeltaClass(stats.wbtc.change)}`}>
          {translation.cards.wbtc.change}: {formatPercent(stats.wbtc.change)}
        </span>
      </article>
      <article className="card" aria-live="polite">
        <span className="label">{translation.cards.spread.label}</span>
        <span className={`value ${getDeltaClass(stats.spread.delta)}`}>{formatPercent(stats.spread.delta)}</span>
        <span className="delta">{translation.cards.spread.note}</span>
      </article>
    </section>
  );
};
