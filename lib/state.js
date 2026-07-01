// lib/state.js
// បង្កើត / ផ្ទៀងផ្ទាត់ OAuth `state` បែប stateless ដោយប្រើ HMAC-SHA256។
// គោលបំណង៖ ចង OAuth flow ទៅនឹង Telegram user ត្រឹមត្រូវ និងការពារ CSRF។
// State មាន expiry ខ្លី (10 នាទី) ដូច្នេះ link ភ្ជាប់ផុតសុពលភាពលឿន។

import crypto from 'node:crypto';
import { config } from './config.js';

const TTL_MS = 10 * 60 * 1000; // 10 នាទី

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function sign(body) {
  return b64url(crypto.createHmac('sha256', config.stateSecret).update(body).digest());
}

// payload ឧ. { tid: <telegram_id> }
export function createState(payload) {
  const data = {
    ...payload,
    exp: Date.now() + TTL_MS,
    n: crypto.randomBytes(8).toString('hex'), // nonce — ការពារ replay/guess
  };
  const body = b64url(Buffer.from(JSON.stringify(data), 'utf8'));
  return `${body}.${sign(body)}`;
}

// ត្រឡប់ payload បើ valid; បើមិន valid ត្រឡប់ null
export function verifyState(state) {
  if (typeof state !== 'string' || !state.includes('.')) return null;
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;

  const expected = sign(body);
  // ប្រៀបធៀបបែប constant-time ការពារ timing attack
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let data;
  try {
    data = JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.exp !== 'number' || Date.now() > data.exp) return null;
  return data;
}
