export const translations = {
  ru: {
    title: 'Аналитика Valhalla BTC',
    description:
      'Динамика фонда Valhalla BTC по сравнению с обычным удержанием Bitcoin. Информация обновляется автоматически каждые 10 минут.',
    footer: 'Данные получены из открытых источников (CoinGecko, Arbitrum) и обновляются ежедневно. Визуализация с помощью ECharts.',
    cta: 'Начать инвестировать',
    filters: {
      '1D': '1Д',
      '1M': '1М',
      '3M': '3М',
      '6M': '6М',
      '1Y': '1Г',
      ALL: 'Всё',
    },
    filtersLabel: 'Выбор периода',
    periodLabel: 'Данные за период',
    cards: {
      vlhx: { label: 'VLHXBTC', change: 'Изменение за период' },
      wbtc: { label: 'WBTC', change: 'Изменение за период' },
      spread: { label: 'Разница в изменении', note: 'Изменение VLHXBTC минус изменение WBTC' },
    },
    charts: {
      price: {
        title: 'Цена WBTC и VLHXBTC (USD)',
        series: {
          wbtc: 'Цена WBTC',
          vlhx: 'Цена VLHXBTC',
        },
      },
      change: {
        title: 'Изменение цен WBTC и VLHXBTC (%)',
        series: {
          wbtc: 'Изменение WBTC',
          vlhx: 'Изменение VLHXBTC',
        },
      },
      diff: {
        title: 'Разница изменения (%)',
        series: {
          diff: 'Разница изменений',
        },
      },
    },
  },
  en: {
    title: 'Valhalla BTC Analytics',
    description:
      'Performance of the Valhalla BTC fund versus holding Bitcoin directly. Data refreshes automatically every 10 minutes.',
    footer: 'Data is sourced from public feeds (CoinGecko, Arbitrum) and updates daily. Visualised with ECharts.',
    cta: 'Start investing',
    filters: {
      '1D': '1D',
      '1M': '1M',
      '3M': '3M',
      '6M': '6M',
      '1Y': '1Y',
      ALL: 'All',
    },
    filtersLabel: 'Select time range',
    periodLabel: 'Data for period',
    cards: {
      vlhx: { label: 'VLHXBTC', change: 'Change over period' },
      wbtc: { label: 'WBTC', change: 'Change over period' },
      spread: { label: 'Performance spread', note: 'VLHXBTC change minus WBTC change' },
    },
    charts: {
      price: {
        title: 'WBTC and VLHXBTC Price (USD)',
        series: {
          wbtc: 'WBTC Price',
          vlhx: 'VLHXBTC Price',
        },
      },
      change: {
        title: 'WBTC and VLHXBTC Price Change (%)',
        series: {
          wbtc: 'WBTC Change',
          vlhx: 'VLHXBTC Change',
        },
      },
      diff: {
        title: 'Change Difference (%)',
        series: {
          diff: 'Change spread',
        },
      },
    },
  },
} as const;

export type Language = keyof typeof translations;
export type Translation = (typeof translations)[Language];

export const defaultLanguage: Language = 'ru';

export function getTranslation(language: Language): Translation {
  return translations[language] ?? translations[defaultLanguage];
}
