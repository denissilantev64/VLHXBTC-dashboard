import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { RangeKey } from './services/data';
import {
  DATA_REFRESH_INTERVAL_MS,
  computeDashboardStats,
  fetchDashboardData,
  filterByRange,
  getAvailableRanges,
  normalizeRange,
  type DailyEntry,
} from './services/data';
import { defaultLanguage, getTranslation, type Language } from './i18n';
import { Header } from './components/Header/Header';
import { CardsSection } from './components/Cards/CardsSection';
import { ChartsSection } from './components/Charts/ChartsSection';

function getLocale(language: Language): string {
  return language === 'ru' ? 'ru-RU' : 'en-US';
}

export function App(): JSX.Element {
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  const [range, setRange] = useState<RangeKey>('1D');
  const [data, setData] = useState<DailyEntry[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const dataset = await fetchDashboardData();
        if (isMounted) {
          setData(dataset);
        }
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      }
    };

    load();
    const interval = window.setInterval(load, DATA_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    setRange((prev) => normalizeRange(prev, data));
  }, [data]);

  const translation = useMemo(() => getTranslation(language), [language]);
  const locale = getLocale(language);
  const availableRanges = useMemo(() => getAvailableRanges(data), [data]);
  const filteredData = useMemo(() => filterByRange(range, data), [range, data]);
  const stats = useMemo(() => computeDashboardStats(filteredData), [filteredData]);

  const handleToggleLanguage = () => {
    setLanguage((prev) => (prev === 'ru' ? 'en' : 'ru'));
  };

  const handleRangeChange = (nextRange: RangeKey) => {
    if (nextRange === range) {
      return;
    }
    if (!availableRanges.includes(nextRange)) {
      return;
    }
    setRange(nextRange);
  };

  return (
    <div className="page">
      <Header
        translation={translation}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        range={range}
        availableRanges={availableRanges}
        onRangeChange={handleRangeChange}
      />
      <main className="content">
        <CardsSection stats={stats} translation={translation} locale={locale} />
        <ChartsSection data={filteredData} translation={translation} locale={locale} range={range} />
      </main>
      <footer>{translation.footer}</footer>
    </div>
  );
}

export default App;
