// api/telegram.js
// Webhook ដែល Telegram ហៅមកនៅពេលមាន update (Vercel serverless function)។
//
// សុវត្ថិភាព៖ ផ្ទៀងផ្ទាត់ header X-Telegram-Bot-Api-Secret-Token មុនដំណើរការ។
// បើ secret មិនត្រូវ → 401 (មានន័យថា request មិនមែនមកពី Telegram)។

import { config } from '../lib/config.js';
import { handleUpdate } from '../lib/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ផ្ទៀងផ្ទាត់ secret token (constant-time-ish ការប្រៀបធៀប string ខ្លី)
  const got = req.headers['x-telegram-bot-api-secret-token'];
  if (got !== config.webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let update;
  try {
    update = await readJson(req);
  } catch {
    return res.status(400).json({ error: 'Bad request' });
  }

  // ដំណើរការ update; តែងតែ ack 200 ឲ្យ Telegram (កុំឲ្យ retry storm)
  // បើ handler បរាជ័យ → log តែឆ្លើយ 200
  try {
    await handleUpdate(update);
  } catch (err) {
    console.error('[webhook] unhandled:', err.message);
  }
  return res.status(200).json({ ok: true });
}

async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    return req.body; // Vercel parse JSON ស្រាប់
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
