// api/terms.js — Terms of Service (តម្រូវ​សម្រាប់ OAuth consent screen)។

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
<title>Terms of Service — ${brand}</title>
<style>
  body{font-family:'Noto Sans Khmer',system-ui,sans-serif;max-width:760px;margin:0 auto;padding:28px 20px 60px;
    color:#222;line-height:1.7;font-size:16px}
  h1{font-size:26px;margin:0 0 6px} h2{font-size:19px;margin:26px 0 8px}
  .upd{color:#777;font-size:14px;margin-bottom:8px} a{color:#1a6fd6}
</style></head>
<body>
<h1>Terms of Service</h1>
<div class="upd">${brand} · Last updated: 22 June 2026</div>

<p>By using ${brand} (the "Service"), a Telegram bot and Mini App that connects to Google Calendar,
you agree to these terms.</p>

<h2>1. Service</h2>
<p>The Service lets you view, get reminders for, and create Google Calendar events via Telegram, and view a
Khmer lunar calendar with Buddhist observance and public-holiday information. Lunar/holiday data is provided
for general reference and may differ from official sources.</p>

<h2>2. Your responsibilities</h2>
<p>You are responsible for your Google account credentials and the content of events you create. Do not use
the Service for unlawful purposes or to abuse Telegram's or Google's platforms.</p>

<h2>3. Availability</h2>
<p>The Service is provided "as is" without warranties. We may modify or discontinue features at any time.</p>

<h2>4. Limitation of liability</h2>
<p>To the maximum extent permitted by law, ${brand} is not liable for any indirect or consequential damages
arising from use of the Service, including missed reminders or calendar errors.</p>

<h2>5. Termination</h2>
<p>You may stop using the Service and remove your data anytime with <code>/disconnect</code>.</p>

<h2>6. Contact</h2>
<p>Email: <a href="mailto:${email}">${email}</a> · Website: <a href="${reankh}" target="_blank" rel="noopener">${reankh}</a></p>
</body></html>`;
