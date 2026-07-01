// lib/db.js
// Supabase client ដោយប្រើ service_role key (server-side តែប៉ុណ្ណោះ)។
// service_role bypass RLS — ដូច្នេះ key នេះមិនត្រូវ expose ទៅ client/browser ឡើយ។
// គ្រប់ table មាន RLS បើក + គ្មាន public policy → គ្មាននរណាចូលដោយ anon key បានទេ។

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { encrypt, decrypt } from './crypto.js';

let client = null;
function db() {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// --- Users ---

export async function getUser(telegramId) {
  const { data, error } = await db()
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// រក្សាទុកការភ្ជាប់ Google (refresh token ត្រូវ encrypt មុនរក្សាទុក)
export async function saveConnection(telegramId, { username, refreshToken, email }) {
  const row = {
    telegram_id: telegramId,
    telegram_username: username || null,
    google_refresh_token: encrypt(refreshToken),
    google_email: email || null,
    connected_at: new Date().toISOString(),
  };
  const { error } = await db()
    .from('users')
    .upsert(row, { onConflict: 'telegram_id' });
  if (error) throw error;
}

// ត្រឡប់ refresh token ដែល decrypt រួច (ឬ null បើមិនបានភ្ជាប់)
export function getRefreshToken(user) {
  if (!user || !user.google_refresh_token) return null;
  return decrypt(user.google_refresh_token);
}

export async function disconnectUser(telegramId) {
  // លុប token ចេញ ប៉ុន្តែរក្សា row ទុក preferences (timezone/reminder)
  const { error } = await db()
    .from('users')
    .update({ google_refresh_token: null, google_email: null, connected_at: null })
    .eq('telegram_id', telegramId);
  if (error) throw error;
}

export async function updatePreferences(telegramId, prefs) {
  const allowed = {};
  if (prefs.reminderMinutes !== undefined) allowed.reminder_minutes = prefs.reminderMinutes;
  if (prefs.timezone !== undefined) allowed.timezone = prefs.timezone;
  if (prefs.notifyDaily !== undefined) allowed.notify_daily = prefs.notifyDaily;
  // upsert ដើម្បីបង្កើត row បើ user មិនទាន់មាន (កំណត់ pref មុនពេលភ្ជាប់)
  const { error } = await db()
    .from('users')
    .upsert({ telegram_id: telegramId, ...allowed }, { onConflict: 'telegram_id' });
  if (error) throw error;
}

// user ទាំងអស់ដែលបានភ្ជាប់ Google (សម្រាប់ cron)
export async function listConnectedUsers() {
  const { data, error } = await db()
    .from('users')
    .select('*')
    .not('google_refresh_token', 'is', null);
  if (error) throw error;
  return data || [];
}

// --- Reminder idempotency ---
// កត់ត្រាថា reminder សម្រាប់ event នេះត្រូវផ្ញើរួចហើយ ដើម្បីកុំផ្ញើស្ទួន។

export async function wasReminderSent(telegramId, eventId, eventStart) {
  const { data, error } = await db()
    .from('reminders_sent')
    .select('id')
    .eq('telegram_id', telegramId)
    .eq('event_id', eventId)
    .eq('event_start', eventStart)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markReminderSent(telegramId, eventId, eventStart) {
  // unique constraint លើ (telegram_id, event_id, event_start) ការពារ duplicate
  const { error } = await db()
    .from('reminders_sent')
    .upsert(
      { telegram_id: telegramId, event_id: eventId, event_start: eventStart },
      { onConflict: 'telegram_id,event_id,event_start', ignoreDuplicates: true }
    );
  if (error) throw error;
}

// --- Event drafts (conversation state សម្រាប់ guided flow បង្កើត event) ---

export async function getDraft(telegramId) {
  const { data, error } = await db()
    .from('event_drafts')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDraft(telegramId, patch) {
  const row = { telegram_id: telegramId, ...patch, updated_at: new Date().toISOString() };
  const { error } = await db()
    .from('event_drafts')
    .upsert(row, { onConflict: 'telegram_id' });
  if (error) throw error;
}

export async function clearDraft(telegramId) {
  const { error } = await db().from('event_drafts').delete().eq('telegram_id', telegramId);
  if (error) throw error;
}

// --- Scheduled reminders (precomputed remind_at rows; cron ផ្ញើនៅពេលដល់) ---

export async function insertScheduledReminders(rows) {
  if (!rows.length) return;
  const { error } = await db().from('scheduled_reminders').insert(rows);
  if (error) throw error;
}

export async function getDueReminders(limit = 100) {
  const { data, error } = await db()
    .from('scheduled_reminders')
    .select('*')
    .eq('sent', false)
    .lte('remind_at', new Date().toISOString())
    .order('remind_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function markScheduledSent(id) {
  const { error } = await db().from('scheduled_reminders').update({ sent: true }).eq('id', id);
  if (error) throw error;
}

// --- Holidays (ថ្ងៃឈប់សម្រាក) ---

export async function getHolidaysInRange(startYmd, endYmd) {
  const { data, error } = await db()
    .from('holidays')
    .select('holiday_date, name')
    .gte('holiday_date', startYmd)
    .lte('holiday_date', endYmd);
  if (error) throw error;
  return data || [];
}

export async function listHolidays(limit = 100) {
  const { data, error } = await db()
    .from('holidays')
    .select('holiday_date, name')
    .order('holiday_date', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function addHoliday(holidayDate, name) {
  const { error } = await db()
    .from('holidays')
    .upsert({ holiday_date: holidayDate, name }, { onConflict: 'holiday_date' });
  if (error) throw error;
}

export async function deleteHoliday(holidayDate) {
  const { error } = await db().from('holidays').delete().eq('holiday_date', holidayDate);
  if (error) throw error;
}

// --- Daily digest idempotency ---

export async function wasDailySent(telegramId, ymd) {
  const { data, error } = await db()
    .from('daily_sent')
    .select('telegram_id')
    .eq('telegram_id', telegramId)
    .eq('sent_date', ymd)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markDailySent(telegramId, ymd) {
  const { error } = await db()
    .from('daily_sent')
    .upsert({ telegram_id: telegramId, sent_date: ymd }, {
      onConflict: 'telegram_id,sent_date',
      ignoreDuplicates: true,
    });
  if (error) throw error;
}

// ចំនួន user សរុប (សម្រាប់ stats / sponsor display)
export async function countUsers() {
  const { count, error } = await db()
    .from('users')
    .select('telegram_id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

// telegram_id ទាំងអស់ (សម្រាប់ broadcast)
export async function listAllUserIds() {
  const { data, error } = await db().from('users').select('telegram_id');
  if (error) throw error;
  return (data || []).map((r) => r.telegram_id);
}

// --- Settings (key/value; ឧ. sponsor message) ---

export async function getSetting(key) {
  const { data, error } = await db()
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

export async function setSetting(key, value) {
  const { error } = await db()
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

// --- Local events (ព្រឹត្តិការណ៍ក្នុង Bot — មិនពឹង Google) ---

// ធានាមាន users row (សម្រាប់ FK) ដោយមិនកែ data ដែលមានស្រាប់
export async function ensureUser(telegramId, username) {
  const row = { telegram_id: telegramId };
  if (username) row.telegram_username = username;
  const { error } = await db()
    .from('users')
    .upsert(row, { onConflict: 'telegram_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function addLocalEvent(telegramId, summary, startIso, reminderKind) {
  const { error } = await db().from('local_events').insert({
    telegram_id: telegramId,
    summary,
    start_at: startIso,
    reminder_kind: reminderKind || null,
  });
  if (error) throw error;
}

export async function listLocalEvents(telegramId, fromIso, toIso, limit = 30) {
  const { data, error } = await db()
    .from('local_events')
    .select('*')
    .eq('telegram_id', telegramId)
    .gte('start_at', fromIso)
    .lte('start_at', toIso)
    .order('start_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// --- Sponsor auto-show (ប្រេកង់កំណត់ពី Admin) ---

// timestamps នៃ sponsor ដែលបានបង្ហាញដល់ user នេះ ក្នុង ៧ ថ្ងៃចុងក្រោយ (ថ្មីៗមុន)
export async function getSponsorShows(telegramId) {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data, error } = await db()
    .from('sponsor_shown')
    .select('shown_at')
    .eq('telegram_id', telegramId)
    .gte('shown_at', weekAgo)
    .order('shown_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => r.shown_at);
}

export async function logSponsorShown(telegramId) {
  const { error } = await db().from('sponsor_shown').insert({ telegram_id: telegramId });
  if (error) throw error;
}
