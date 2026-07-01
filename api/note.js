// api/note.js
// Website (Mini App) → បន្ថែម Note/ព្រឹត្តិការណ៍ផ្ទាល់ខ្លួន។
// សុវត្ថិភាព (អាទិភាព)៖
//  - ត្រូវ Telegram initData valid (HMAC) → identify user; web អនាមិកធ្វើមិនបាន (401)
//  - បដិសេធ link/URL ក្នុង note (ការពារ spam/phishing/មេរោគ)
//  - កំណត់ប្រវែង + validate ថ្ងៃ/ម៉ោង
//  - រក្សាក្នុង local_events (ដូច /new); បង្ហាញវិញ esc() ការពារ XSS

import { config } from '../lib/config.js';
import { validateInitData } from '../lib/webapp.js';
import { ensureUser, addLocalEvent } from '../lib/db.js';
import { validateUserText } from '../lib/sanitize.js';
import { tzOffset } from '../lib/datetime.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return res.status(400).json({ error: 'Bad request' });
  }

  // ១. ផ្ទៀង Telegram initData (មិនអនុញ្ញាត web អនាមិក)
  const initData = req.headers['x-telegram-init-data'] || body.initData;
  const user = validateInitData(initData);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Unauthorized', code: 'need_telegram' });
  }

  // ២. validate + បដិសេធ link
  const summary = String(body.summary || '').trim();
  const textErr = validateUserText(summary, { max: 200 });
  if (textErr) return res.status(400).json({ error: textErr, code: 'invalid_text' });

  const date = String(body.date || '');
  const time = String(body.time || '00:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'invalid date' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ error: 'invalid time' });

  const tz = config.defaultTimezone;
  const startDt = new Date(`${date}T${time}:00${tzOffset(tz)}`);
  if (isNaN(startDt.getTime())) return res.status(400).json({ error: 'invalid datetime' });

  try {
    await ensureUser(user.id);
    await addLocalEvent(user.id, summary, startDt.toISOString(), null);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[note]', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

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
