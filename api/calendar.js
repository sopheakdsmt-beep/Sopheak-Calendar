// api/calendar.js
// ទិន្នន័យប្រតិទិនចន្ទគតិ​សាធារណៈ (read-only, គ្មាន​សិទ្ធិ​ត្រូវការ)។
// ?month=YYYY-MM → ថ្ងៃនីមួយៗ + ចន្ទគតិ + ថ្ងៃសីល + ថ្ងៃឈប់សម្រាក។
// បង្ហាញ​តែ​ទិន្នន័យ​សាធារណៈ (គ្មាន​អ្វី​សម្ងាត់)។

import { khmerLunar, silaLabel } from '../lib/khmercal.js';
import { getHolidaysInRange, getSetting } from '../lib/db.js';
import { config } from '../lib/config.js';
import { ymdInTz } from '../lib/datetime.js';

const pad = (n) => String(n).padStart(2, '0');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const tz = config.defaultTimezone;
  const todayYmd = ymdInTz(tz);
  const monthParam = /^\d{4}-\d{2}$/.test(req.query?.month || '') ? req.query.month : todayYmd.slice(0, 7);
  const [y, m] = monthParam.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

  let holMap = {};
  try {
    const hols = await getHolidaysInRange(`${monthParam}-01`, `${monthParam}-${pad(daysInMonth)}`);
    for (const h of hols) holMap[h.holiday_date] = h.name;
  } catch {
    /* holidays table អាចមិនទាន់មាន */
  }

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${monthParam}-${pad(d)}`;
    const kh = khmerLunar(ymd);
    days.push({
      date: ymd,
      g: d,
      lunar: kh.dayLabel, // ខ្លី "៨កើត" សម្រាប់ cell
      full: kh.lunar, // ពេញ "ថ្ងៃច័ន្ទ ៨កើត ខែ..." សម្រាប់ detail + copy
      month: kh.monthName,
      sila: silaLabel(ymd),
      holiday: holMap[ymd] || null,
    });
  }

  const todayKh = khmerLunar(todayYmd);
  const bannerJson = await getSetting('app_banner').catch(() => null);
  const banner = bannerJson ? JSON.parse(bannerJson) : null;
  const sponsor = (await getSetting('sponsor').catch(() => null)) || '';
  res.setHeader('cache-control', 'public, max-age=300');
  res.status(200).json({
    banner,
    sponsor,
    ym: monthParam,
    y,
    m,
    firstWeekday,
    today: todayYmd,
    todayLunar: todayKh.lunar,
    todaySolar: todayKh.solar,
    todaySila: silaLabel(todayYmd),
    todayHoliday: holMap[todayYmd] || null,
    days,
  });
}
