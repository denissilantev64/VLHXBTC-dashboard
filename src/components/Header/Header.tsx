import type { FC } from 'react';
import { RANGE_ORDER, type RangeKey } from '../../services/data';
import type { Language } from '../../i18n';
import type { Translation } from '../../i18n';

interface HeaderProps {
  translation: Translation;
  language: Language;
  onToggleLanguage: () => void;
  range: RangeKey;
  availableRanges: RangeKey[];
  onRangeChange: (range: RangeKey) => void;
}

function resolveBaseHref(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export const Header: FC<HeaderProps> = ({
  translation,
  language,
  onToggleLanguage,
  range,
  availableRanges,
  onRangeChange,
}) => {
  const baseHref = resolveBaseHref();
  return (
    <header className="top-bar">
      <div className="header-nav">
        <a className="logo-link" href={baseHref} aria-label="Valhalla home">
          <img src={`${baseHref}logo.svg`} alt="Valhalla" />
        </a>
        <div className="header-actions">
          <a
            className="invest-button"
            href="https://dhedge.org/vault/0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9"
            target="_blank"
            rel="noopener noreferrer"
          >
            {translation.cta}
          </a>
          <button
            type="button"
            className="language-toggle"
            onClick={onToggleLanguage}
            aria-label={language === 'ru' ? 'Переключить на английский язык' : 'Switch to Russian language'}
          >
            {language.toUpperCase()}
          </button>
        </div>
      </div>
      <div className="brand">
        <h1>{translation.title}</h1>
        <p className="description">{translation.description}</p>
      </div>
      <div className="filters-row">
        <span className="filters-caption">{translation.periodLabel}</span>
        <div className="filters" role="group" aria-label={translation.filtersLabel}>
          {RANGE_ORDER.map((key) => {
            const isAvailable = availableRanges.includes(key);
            const className = [key === range ? 'active' : '', isAvailable ? '' : 'hidden'].filter(Boolean).join(' ');
            return (
              <button
                key={key}
                type="button"
                data-range={key}
                className={className}
                onClick={() => onRangeChange(key)}
                disabled={!isAvailable}
              >
                {translation.filters[key] ?? key}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
