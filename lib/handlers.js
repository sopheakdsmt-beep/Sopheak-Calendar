// lib/handlers.js
// Router សម្រាប់ Telegram update — រៀបចំ command ទាំងអស់របស់ bot។
// រាល់ការទាក់ទង Google Calendar ត្រូវការ user ភ្ជាប់រួច (per-user OAuth)។

import { config } from './config.js';
import { sendMessage, sendPhoto, answerCallbackQuery, urlButton, inlineButtons, webAppButton, esc } from './telegram.js';
import { createState } from './state.js';
import { buildAuthUrl, refreshAccessToken, listEvents } from './google.js';
import { dayBounds, formatEventTime, ymdInTz } from './datetime.js';
import { khmerLunar, silaLabel } from './khmercal.js';
import { getRates, formatRatesMessage } from './currency.js';
import { exceltoolsMenuText, exceltoolsMenuKeyboard, exceltoolsDetail } from './exceltools.js';
import {
  getUser,
  getRefreshToken,
  disconnectUser,
  updatePreferences,
  getDraft,
  clearDraft,
  getSetting,
  countUsers,
  listLocalEvents,
  getSponsorShows,
  logSponsorShown,
} from './db.js';
import {
  startEventFlow,
  isAwaitingText,
  handleEventText,
  handleEventCallback,
} from './eventflow.js';

// ---- ប៊ូតុង (reply keyboard) ----
const BTN = {
  NEW: '➕ ព្រឹត្តិការណ៍ថ្មី',
  TODAY: '📅 ថ្ងៃនេះ',
  WEEK: '🗓 ៧ ថ្ងៃ',
  NEXT: '⏭ បន្ទាប់',
  CONNECT: '🔗 ភ្ជាប់ Google',
  STATUS: '📊 ស្ថានភាព',
  HELP: '❓ ជំនួយ',
  DISCONNECT: '🔌 ផ្ដាច់',
  RATE: '💱 អត្រាប្ដូរប្រាក់',
  SILA: '🛕 ថ្ងៃសីល',
  TOOLS: '🧰 Excel & Sheets',
};
const BUTTON_TO_CMD = {
  [BTN.NEW]: '/new',
  [BTN.TODAY]: '/today',
  [BTN.WEEK]: '/week',
  [BTN.NEXT]: '/next',
  [BTN.CONNECT]: '/connect',
  [BTN.STATUS]: '/status',
  [BTN.HELP]: '/help',
  [BTN.DISCONNECT]: '/disconnect',
  [BTN.RATE]: '/rate',
  [BTN.SILA]: '/sila',
  [BTN.TOOLS]: '/tools',
};
// ពាក្យធម្មតា (គ្មាន /) → command; case-insensitive
const TEXT_KEYWORDS = {
  today: '/today',
  week: '/week',
  next: '/next',
  help: '/help',
  start: '/start',
  connect: '/connect',
  status: '/status',
  notify: '/notify',
  new: '/new',
  rate: '/rate',
  sila: '/sila',
  tools: '/tools',
};
function mainKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: BTN.NEW }],
        [{ text: BTN.TODAY }, { text: BTN.WEEK }, { text: BTN.NEXT }],
        [{ text: BTN.RATE }, { text: BTN.SILA }, { text: BTN.TOOLS }],
        [{ text: BTN.CONNECT }, { text: BTN.STATUS }],
        [{ text: BTN.HELP }, { text: BTN.DISCONNECT }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    },
  };
}

// --- entry point ---
export async function handleUpdate(update) {
  try {
    if (update.callback_query) return await handleCallback(update.callback_query);
    if (update.message?.text) {
      await handleMessage(update.message);
      await maybeShowSponsor(update.message.chat.id, update.message.from.id); // sponsor (តាមប្រេកង់ Admin)
      return;
    }
  } catch (err) {
    console.error('[handler] error:', err.message);
    // ព្យាយាមជូនដំណឹង user ដោយមិន leak detail
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    if (chatId) {
      await sendMessage(chatId, '⚠️ មានបញ្ហាបច្ចេកទេសបណ្ដោះអាសន្ន។ សូមព្យាយាមម្ដងទៀត។');
    }
  }
}

// បង្ហាញ sponsor ស្វ័យប្រវត្តិ — ប្រេកង់ = sponsor_per_week (Admin កំណត់; default 2/សប្ដាហ៍),
// spacing ≥20h ដើម្បីកុំរំខាន។ បិទដោយដាក់ sponsor_per_week = 0 ឬ sponsor ទទេ។
async function maybeShowSponsor(chatId, userId) {
  try {
    const sponsor = (await getSetting('sponsor')) || '';
    if (!sponsor.trim()) return;
    const perWeek = parseInt((await getSetting('sponsor_per_week')) || '2', 10);
    if (!(perWeek > 0)) return;
    const shows = await getSponsorShows(userId);
    if (shows.length >= perWeek) return;
    const lastMs = shows.length ? new Date(shows[0]).getTime() : 0;
    if (Date.now() - lastMs < 20 * 3600 * 1000) return;
    const image = (await getSetting('sponsor_image')) || '';
    if (image) await sendPhoto(chatId, image, sponsor);
    else await sendMessage(chatId, sponsor);
    await logSponsorShown(userId);
  } catch (e) {
    console.error('[sponsor]', e.message);
  }
}

// --- messages / commands ---
async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id; // key user ដោយ telegram user id
  const username = message.from.username;
  const isPrivate = message.chat.type === 'private';

  const rawText = message.text.trim();

  // mid-flow text input (ឈ្មោះ event ឬ ម៉ោងផ្ទាល់ខ្លួន)
  const draft = await getDraft(userId);
  if (draft && Date.now() - new Date(draft.updated_at).getTime() > 30 * 60000) {
    await clearDraft(userId); // draft ចាស់ > 30 នាទី → បោះចោល
  } else if (isAwaitingText(draft) && !rawText.startsWith('/') && !BUTTON_TO_CMD[rawText]) {
    return handleEventText(message, draft);
  }

  let text = rawText;
  if (BUTTON_TO_CMD[text]) text = BUTTON_TO_CMD[text]; // ប៊ូតុង → command
  else if (TEXT_KEYWORDS[text.toLowerCase()]) text = TEXT_KEYWORDS[text.toLowerCase()]; // ពាក្យធម្មតា
  const [rawCmd, ...args] = text.split(/\s+/);
  const command = rawCmd.split('@')[0].toLowerCase(); // ដក @botname ចេញ

  switch (command) {
    case '/start':
      return cmdStart(chatId);

    case '/help':
      return sendMessage(chatId, helpText(), mainKeyboard());

    case '/admin':
      return cmdAdmin(chatId, userId);

    case '/new':
      return startEventFlow(chatId, userId, isPrivate);

    case '/cancel':
      await clearDraft(userId);
      return sendMessage(chatId, 'បានបោះបង់ ✅');

    case '/connect':
      return cmdConnect(chatId, userId, isPrivate);

    case '/status':
      return cmdStatus(chatId, userId);

    case '/disconnect':
      return cmdDisconnectPrompt(chatId, userId);

    case '/today':
      return cmdAgenda(chatId, userId, 'today');

    case '/week':
      return cmdAgenda(chatId, userId, 'week');

    case '/next':
      return cmdAgenda(chatId, userId, 'next');

    case '/remind':
      return cmdRemind(chatId, userId, args[0]);

    case '/timezone':
      return cmdTimezone(chatId, userId, args[0]);

    case '/notify':
      return cmdNotify(chatId, userId);

    case '/whoami':
      return sendMessage(chatId, `🆔 Telegram ID របស់អ្នក៖ <code>${userId}</code>`);

    case '/rate':
      return cmdRate(chatId);

    case '/sila':
      return cmdSila(chatId, userId);

    case '/tools':
      return sendMessage(chatId, exceltoolsMenuText(), exceltoolsMenuKeyboard());

    default:
      if (command.startsWith('/')) {
        return sendMessage(chatId, 'មិនស្គាល់ command នេះទេ។ វាយ /help ដើម្បីមើលបញ្ជី។');
      }
      return; // អត្ថបទធម្មតា — មិនឆ្លើយ
  }
}

// --- callback queries (inline buttons) ---
async function handleCallback(cq) {
  const chatId = cq.message?.chat?.id;
  const userId = cq.from.id;
  const data = cq.data || '';

  if (data.startsWith('ev:')) return handleEventCallback(cq);

  if (data.startsWith('xl:')) {
    await answerCallbackQuery(cq.id, '');
    const key = data.slice(3);
    if (key === 'menu') return sendMessage(chatId, exceltoolsMenuText(), exceltoolsMenuKeyboard());
    const detail = exceltoolsDetail(key);
    if (!detail) return sendMessage(chatId, exceltoolsMenuText(), exceltoolsMenuKeyboard());
    return sendMessage(chatId, detail.text, detail.keyboard);
  }

  if (data === 'disconnect_yes') {
    await disconnectUser(userId);
    await answerCallbackQuery(cq.id, 'បានផ្ដាច់រួចរាល់');
    return sendMessage(chatId, '✅ បានផ្ដាច់ Google Calendar រួចរាល់។ Token ត្រូវបានលុបចេញ។');
  }
  if (data === 'disconnect_no') {
    await answerCallbackQuery(cq.id, 'បានបោះបង់');
    return sendMessage(chatId, 'មិនបានផ្ដាច់ទេ ✅');
  }
  if (data === 'notify_on' || data === 'notify_off') {
    const on = data === 'notify_on';
    await updatePreferences(userId, { notifyDaily: on });
    await answerCallbackQuery(cq.id, 'រួចរាល់');
    return sendMessage(chatId, on ? '🔔 បានបើកការជូនដំណឹងប្រចាំថ្ងៃ' : '🔕 បានបិទការជូនដំណឹងប្រចាំថ្ងៃ');
  }
  return answerCallbackQuery(cq.id, '');
}

// --- command implementations ---

async function cmdConnect(chatId, userId, isPrivate) {
  if (!isPrivate) {
    return sendMessage(
      chatId,
      '🔒 ដើម្បីសុវត្ថិភាព សូមភ្ជាប់ Google Calendar ក្នុង <b>chat ឯកជន</b> ជាមួយ bot ផ្ទាល់ (DM)។'
    );
  }
  // state ចង flow ទៅ telegram user នេះ + expiry 10 នាទី
  const state = createState({ tid: userId });
  const url = buildAuthUrl(state);
  return sendMessage(
    chatId,
    '🔗 ចុចប៊ូតុងខាងក្រោម ដើម្បីភ្ជាប់ Google Calendar របស់អ្នក។\n\n' +
      '• យើងស្នើសុំសិទ្ធិ <b>អានតែប៉ុណ្ណោះ</b> (read-only)។\n' +
      '• Link នេះមានសុពលភាព ១០ នាទី។',
    urlButton('🟢 ភ្ជាប់ Google Calendar', url)
  );
}

async function cmdStatus(chatId, userId) {
  const user = await getUser(userId);
  const tz = user?.timezone || config.defaultTimezone;
  const rm = user?.reminder_minutes ?? config.defaultReminderMinutes;
  if (!user || !user.google_refresh_token) {
    return sendMessage(
      chatId,
      '⚪ មិនទាន់ភ្ជាប់ Google Calendar ទេ។\nវាយ /connect ដើម្បីភ្ជាប់។'
    );
  }
  return sendMessage(
    chatId,
    `🟢 បានភ្ជាប់រួចរាល់\n` +
      `• គណនី៖ <b>${esc(user.google_email || 'unknown')}</b>\n` +
      `• ល្វែងម៉ោង៖ <b>${esc(tz)}</b>\n` +
      `• រំលឹកមុន៖ <b>${rm}</b> នាទី`
  );
}

async function cmdDisconnectPrompt(chatId, userId) {
  const user = await getUser(userId);
  if (!user || !user.google_refresh_token) {
    return sendMessage(chatId, 'អ្នកមិនទាន់បានភ្ជាប់ Google Calendar ទេ។');
  }
  return sendMessage(chatId, 'តើអ្នកប្រាកដជាចង់ផ្ដាច់ Google Calendar មែនទេ?', inlineButtons([
    [
      { text: '✅ បាទ/ចាស ផ្ដាច់', callback_data: 'disconnect_yes' },
      { text: '❌ ទេ', callback_data: 'disconnect_no' },
    ],
  ]));
}

async function cmdRemind(chatId, userId, arg) {
  const minutes = parseInt(arg, 10);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    return sendMessage(chatId, 'ប្រើ៖ <code>/remind &lt;នាទី&gt;</code> (1–1440)។ ឧ. <code>/remind 30</code>');
  }
  await updatePreferences(userId, { reminderMinutes: minutes });
  return sendMessage(chatId, `✅ កំណត់រំលឹកមុនព្រឹត្តិការណ៍ <b>${minutes}</b> នាទី។`);
}

async function cmdTimezone(chatId, userId, arg) {
  if (!arg || !isValidTimezone(arg)) {
    return sendMessage(
      chatId,
      'ប្រើ៖ <code>/timezone &lt;Zone&gt;</code>\nឧ. <code>/timezone Asia/Phnom_Penh</code>'
    );
  }
  await updatePreferences(userId, { timezone: arg });
  return sendMessage(chatId, `✅ កំណត់ល្វែងម៉ោង៖ <b>${esc(arg)}</b>`);
}

async function cmdNotify(chatId, userId) {
  const user = await getUser(userId);
  const on = !user || user.notify_daily !== false;
  return sendMessage(
    chatId,
    `🔔 ការជូនដំណឹងប្រចាំថ្ងៃ (ថ្ងៃសីល / ថ្ងៃឈប់សម្រាក)៖ <b>${on ? 'បើក' : 'បិទ'}</b>`,
    inlineButtons([[{ text: on ? '🔕 បិទ' : '🔔 បើក', callback_data: on ? 'notify_off' : 'notify_on' }]])
  );
}

// /start — help + sponsor footer + user count
async function cmdStart(chatId) {
  let text = helpText();
  try {
    const count = await countUsers();
    text += `\n\n👥 <b>${count}</b> នាក់កំពុងប្រើ`;
    const sponsor = await getSetting('sponsor');
    if (sponsor) text += `\n💎 ${esc(sponsor)}`;
  } catch {
    /* settings table អាចមិនទាន់មាន — រំលង */
  }
  return sendMessage(chatId, text, mainKeyboard());
}

// /admin — admin ប៉ុណ្ណោះ → ប៊ូតុងបើក Mini App
function cmdAdmin(chatId, userId) {
  if (!config.adminId || userId !== config.adminId) {
    return sendMessage(chatId, '🔒 ពាក្យបញ្ជានេះសម្រាប់ admin ប៉ុណ្ណោះ។');
  }
  return sendMessage(chatId, '🛠 បើកផ្ទាំងគ្រប់គ្រង៖', webAppButton('📊 បើក Dashboard', config.adminAppUrl));
}

// /rate — អត្រាប្ដូរប្រាក់ USD
async function cmdRate(chatId) {
  try {
    const result = await getRates();
    return sendMessage(chatId, formatRatesMessage(result));
  } catch (err) {
    console.error('[rate]', err.message);
    return sendMessage(chatId, '⚠️ មិនអាចទាញអត្រាប្ដូរប្រាក់បានទេពេលនេះ។ សូមព្យាយាមម្ដងទៀត។');
  }
}

// /sila — បញ្ជីថ្ងៃសីល ៨ ថ្ងៃខាងមុខ
async function cmdSila(chatId, userId) {
  const user = await getUser(userId);
  const tz = user?.timezone || config.defaultTimezone;
  const found = [];
  for (let i = 0; i < 60 && found.length < 8; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const ymd = ymdInTz(tz, d);
    const label = silaLabel(ymd);
    if (label) {
      const kh = khmerLunar(ymd);
      found.push(`${kh.solar} — <b>${esc(label)}</b>`);
    }
  }
  const body = found.length ? found.join('\n') : 'រកមិនឃើញថ្ងៃសីលក្នុង ៦០ ថ្ងៃខាងមុខទេ។';
  return sendMessage(chatId, `🛕 <b>ថ្ងៃសីល ៨ ថ្ងៃខាងមុខ</b>\n\n${body}`);
}

// /today /week /next
async function cmdAgenda(chatId, userId, kind) {
  const user = await getUser(userId);
  const refresh = getRefreshToken(user);
  const tz = user?.timezone || config.defaultTimezone;
  const now = new Date();

  // ---- window + title ----
  let timeMin, timeMax, maxResults, title;
  if (kind === 'today') {
    const b = dayBounds(tz, now);
    timeMin = b.start;
    timeMax = b.end;
    maxResults = 20;
    const ymd = ymdInTz(tz, now);
    const kh = khmerLunar(ymd);
    const sila = silaLabel(ymd);
    title =
      '📅 <b>កិច្ចការថ្ងៃនេះ</b>\n' +
      `🌙 ${kh.lunar}\n` +
      `☀️ ត្រូវនឹង ${kh.solar}` +
      (sila ? `\n🛕 ថ្ងៃនេះជា <b>ថ្ងៃសីល ${sila}</b>` : '');
  } else if (kind === 'week') {
    timeMin = now.toISOString();
    timeMax = new Date(now.getTime() + 7 * 86400000).toISOString();
    maxResults = 30;
    title = '🗓 ៧ ថ្ងៃខាងមុខ';
  } else {
    timeMin = now.toISOString();
    timeMax = new Date(now.getTime() + 90 * 86400000).toISOString();
    maxResults = 1;
    title = '⏭ ព្រឹត្តិការណ៍បន្ទាប់';
  }

  // ---- fetch: Google (បើភ្ជាប់) ឬ Local (បើមិន) ----
  let events;
  if (refresh) {
    let accessToken;
    try {
      accessToken = await refreshAccessToken(refresh);
    } catch (err) {
      if (err.status === 400) {
        await disconnectUser(userId);
        return sendMessage(chatId, '🔌 ការភ្ជាប់ផុតសុពលភាព។ សូម /connect ម្ដងទៀត។');
      }
      throw err;
    }
    events = await listEvents(accessToken, { timeMin, timeMax, maxResults });
  } else {
    const rows = await listLocalEvents(userId, timeMin, timeMax, maxResults);
    events = rows.map((r) => ({ summary: r.summary, start: { dateTime: r.start_at } }));
  }

  if (!events.length) {
    const hint = refresh ? '' : '\n\n💡 វាយ /new ដើម្បីបន្ថែមព្រឹត្តិការណ៍ (មិនបាច់ភ្ជាប់ Google)';
    return sendMessage(chatId, `${title}\n\nគ្មានព្រឹត្តិការណ៍ទេ ✨${hint}`);
  }

  const lines = events.map((ev) => {
    const when = formatEventTime(ev, tz);
    const loc = ev.location ? `\n   📍 ${esc(ev.location)}` : '';
    return `• <b>${esc(ev.summary || '(គ្មានចំណងជើង)')}</b>\n   🕒 ${esc(when)}${loc}`;
  });
  return sendMessage(chatId, `${title}\n\n${lines.join('\n\n')}`);
}

// --- helpers ---

function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function helpText() {
  return (
    '👋 <b>Bot តាមដាន Google Calendar</b>\n\n' +
    'ខ្ញុំជួយរំលឹក និងបង្ហាញកិច្ចការ/ព្រឹត្តិការណ៍ពី Google Calendar របស់អ្នក។\n\n' +
    '<b>ពាក្យបញ្ជា៖</b>\n' +
    '/connect — ភ្ជាប់ Google Calendar\n' +
    '/new — បង្កើតព្រឹត្តិការណ៍ថ្មី\n' +
    '/today — កិច្ចការថ្ងៃនេះ\n' +
    '/week — ៧ ថ្ងៃខាងមុខ\n' +
    '/next — ព្រឹត្តិការណ៍បន្ទាប់\n' +
    '/remind &lt;នាទី&gt; — កំណត់ពេលរំលឹក (ឧ. /remind 30)\n' +
    '/timezone &lt;Zone&gt; — កំណត់ល្វែងម៉ោង\n' +
    '/notify — បើក/បិទ ការជូនដំណឹងប្រចាំថ្ងៃ (សីល/ឈប់សម្រាក)\n' +
    '/status — ពិនិត្យស្ថានភាពភ្ជាប់\n' +
    '/disconnect — ផ្ដាច់ និងលុប token\n' +
    '/rate — អត្រាប្ដូរប្រាក់ USD ថ្ងៃនេះ\n' +
    '/sila — ថ្ងៃសីល ៨ ថ្ងៃខាងមុខ\n' +
    '/tools — ជំនួយការ Excel & Sheets (AI)\n\n' +
    '🔒 Token ត្រូវ encrypt មុនរក្សាទុក។'
  );
}
