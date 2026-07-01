// lib/eventflow.js
// Guided flow សម្រាប់បង្កើតព្រឹត្តិការណ៍ចូល Google Calendar តាមប៊ូតុង។
// លំដាប់៖ ឈ្មោះ (text) → ថ្ងៃ (inline calendar) → ម៉ោង → របៀបរំលឹក → preview → confirm។
// State រក្សាក្នុង event_drafts (serverless stateless)។

import { config } from './config.js';
import { sendMessage, answerCallbackQuery, editMessageReplyMarkup, esc } from './telegram.js';
import {
  getUser,
  getRefreshToken,
  getDraft,
  saveDraft,
  clearDraft,
  disconnectUser,
  insertScheduledReminders,
  ensureUser,
  addLocalEvent,
} from './db.js';
import { refreshAccessToken, createEvent } from './google.js';
import { tzOffset, ymdInTz } from './datetime.js';
import { validateUserText } from './sanitize.js';

const REMINDER_LABELS = {
  before30: 'មុន ៣០ នាទី',
  before60: 'មុន ១ ម៉ោង',
  before1440: 'មុន ១ ថ្ងៃ',
  hourly: 'រាល់ម៉ោង (ថ្ងៃនោះ)',
  daily: 'រាល់ថ្ងៃ ដល់ថ្ងៃនោះ',
  none: 'គ្មានរំលឹក',
};

const pad = (n) => String(n).padStart(2, '0');

// steps ដែលរង់ចាំ text input ពី user
export function isAwaitingText(draft) {
  return !!draft && (draft.step === 'title' || draft.step === 'time_custom');
}

// ---- ចាប់ផ្ដើម flow ----
export async function startEventFlow(chatId, userId, isPrivate) {
  if (!isPrivate) {
    return sendMessage(chatId, '🔒 សូមបង្កើតព្រឹត្តិការណ៍ក្នុង chat ឯកជន (DM) ជាមួយ bot។');
  }
  await ensureUser(userId); // ធានាមាន users row (FK សម្រាប់ draft/local event) — មិនបាច់ភ្ជាប់ Google
  await saveDraft(userId, {
    step: 'title',
    summary: null,
    event_date: null,
    event_time: null,
    reminder_kind: null,
  });
  return sendMessage(
    chatId,
    '📝 <b>បង្កើតព្រឹត្តិការណ៍ថ្មី</b>\n\nវាយ <b>ឈ្មោះ</b> ព្រឹត្តិការណ៍ (ឧ. ប្រជុំក្រុម)៖\n\n<i>បោះបង់៖ /cancel</i>'
  );
}

// ---- text input (ឈ្មោះ ឬ ម៉ោងផ្ទាល់ខ្លួន) ----
export async function handleEventText(message, draft) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();

  if (draft.step === 'title') {
    const err = validateUserText(text, { max: 200 }); // 🔒 បដិសេធ link/URL
    if (err) {
      return sendMessage(chatId, `${err}។ វាយឈ្មោះព្រឹត្តិការណ៍ម្ដងទៀត៖`);
    }
    await saveDraft(userId, { summary: text, step: 'date' });
    const now = new Date();
    return sendMessage(
      chatId,
      `✅ ឈ្មោះ៖ <b>${esc(text)}</b>\n\n📅 ឥឡូវជ្រើស <b>ថ្ងៃ</b>៖`,
      buildCalendar(now.getFullYear(), now.getMonth())
    );
  }

  if (draft.step === 'time_custom') {
    const m = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!m || +m[1] > 23 || +m[2] > 59) {
      return sendMessage(chatId, 'ទម្រង់ម៉ោងមិនត្រឹមត្រូវ។ វាយបែប <code>HH:MM</code> (ឧ. 14:30)៖');
    }
    const time = `${pad(+m[1])}:${m[2]}`;
    await saveDraft(userId, { event_time: time, step: 'reminder' });
    return sendMessage(chatId, `✅ ម៉ោង៖ <b>${time}</b>\n\n🔔 ជ្រើស <b>របៀបរំលឹក</b>៖`, reminderKeyboard());
  }
}

// ---- callbacks (ev:*) ----
export async function handleEventCallback(cq) {
  const chatId = cq.message?.chat?.id;
  const userId = cq.from.id;
  const data = cq.data || '';

  // ប្ដូរខែ​ក្នុង​ប្រតិទិន (មិនត្រូវការ draft)
  if (data.startsWith('ev:nav:')) {
    const [y, mo] = data.slice(7).split('-').map(Number);
    await answerCallbackQuery(cq.id, '');
    const kb = buildCalendar(y, mo - 1).reply_markup;
    return editMessageReplyMarkup(chatId, cq.message.message_id, kb);
  }
  if (data === 'ev:noop') return answerCallbackQuery(cq.id, '');

  if (data === 'ev:cancel') {
    await clearDraft(userId);
    await answerCallbackQuery(cq.id, 'បានបោះបង់');
    return sendMessage(chatId, '❌ បានបោះបង់ការបង្កើតព្រឹត្តិការណ៍។');
  }

  const draft = await getDraft(userId);
  if (!draft) {
    return answerCallbackQuery(cq.id, 'សម័យផុតកំណត់ — ចាប់ផ្ដើមឡើងវិញ /new');
  }

  if (data.startsWith('ev:date:')) {
    const date = data.slice(8);
    await saveDraft(userId, { event_date: date, step: 'time' });
    await answerCallbackQuery(cq.id, '');
    return sendMessage(chatId, `✅ ថ្ងៃ៖ <b>${esc(date)}</b>\n\n🕒 ជ្រើស <b>ម៉ោង</b>៖`, timeKeyboard());
  }

  if (data.startsWith('ev:time:')) {
    const val = data.slice(8);
    if (val === 'other') {
      await saveDraft(userId, { step: 'time_custom' });
      await answerCallbackQuery(cq.id, '');
      return sendMessage(chatId, '🕒 វាយម៉ោងបែប <code>HH:MM</code> (ឧ. 09:30)៖');
    }
    await saveDraft(userId, { event_time: val, step: 'reminder' });
    await answerCallbackQuery(cq.id, '');
    return sendMessage(chatId, `✅ ម៉ោង៖ <b>${esc(val)}</b>\n\n🔔 ជ្រើស <b>របៀបរំលឹក</b>៖`, reminderKeyboard());
  }

  if (data.startsWith('ev:rem:')) {
    const kind = data.slice(7);
    await saveDraft(userId, { reminder_kind: kind, step: 'confirm' });
    await answerCallbackQuery(cq.id, '');
    return sendMessage(chatId, previewText({ ...draft, reminder_kind: kind }), confirmKeyboard());
  }

  if (data === 'ev:confirm') {
    await answerCallbackQuery(cq.id, 'កំពុងបង្កើត...');
    return confirmAndCreate(chatId, userId, draft);
  }

  return answerCallbackQuery(cq.id, '');
}

// ---- បង្កើតព្រឹត្តិការណ៍ពិត + កំណត់រំលឹក ----
async function confirmAndCreate(chatId, userId, draft) {
  if (!draft.summary || !draft.event_date || !draft.event_time || !draft.reminder_kind) {
    return sendMessage(chatId, '⚠️ ព័ត៌មានមិនគ្រប់។ ចាប់ផ្ដើមឡើងវិញ /new');
  }
  const user = await getUser(userId);
  const tz = user?.timezone || config.defaultTimezone;
  const offset = tzOffset(tz);
  const startDt = new Date(`${draft.event_date}T${draft.event_time}:00${offset}`);
  if (isNaN(startDt.getTime())) {
    return sendMessage(chatId, '⚠️ ថ្ងៃ/ម៉ោងមិនត្រឹមត្រូវ។ /new ម្ដងទៀត។');
  }
  const endDt = new Date(startDt.getTime() + 60 * 60000);

  // បើភ្ជាប់ Google → សរសេរចូល Google; បើមិន (ឬ Google បរាជ័យ) → រក្សាក្នុង Bot
  const refresh = getRefreshToken(user);
  let googleEventId = null;
  let savedGoogle = false;
  let googleLink = '';
  if (refresh) {
    try {
      const accessToken = await refreshAccessToken(refresh);
      const event = {
        summary: draft.summary,
        start: { dateTime: startDt.toISOString(), timeZone: tz },
        end: { dateTime: endDt.toISOString(), timeZone: tz },
        reminders: { useDefault: false, overrides: googleOverrides(draft.reminder_kind) },
        extendedProperties: { private: { viaBot: '1' } },
      };
      const created = await createEvent(accessToken, event);
      googleEventId = created.id;
      savedGoogle = true;
      if (created.htmlLink) googleLink = `\n\n🔗 <a href="${created.htmlLink}">មើលក្នុង Google Calendar</a>`;
    } catch (err) {
      if (err.status === 400) await disconnectUser(userId);
      // Google បរាជ័យ (token ផុត ឬខ្វះសិទ្ធិ) → fall back ទៅ Bot (កុំឲ្យបាត់ព្រឹត្តិការណ៍)
    }
  }

  if (!savedGoogle) {
    // អ្នកប្រើមិនបានភ្ជាប់ Google (ឬ Google បរាជ័យ) → រក្សាក្នុង Bot
    await addLocalEvent(userId, draft.summary, startDt.toISOString(), draft.reminder_kind);
  }

  const whenText = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(startDt);

  const rows = computeReminders(draft.reminder_kind, startDt, userId, draft.summary, whenText, googleEventId);
  await insertScheduledReminders(rows);
  await clearDraft(userId);

  const where = savedGoogle ? '📅 Google Calendar' : '🤖 ក្នុង Bot';
  return sendMessage(
    chatId,
    `✅ <b>បានបង្កើតព្រឹត្តិការណ៍!</b>\n\n` +
      `📌 ${esc(draft.summary)}\n🕒 ${esc(whenText)}\n🔔 ${REMINDER_LABELS[draft.reminder_kind]}\n` +
      `💾 រក្សាទុក៖ ${where}\n📨 រំលឹក ${rows.length} ដង${googleLink}`
  );
}

function googleOverrides(kind) {
  const map = { before30: 30, before60: 60, before1440: 1440 };
  return map[kind] ? [{ method: 'popup', minutes: map[kind] }] : [];
}

// precompute remind_at timestamps (cron ផ្ញើទៅ Telegram)
function computeReminders(kind, startDt, userId, summary, whenText, googleEventId) {
  const now = Date.now();
  const start = startDt.getTime();
  const times = [];
  const add = (ms) => { if (ms > now && ms < start) times.push(ms); };

  if (kind === 'before30') add(start - 30 * 60000);
  else if (kind === 'before60') add(start - 60 * 60000);
  else if (kind === 'before1440') add(start - 1440 * 60000);
  else if (kind === 'hourly') {
    for (let i = 1; i <= 24; i++) { const t = start - i * 3600000; if (t <= now) break; add(t); }
  } else if (kind === 'daily') {
    for (let i = 1; i <= 60; i++) { const t = start - i * 86400000; if (t <= now) break; add(t); }
  }
  // 'none' → គ្មាន

  const uniq = [...new Set(times)].sort((a, b) => a - b).slice(0, 70);
  return uniq.map((ms) => ({
    telegram_id: userId,
    summary,
    when_text: whenText,
    event_start: new Date(start).toISOString(),
    remind_at: new Date(ms).toISOString(),
    google_event_id: googleEventId || null,
    sent: false,
  }));
}

// ---- keyboards ----
export function buildCalendar(year, month, tz = config.defaultTimezone) {
  const firstUTC = new Date(Date.UTC(year, month, 1));
  const monthName = firstUTC.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startWeekday = firstUTC.getUTCDay();
  const todayYmd = ymdInTz(tz);

  const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  const rows = [];
  rows.push([
    { text: '◀', callback_data: `ev:nav:${prev.y}-${prev.m + 1}` },
    { text: `${monthName} ${year}`, callback_data: 'ev:noop' },
    { text: '▶', callback_data: `ev:nav:${next.y}-${next.m + 1}` },
  ]);
  rows.push(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => ({ text: d, callback_data: 'ev:noop' })));

  let week = [];
  for (let i = 0; i < startWeekday; i++) week.push({ text: ' ', callback_data: 'ev:noop' });
  for (let day = 1; day <= daysInMonth; day++) {
    const ymd = `${year}-${pad(month + 1)}-${pad(day)}`;
    const isPast = ymd < todayYmd;
    week.push(
      isPast
        ? { text: '·', callback_data: 'ev:noop' }
        : { text: String(day), callback_data: `ev:date:${ymd}` }
    );
    if (week.length === 7) { rows.push(week); week = []; }
  }
  if (week.length) {
    while (week.length < 7) week.push({ text: ' ', callback_data: 'ev:noop' });
    rows.push(week);
  }
  rows.push([{ text: '❌ បោះបង់', callback_data: 'ev:cancel' }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function timeKeyboard() {
  const hours = [];
  for (let h = 6; h <= 21; h++) hours.push(`${pad(h)}:00`);
  const rows = [];
  for (let i = 0; i < hours.length; i += 4) {
    rows.push(hours.slice(i, i + 4).map((t) => ({ text: t, callback_data: `ev:time:${t}` })));
  }
  rows.push([
    { text: '🕒 ម៉ោងផ្សេង (វាយ)', callback_data: 'ev:time:other' },
    { text: '❌ បោះបង់', callback_data: 'ev:cancel' },
  ]);
  return { reply_markup: { inline_keyboard: rows } };
}

function reminderKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔔 មុន ៣០ នាទី', callback_data: 'ev:rem:before30' }],
        [{ text: '🔔 មុន ១ ម៉ោង', callback_data: 'ev:rem:before60' }],
        [{ text: '🔔 មុន ១ ថ្ងៃ', callback_data: 'ev:rem:before1440' }],
        [{ text: '🔁 រាល់ម៉ោង (ថ្ងៃនោះ)', callback_data: 'ev:rem:hourly' }],
        [{ text: '🔁 រាល់ថ្ងៃ (ដល់ថ្ងៃនោះ)', callback_data: 'ev:rem:daily' }],
        [{ text: '🔕 គ្មានរំលឹក', callback_data: 'ev:rem:none' }],
        [{ text: '❌ បោះបង់', callback_data: 'ev:cancel' }],
      ],
    },
  };
}

function confirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ បញ្ជាក់ បង្កើត', callback_data: 'ev:confirm' },
          { text: '❌ បោះបង់', callback_data: 'ev:cancel' },
        ],
      ],
    },
  };
}

function previewText(d) {
  return (
    '🧾 <b>ពិនិត្យមុនបង្កើត</b>\n\n' +
    `📌 ឈ្មោះ៖ <b>${esc(d.summary)}</b>\n` +
    `📅 ថ្ងៃ៖ <b>${esc(d.event_date)}</b>\n` +
    `🕒 ម៉ោង៖ <b>${esc(d.event_time)}</b>\n` +
    `🔔 រំលឹក៖ <b>${REMINDER_LABELS[d.reminder_kind] || d.reminder_kind}</b>\n\n` +
    'ចុច ✅ ដើម្បីបង្កើតចូល Google Calendar។'
  );
}
