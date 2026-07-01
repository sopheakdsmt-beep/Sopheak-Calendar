// lib/webapp.js
// ផ្ទៀងផ្ទាត់ Telegram Mini App initData ដោយ HMAC-SHA256 (តាម spec ផ្លូវការ Telegram)។
// ការពារ៖ មានតែ request ដែលមកពី Telegram WebApp ពិត (ចុះហត្ថលេខាដោយ bot token) ទើបទទួល។
// រួចឆែកថា user.id === ADMIN_TELEGRAM_ID សម្រាប់សិទ្ធិ admin។

import crypto from 'node:crypto';
import { config } from './config.js';

// ត្រឡប់ user object បើ valid; បើមិន valid ត្រឡប់ null
export function validateInitData(initData, maxAgeSec = 86400) {
  if (!initData || typeof initData !== 'string') return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  // data_check_string = key=value បានតម្រៀបតាម alphabet, ភ្ជាប់ដោយ \n
  const pairs = [...params.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`);
  const dataCheckString = pairs.join('\n');

  // secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
  const secret = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  // constant-time compare
  const a = Buffer.from(computed);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // freshness — បដិសេធបើ auth_date ចាស់ពេក (replay protection)
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;

  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

export function isAdmin(user) {
  return !!user && !!config.adminId && Number(user.id) === config.adminId;
}
