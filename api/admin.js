// api/admin.js
// Backend សម្រាប់ Admin Mini App។ រាល់ action ត្រូវផ្ទៀង initData (HMAC) + admin id។
// គ្មាន initData valid ឬ​មិនមែន admin → បដិសេធ (401/403)។

import { validateInitData, isAdmin } from '../lib/webapp.js';
import {
  countUsers,
  listAllUserIds,
  listHolidays,
  addHoliday,
  deleteHoliday,
  getSetting,
  setSetting,
} from '../lib/db.js';
import { sendMessage, setShortDescription } from '../lib/telegram.js';

import { decrypt } from '../lib/crypto.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return res.status(400).json({ error: 'Bad request' });
  }

  let authOk = false;

  // ១. ផ្ទៀងផ្ទាត់តាមរយៈ Telegram initData
  const initData = req.headers['x-telegram-init-data'] || body.initData;
  if (initData) {
    const user = validateInitData(initData);
    if (user && isAdmin(user)) authOk = true;
  }

  // ២. ផ្ទៀងផ្ទាត់តាមរយៈ Web Cookie (Google Admin Login)
  if (!authOk && req.headers.cookie) {
    // ប្រើ regex — split('=') កាត់ token ដែលមាន '=' (base64 padding) ខ្នាតខ្លី
    const m = req.headers.cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
    const token = m ? m[1] : null;
    if (token) {
      try {
        const dec = JSON.parse(decrypt(token));
        if (dec && dec.admin === true) authOk = true;
      } catch (e) {
        // Cookie មិនត្រឹមត្រូវ
      }
    }
  }

  if (!authOk) return res.status(403).json({ error: 'Forbidden' });

  const action = body.action;
  try {
    switch (action) {
      case 'stats': {
        const users = await countUsers();
        const holidays = (await listHolidays(500)).length;
        return res.json({ ok: true, users, holidays });
      }
      case 'listHolidays':
        return res.json({ ok: true, holidays: await listHolidays(500) });
      case 'addHoliday':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') || !body.name) {
          return res.status(400).json({ error: 'invalid' });
        }
        await addHoliday(body.date, String(body.name).slice(0, 200));
        return res.json({ ok: true });
      case 'deleteHoliday':
        await deleteHoliday(body.date);
        return res.json({ ok: true });
      case 'getSponsor':
        return res.json({ ok: true, sponsor: (await getSetting('sponsor')) || '' });
      case 'setSponsor':
        await setSetting('sponsor', String(body.text || '').slice(0, 500));
        await updateAbout();
        return res.json({ ok: true });
      case 'getSponsorConfig':
        return res.json({
          ok: true,
          sponsor: (await getSetting('sponsor')) || '',
          image: (await getSetting('sponsor_image')) || '',
          perWeek: parseInt((await getSetting('sponsor_per_week')) || '2', 10),
        });
      case 'setSponsorConfig': {
        await setSetting('sponsor', String(body.sponsor || '').slice(0, 1000));
        await setSetting('sponsor_image', String(body.image || '').slice(0, 500));
        const pw = Math.max(0, Math.min(14, parseInt(body.perWeek, 10) || 0));
        await setSetting('sponsor_per_week', String(pw));
        await updateAbout();
        return res.json({ ok: true });
      }
      case 'getAppBanner': {
        const val = await getSetting('app_banner');
        return res.json({ ok: true, banner: val ? JSON.parse(val) : null });
      }
      case 'setAppBanner': {
        await setSetting('app_banner', JSON.stringify(body.banner || {}));
        return res.json({ ok: true });
      }
      case 'broadcast': {
        const text = String(body.text || '').trim();
        if (!text) return res.status(400).json({ error: 'empty' });
        const ids = await listAllUserIds();
        let sent = 0;
        for (const id of ids) {
          try {
            const r = await sendMessage(id, text);
            if (r.ok) sent++;
          } catch {
            /* skip blocked users */
          }
          // throttle ~25/វិនាទី (ដែនកំណត់ Telegram)
          if (sent % 25 === 0) await sleep(1000);
        }
        return res.json({ ok: true, sent, total: ids.length });
      }
      default:
        return res.status(400).json({ error: 'unknown action' });
    }
  } catch (err) {
    console.error('[admin]', action, err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

// កែ About ខ្លី៖ "👥 N នាក់ • <sponsor>"
async function updateAbout() {
  try {
    const count = await countUsers();
    const sponsor = (await getSetting('sponsor')) || '';
    const text = sponsor ? `👥 ${count} នាក់ • ${sponsor}` : `👥 ${count} នាក់ប្រើប្រាស់`;
    await setShortDescription(text);
  } catch (e) {
    console.error('[admin] updateAbout:', e.message);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
