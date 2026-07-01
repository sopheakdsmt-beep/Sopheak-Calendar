// api/oauth/callback.js
// Google redirect ត្រឡប់មកទីនេះក្រោយ user authorize។
//
// សុវត្ថិភាព៖
//  - ផ្ទៀងផ្ទាត់ `state` (HMAC signed + expiry) → ការពារ CSRF និងចង flow ទៅ user ត្រឹមត្រូវ។
//  - refresh_token ត្រូវ encrypt មុនរក្សាទុក (ក្នុង saveConnection)។
//  - មិន leak error detail ទៅ browser ឡើយ។

import { verifyState } from '../../lib/state.js';
import { exchangeCode, getUserEmail, refreshAccessToken } from '../../lib/google.js';
import { saveConnection } from '../../lib/db.js';
import { sendMessage } from '../../lib/telegram.js';
import { config } from '../../lib/config.js';
import { encrypt } from '../../lib/crypto.js';

export default async function handler(req, res) {
  const { code, state, error } = req.query || {};

  // user បដិសេធ consent
  if (error) {
    return html(res, 400, 'បានបោះបង់', 'អ្នកបានបដិសេធការអនុញ្ញាត។ អាចត្រឡប់ទៅ Telegram ហើយ /connect ម្ដងទៀត។');
  }
  if (!code || !state) {
    return html(res, 400, 'សំណើមិនត្រឹមត្រូវ', 'ខ្វះ parameter។');
  }

  // ផ្ទៀងផ្ទាត់ state
  const payload = verifyState(state);
  if (!payload || (!payload.tid && !payload.admin)) {
    return html(res, 400, 'Link ផុតសុពលភាព', 'Link ភ្ជាប់ផុតសុពលភាព ឬមិនត្រឹមត្រូវ។ សូមសាកល្បងម្ដងទៀត។');
  }

  // --- Admin Web Login Flow ---
  if (payload.admin) {
    if (!config.adminEmail) {
      return html(res, 403, 'មិនមានសិទ្ធិ', 'ប្រព័ន្ធមិនទាន់បានកំណត់ ADMIN_EMAIL នៅឡើយទេ។');
    }
    try {
      const tokens = await exchangeCode(code);
      const at = tokens.access_token || (await refreshAccessToken(tokens.refresh_token));
      const email = await getUserEmail(at);
      
      if (!email || email.toLowerCase() !== config.adminEmail.toLowerCase()) {
        return html(res, 403, 'មិនមានសិទ្ធិ', 'គណនីរបស់អ្នកគ្មានសិទ្ធិចូលជា Admin ទេ។');
      }

      const tokenStr = encrypt(JSON.stringify({ admin: true, ts: Date.now() }));
      res.setHeader('Set-Cookie', `admin_token=${tokenStr}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`); // 30 days
      res.redirect('/api/dashboard');
      return;
    } catch (err) {
      console.error('[oauth admin] error:', err.message);
      return html(res, 500, 'មានបញ្ហា', 'មិនអាចភ្ជាប់បានទេ។ សូមព្យាយាមម្ដងទៀតពេលក្រោយ។');
    }
  }

  // --- Normal Telegram User Flow ---
  const telegramId = payload.tid;

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      // ករណីកម្រ — Google មិនបញ្ជូន refresh_token
      return html(res, 400, 'ភ្ជាប់មិនបានសម្រេច', 'សូមព្យាយាម /connect ម្ដងទៀត។');
    }

    // យក email ដើម្បីបង្ហាញគណនីណាដែលភ្ជាប់
    let email = null;
    try {
      const at = tokens.access_token || (await refreshAccessToken(tokens.refresh_token));
      email = await getUserEmail(at);
    } catch {
      /* email ជា optional */
    }

    await saveConnection(telegramId, {
      refreshToken: tokens.refresh_token,
      email,
    });

    // ជូនដំណឹងក្នុង Telegram
    await sendMessage(
      telegramId,
      `✅ បានភ្ជាប់ Google Calendar ជោគជ័យ${email ? ` (${email})` : ''}!\n\n` +
        'សាកល្បង /today ឬ /week មើល។ ខ្ញុំនឹងរំលឹកអ្នកមុនព្រឹត្តិការណ៍ដោយស្វ័យប្រវត្តិ។'
    );

    return html(res, 200, 'ភ្ជាប់ជោគជ័យ ✅', 'អ្នកអាចបិទផ្ទាំងនេះ ហើយត្រឡប់ទៅ Telegram។');
  } catch (err) {
    console.error('[oauth] callback error:', err.message);
    return html(res, 500, 'មានបញ្ហា', 'មិនអាចភ្ជាប់បានទេ។ សូមព្យាយាមម្ដងទៀតពេលក្រោយ។');
  }
}

// ផ្ទាំង HTML សាមញ្ញ (គ្មាន secret)
function html(res, status, title, message) {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.status(status).send(`<!doctype html>
<html lang="km"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:system-ui,'Khmer OS',sans-serif;background:#0f172a;color:#e2e8f0;
       display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
  .card{background:#1e293b;border-radius:16px;padding:32px;max-width:420px;text-align:center;
        box-shadow:0 10px 40px rgba(0,0,0,.4)}
  h1{font-size:22px;margin:0 0 12px}
  p{color:#94a3b8;line-height:1.6;margin:0}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`);
}
