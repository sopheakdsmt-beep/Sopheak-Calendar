// api/privacy.js
// Privacy Policy (តម្រូវ​សម្រាប់ Google OAuth verification)។
// រួមមាន Limited Use disclosure តាម Google API Services User Data Policy។

import { config } from '../lib/config.js';

export default function handler(req, res) {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=3600');
  res.status(200).send(page(config.brandName, config.supportEmail, config.reankhUrl));
}

const page = (brand, email, reankh) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — ${brand}</title>
<style>
  body{font-family:'Noto Sans Khmer',system-ui,sans-serif;max-width:760px;margin:0 auto;padding:28px 20px 60px;
    color:#222;line-height:1.7;font-size:16px}
  h1{font-size:26px;margin:0 0 6px} h2{font-size:19px;margin:28px 0 8px}
  .upd{color:#777;font-size:14px;margin-bottom:8px}
  a{color:#1a6fd6} code{background:#f2f2f2;padding:1px 5px;border-radius:4px}
  .note{background:#f6f8fb;border-left:3px solid #1a6fd6;padding:12px 14px;border-radius:0 8px 8px 0;margin:14px 0}
  ul{margin:8px 0 8px 0;padding-left:22px}
</style></head>
<body>
<h1>Privacy Policy</h1>
<div class="upd">${brand} · Last updated: 22 June 2026</div>

<p><b>សេចក្ដីសង្ខេប (ខ្មែរ)៖</b> កម្មវិធីនេះភ្ជាប់ Google Calendar របស់អ្នកដើម្បីបង្ហាញ និងរំលឹកព្រឹត្តិការណ៍
តាម Telegram។ យើងស្នើសុំសិទ្ធិតិចតួចបំផុត រក្សា token ដោយ <b>encrypt</b> ហើយ <b>មិនលក់ ឬចែករំលែក</b>
ទិន្នន័យអ្នកទៅភាគីទីបីឡើយ។ អ្នកអាចលុបការភ្ជាប់គ្រប់ពេលដោយ <code>/disconnect</code>។</p>

<h2>1. Information we collect</h2>
<ul>
  <li><b>Telegram account info:</b> your Telegram user ID and username (to identify you in the bot).</li>
  <li><b>Google account email:</b> to show which Google account is connected.</li>
  <li><b>Google Calendar data:</b> with your consent (scope <code>calendar.events</code>), we read your
    upcoming events to display and remind you, and create events that you explicitly request via the bot.</li>
  <li><b>Preferences:</b> timezone, reminder timing, notification on/off.</li>
</ul>

<h2>2. How we use your information</h2>
<ul>
  <li>To display your calendar events and send you reminders inside Telegram.</li>
  <li>To create calendar events when you ask the bot to.</li>
  <li>To send daily Khmer lunar-calendar / holiday notices (you can disable with <code>/notify</code>).</li>
</ul>

<h2>3. Google user data &amp; Limited Use</h2>
<div class="note">${brand}'s use and transfer to any other app of information received from Google APIs will
adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">Google
API Services User Data Policy</a>, including the <b>Limited Use</b> requirements. We do not use Google
Calendar data for advertising, and we do not transfer or sell it to third parties.</div>

<h2>4. Data storage &amp; security</h2>
<ul>
  <li>Google refresh tokens are <b>encrypted (AES-256-GCM)</b> before storage.</li>
  <li>Data is stored in a private database (Supabase) with Row Level Security; access is server-side only.</li>
  <li>All traffic uses HTTPS. We request the minimum scopes necessary.</li>
</ul>

<h2>5. Data sharing</h2>
<p>We do <b>not</b> sell, rent, or share your personal data or Google data with third parties, except as
required by law. The bot runs on Vercel and stores data in Supabase as our infrastructure providers.</p>

<h2>6. Data retention &amp; deletion</h2>
<p>Send <code>/disconnect</code> in the bot to revoke access and delete your stored Google tokens immediately.
You may also revoke access anytime at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Google Account permissions</a>.
To delete all your data, contact us below.</p>

<h2>7. Contact</h2>
<p>Email: <a href="mailto:${email}">${email}</a><br>Website: <a href="${reankh}" target="_blank" rel="noopener">${reankh}</a></p>
</body></html>`;
