// scripts/gen-secrets.js
// បង្កើត secret ចៃដន្យ (random) សម្រាប់ដាក់ក្នុង Vercel env vars។
// រត់៖  node scripts/gen-secrets.js

import crypto from 'node:crypto';

const b64 = (n) => crypto.randomBytes(n).toString('base64');
const hex = (n) => crypto.randomBytes(n).toString('hex');

console.log('# ចម្លងតម្លៃទាំងនេះទៅ Vercel Environment Variables');
console.log('# (កុំ commit ឡើង GitHub)\n');
console.log(`ENCRYPTION_KEY=${b64(32)}`);        // 32 bytes សម្រាប់ AES-256
console.log(`STATE_SECRET=${hex(32)}`);          // HMAC OAuth state
console.log(`CRON_SECRET=${hex(32)}`);           // ការពារ cron endpoint
console.log(`TELEGRAM_WEBHOOK_SECRET=${hex(24)}`); // header secret token
