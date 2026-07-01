// lib/crypto.js
// Encrypt / Decrypt សម្រាប់ Google refresh token មុនរក្សាទុកក្នុង database។
// ប្រើ AES-256-GCM (authenticated encryption) — ការពារទាំង confidentiality និង integrity។
// បើ database លេចធ្លាយ token នៅតែ encrypted (defense in depth លើ RLS)។

import crypto from 'node:crypto';
import { config } from './config.js';

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const raw = config.encryptionKey;
  let key;
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex'); // 64 hex chars = 32 bytes
  } else {
    key = Buffer.from(raw, 'base64'); // 44 base64 chars = 32 bytes
  }
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or hex)');
  }
  cachedKey = key;
  return key;
}

// ផ្ដល់ string ការពារ៖ "v1:<iv>:<authTag>:<ciphertext>" (ទាំងអស់ base64)
export function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV សម្រាប់ GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decrypt(payload) {
  const key = getKey();
  const parts = String(payload).split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid ciphertext format');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag); // បើ token ត្រូវបានកែ → final() បោះ error
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
