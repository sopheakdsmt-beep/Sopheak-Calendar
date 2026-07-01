// lib/datetime.js
// Helper សម្រាប់ timezone — គណនាព្រំដែនថ្ងៃ និង format ពេលវេលា។
// កម្ពុជា (Asia/Phnom_Penh) គ្មាន DST ដូច្នេះ offset ថេរ (+07:00)។

// យក offset បែប "+07:00" សម្រាប់ timezone មួយ
export function tzOffset(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const m = name.match(/GMT([+-]\d{2}:\d{2})/);
    return m ? m[1] : '+00:00';
  } catch {
    return '+00:00';
  }
}

// ថ្ងៃបច្ចុប្បន្នក្នុង tz ជា "YYYY-MM-DD"
export function ymdInTz(tz, base = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
}

// ព្រំដែនថ្ងៃនេះ (ISO ជាមួយ offset) → { start, end }
export function dayBounds(tz, base = new Date()) {
  const ymd = ymdInTz(tz, base);
  const off = tzOffset(tz);
  return {
    start: `${ymd}T00:00:00${off}`,
    end: `${ymd}T23:59:59${off}`,
  };
}

// format ពេលវេលានៃ event មួយ (timed ឬ all-day)
export function formatEventTime(ev, tz) {
  if (ev.start?.dateTime) {
    const d = new Date(ev.start.dateTime);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  }
  if (ev.start?.date) {
    const d = new Date(ev.start.date + 'T00:00:00Z');
    const s = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(d);
    return `${s} (ពេញថ្ងៃ)`;
  }
  return '';
}

// ម៉ោងចាប់ផ្ដើមជា Date (timed → dateTime, all-day → date)
export function eventStartDate(ev) {
  if (ev.start?.dateTime) return new Date(ev.start.dateTime);
  if (ev.start?.date) return new Date(ev.start.date + 'T00:00:00Z');
  return null;
}
