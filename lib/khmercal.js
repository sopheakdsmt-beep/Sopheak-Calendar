// lib/khmercal.js
// ចន្ទគតិ​ខ្មែរ (Khmer lunar) — wrapper លើ vendored momentkh (zero-dep, MIT)។
//
// KH_LUNAR_OFFSET_DAYS៖ កែ​តម្រូវ​លេខ​ថ្ងៃ​ចន្ទគតិ បើ​ប្រតិទិន​ផ្លូវ​ការ​ខុស​ពី momentkh ថេរ។
//  - 0 (default) = momentkh ដើម
//  - 1 = ខែ​ចន្ទគតិ​ចាប់​មុន ១ ថ្ងៃ (ត្រូវ​នឹង App ខ្លះ; ឧ. 17 មិថុនា 2026 → ៤កើត)
// ការ​កែ​នេះ​ប៉ះ​តែ​ផ្នែក​ចន្ទគតិ (ថ្ងៃ/ខែ/ឆ្នាំ/ស័ក) — ថ្ងៃ​សប្តាហ៍ និង​សុរិយគតិ​នៅ​ត្រឹមត្រូវ​ដដែល។

import momentkh from './vendor/momentkh.cjs';

const OFFSET_DAYS = parseInt(process.env.KH_LUNAR_OFFSET_DAYS || '0', 10);

function parseYmd(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return { y, m, d };
}

// khmer fields បន្ទាប់​ពី​កែ​តម្រូវ offset (សម្រាប់​ផ្នែក​ចន្ទគតិ)
function lunarResult(y, m, d) {
  const base = Date.UTC(y, m - 1, d) + OFFSET_DAYS * 86400000;
  const dt = new Date(base);
  return momentkh.fromGregorian(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// ត្រឡប់ { lunar, solar, khmer } សម្រាប់ ymd ("YYYY-MM-DD")
export function khmerLunar(ymd) {
  const { y, m, d } = parseYmd(ymd);
  const realK = momentkh.fromGregorian(y, m, d); // ថ្ងៃ​សប្តាហ៍ + សុរិយគតិ​ពិត
  const lunK = OFFSET_DAYS ? lunarResult(y, m, d) : realK; // ផ្នែក​ចន្ទគតិ

  const weekday = momentkh.format(realK, 'ថ្ងៃW');
  const lunarBody = momentkh.format(lunK, 'dN ខែm ឆ្នាំa e ព.ស b');
  return {
    lunar: `${weekday} ${lunarBody}`,
    solar: momentkh.format(realK, 'ថ្ងៃទីds ខែM ឆ្នាំc'),
    dayLabel: momentkh.format(lunK, 'dN'), // ឧ. "៣កើត"
    monthName: lunK.khmer.monthName, // ឧ. "បឋមាសាឍ"
    weekdayName: realK.khmer.dayOfWeekName, // ឧ. "ពុធ"
    khmer: lunK.khmer,
  };
}

// ត្រឡប់ label ថ្ងៃ​សីល (ឧ. "៨កើត") ឬ null
export function silaLabel(ymd) {
  const { y, m, d } = parseYmd(ymd);
  const k = lunarResult(y, m, d).khmer;
  if (k.moonPhase === 0 && k.day === 8) return '៨កើត';
  if (k.moonPhase === 0 && k.day === 15) return '១៥កើត';
  if (k.moonPhase === 1 && k.day === 8) return '៨រោច';
  // ថ្ងៃ​រោច​ចុង​ក្រោយ (១៤ ឬ ១៥រោច) = ថ្ងៃ​បន្ទាប់​ជា ១កើត
  if (k.moonPhase === 1 && (k.day === 14 || k.day === 15)) {
    const t = new Date(Date.UTC(y, m - 1, d) + 86400000);
    const tk = lunarResult(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()).khmer;
    if (tk.day === 1 && tk.moonPhase === 0) return k.day === 15 ? '១៥រោច' : '១៤រោច';
  }
  return null;
}
