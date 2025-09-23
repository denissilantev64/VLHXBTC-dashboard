export const translations = {
  ru: {
    title: 'Аналитика Valhalla BTC',
    description: {
      beforeLink:
        'Динамика фонда Valhalla BTC по сравнению с обычным удержанием Bitcoin. Статистика по фонду существует за непродолжительное время, для лучшей оценки эффективности рекомендуем смотреть ',
      linkText: 'статистику самой стратегии',
      linkUrl:
        'https://dune.com/gmx-io/v2-lp-dashboard?benchmark_e87f66=&period_e52e23=all-time&pool_efd2e5=gm+arbitrum+BTC%2FUSD+%5BWBTC.b-USDC%5D',
      afterLink: '.',
    },
    footer: {
      blockchainNotice: 'Метрики формируются на основе on-chain данных сети Arbitrum и обновляются ежедневно.',
      vlhx: {
        prefix: 'Стоимость VLHXBTC рассчитываем по данным ',
        linkLabel: 'смарт-контракта Valhalla BTC',
        url: 'https://arbiscan.io/address/0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9',
        suffix: '.',
      },
      wbtc: {
        prefix: 'Справочные цены WBTC поступают из ',
        sources: [
          {
            label: 'API CoinGecko',
            url: 'https://www.coingecko.com/en/coins/wrapped-bitcoin',
          },
          {
            label: 'API CryptoCompare',
            url: 'https://www.cryptocompare.com/coins/wbtc/overview',
          },
        ],
        separator: ' и ',
        suffix: ' (резервный источник).',
      },
      lastUpdate: {
        label: 'Последнее обновление данных:',
        unavailable: 'нет данных',
      },
    },
    cta: 'Начать инвестировать',
    filters: {
      '1M': '1М',
      '2M': '2М',
      '3M': '3М',
      '6M': '6М',
      '1Y': '1Г',
      ALL: 'Все время',
    },
    filtersLabel: 'Выбор периода',
    periodLabel: 'Данные за период',
    cards: {
      vlhx: { label: 'VLHXBTC', change: 'Изменение за период' },
      wbtc: { label: 'WBTC', change: 'Изменение за период' },
      spread: {
        label: 'Доходность фонда в BTC',
        note: 'Преимущество VLHXBTC относительно изменения WBTC',
      },
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
        title: 'Доходность фонда в BTC (%)',
        series: {
          diff: 'Разница изменений',
        },
      },
    },
  },
  en: {
    title: 'Valhalla BTC Analytics',
    description:
      'Performance of the Valhalla BTC fund versus holding Bitcoin directly.',
    footer: {
      blockchainNotice: 'All analytics are derived from on-chain data on Arbitrum and updated daily.',
      vlhx: {
        prefix: 'VLHXBTC valuations are taken directly from the ',
        linkLabel: 'Valhalla BTC smart contract',
        url: 'https://arbiscan.io/address/0xf8fba992f763d8b9a8f47a4c130c1a352c24c6a9',
        suffix: '.',
      },
      wbtc: {
        prefix: 'Reference WBTC quotes rely on the ',
        sources: [
          {
            label: 'CoinGecko API',
            url: 'https://www.coingecko.com/en/coins/wrapped-bitcoin',
          },
          {
            label: 'CryptoCompare API',
            url: 'https://www.cryptocompare.com/coins/wbtc/overview',
          },
        ],
        separator: ' with ',
        suffix: ' as the fallback provider.',
      },
      lastUpdate: {
        label: 'Last data update:',
        unavailable: 'not available',
      },
    },
    cta: 'Start investing',
    filters: {
      '1M': '1M',
      '2M': '2M',
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
        title: 'Fund Performance in BTC (%)',
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
