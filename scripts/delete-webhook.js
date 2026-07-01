// scripts/delete-webhook.js
// លុប webhook (ឧ. ពេលចង់ debug ដោយ polling នៅ local)។
//   node --env-file=.env scripts/delete-webhook.js

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ ខ្វះ TELEGRAM_BOT_TOKEN');
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ drop_pending_updates: false }),
});
const json = await res.json();
console.log(json.ok ? '✅ Webhook deleted' : `❌ ${json.description}`);
