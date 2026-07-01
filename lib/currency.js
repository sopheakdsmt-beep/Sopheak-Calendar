// lib/currency.js
// អត្រាប្ដូរប្រាក់ USD → KHR/THB/CNY/EUR/SGD/JPY (ឥតគិតថ្លៃ, គ្មាន API key)។
// Cache ក្នុង table `settings` ដែលមានស្រាប់ (key/value) ដើម្បីកុំហៅ external API ញឹកពេក
// និងដើម្បីមាន fallback ពេល API ក្រៅដួល។

import { getSetting, setSetting } from './db.js';

const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY = 'fx_cache';
const TTL_MS = 6 * 3600 * 1000; // 6 ម៉ោង
const CODES = ['KHR', 'THB', 'CNY', 'EUR', 'SGD', 'JPY'];
const FLAG = { KHR: '🇰🇭', THB: '🇹🇭', CNY: '🇨🇳', EUR: '🇪🇺', SGD: '🇸🇬', JPY: '🇯🇵' };
const LABEL = { KHR: 'រៀល (KHR)', THB: 'បាត (THB)', CNY: 'យ័ន (CNY)', EUR: 'អឺរ៉ូ (EUR)', SGD: 'ដុល្លារសិង្ហបុរី (SGD)', JPY: 'យែន (JPY)' };

async function fetchLive() {
  const res = await fetch(FX_URL);
  if (!res.ok) throw new Error(`fx fetch failed: ${res.status}`);
  const json = await res.json();
  if (json.result !== 'success' || !json.rates) throw new Error('fx fetch: bad payload');
  const rates = {};
  for (const code of CODES) rates[code] = json.rates[code];
  return rates;
}

// ត្រឡប់ { rates, fetchedAt, stale } — ប្រើ cache បើនៅក្នុង TTL, បើមិនអាចទាញថ្មីបាន ប្រើ cache ចាស់ (stale)
export async function getRates() {
  let cached = null;
  try {
    const raw = await getSetting(CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {
    /* cache corrupt ឬ table មិនទាន់មាន — រំលង */
  }

  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return { rates: cached.rates, fetchedAt: cached.fetchedAt, stale: false };
  }

  try {
    const rates = await fetchLive();
    const fetchedAt = Date.now();
    await setSetting(CACHE_KEY, JSON.stringify({ rates, fetchedAt })).catch(() => {});
    return { rates, fetchedAt, stale: false };
  } catch (err) {
    if (cached) return { rates: cached.rates, fetchedAt: cached.fetchedAt, stale: true };
    throw err;
  }
}

function fmtNumber(n) {
  if (n >= 100) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function formatRatesMessage({ rates, fetchedAt, stale }) {
  const lines = CODES.filter((c) => rates[c] != null).map(
    (c) => `${FLAG[c]} ${fmtNumber(rates[c])} ${LABEL[c]}`
  );
  const updated = new Date(fetchedAt).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Phnom_Penh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return (
    '💱 <b>អត្រាប្ដូរប្រាក់ (USD ថ្ងៃនេះ)</b>\n\n' +
    `🇺🇸 1 USD =\n${lines.join('\n')}\n\n` +
    `ធ្វើបច្ចុប្បន្នភាពៈ ${updated}` +
    (stale ? '\n⚠️ ទិន្នន័យចាស់ (មិនអាចទាញថ្មីបានទេពេលនេះ)' : '')
  );
}
