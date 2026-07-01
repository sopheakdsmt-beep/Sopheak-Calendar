// scripts/set-webhook.js
// ចុះឈ្មោះ Telegram webhook ទៅ Vercel function ព្រមជាមួយ secret_token។
//
// រត់ (Node 20+ អាចអាន .env ផ្ទាល់)៖
//   node --env-file=.env scripts/set-webhook.js https://<your-app>.vercel.app
//
// ត្រូវការ env៖ TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = process.argv[2];

if (!token || !secret) {
  console.error('❌ ខ្វះ TELEGRAM_BOT_TOKEN ឬ TELEGRAM_WEBHOOK_SECRET');
  process.exit(1);
}
if (!base || !base.startsWith('https://')) {
  console.error('❌ សូមផ្ដល់ base URL: node --env-file=.env scripts/set-webhook.js https://your-app.vercel.app');
  process.exit(1);
}

const url = `${base.replace(/\/$/, '')}/api/telegram`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  }),
});
const json = await res.json();
console.log(json.ok ? `✅ Webhook set → ${url}` : `❌ ${json.description}`);
