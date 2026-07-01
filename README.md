# 📅 Telegram × Google Calendar Bot

Telegram bot ដែលភ្ជាប់ជាមួយ **Google Calendar** របស់ User ម្នាក់ៗ ដើម្បីបង្ហាញ និងរំលឹក
កិច្ចការ/ព្រឹត្តិការណ៍ដោយស្វ័យប្រវត្តិ។ Deploy លើ **Vercel**, ទិន្នន័យលើ **Supabase**។
រចនាដោយ **គិតពីសុវត្ថិភាពជាចម្បង** និងអាច **ចែករំលែកឲ្យគ្រប់គ្នាប្រើ** (multi-user)។

---

## ✨ មុខងារ

- 🔗 `/connect` — User ម្នាក់ៗភ្ជាប់ Google Calendar ផ្ទាល់ខ្លួន (OAuth, **read-only**)
- 📅 `/today` `/week` `/next` — មើលកិច្ចការ on-demand
- 🔔 រំលឹកស្វ័យប្រវត្តិមុនព្រឹត្តិការណ៍ (តាម Vercel Cron)
- ⚙️ `/remind <នាទី>` និង `/timezone <Zone>` — កំណត់តាមចិត្ត User ម្នាក់ៗ
- 🔌 `/disconnect` — ផ្ដាច់ និងលុប token

---

## 🔒 ការរចនាសុវត្ថិភាព

| ហានិភ័យ | ការការពារ |
|---|---|
| គេក្លែង request មក webhook | ផ្ទៀងផ្ទាត់ header `X-Telegram-Bot-Api-Secret-Token` |
| CSRF លើ OAuth flow | `state` ចុះ HMAC-SHA256 + expiry ១០ នាទី (ចង flow ទៅ Telegram user) |
| Token លេចធ្លាយពី DB | refresh token **encrypt AES-256-GCM** មុនរក្សាទុក |
| សិទ្ធិលើស | Google scope = `calendar.events.readonly` (អានតែប៉ុណ្ណោះ) |
| គេ trigger cron | header `Authorization: Bearer <CRON_SECRET>` |
| Supabase leak | RLS បើក + គ្មាន public policy; ប្រើ `service_role` server-side ប៉ុណ្ណោះ |
| Supply-chain | ហៅ Telegram/Google API ដោយ `fetch` ផ្ទាល់ — dependency តែ ១ (`@supabase/supabase-js`) |
| Secrets leak | គ្មាន secret ក្នុង code; `.env` នៅក្នុង `.gitignore` |

---

## 🚀 ការ Setup (ជំហានម្ដងមួយ)

### 1) បង្កើត Bot
1. បើក [@BotFather](https://t.me/BotFather) → `/newbot` → យក **BOT TOKEN**។

### 2) Supabase
1. បង្កើត project នៅ [supabase.com](https://supabase.com)។
2. SQL Editor → paste មាតិកា [`supabase/schema.sql`](supabase/schema.sql) → Run។
3. Settings → API → ចម្លង **Project URL** និង **service_role key**។

### 3) Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com/) → បង្កើត project។
2. **APIs & Services → Library** → បើក **Google Calendar API**។
3. **OAuth consent screen** → External → បំពេញ App name, support email; បន្ថែម scope
   `.../auth/calendar.events.readonly`; ដាក់ខ្លួនអ្នកជា **Test user**។
4. **Credentials → Create OAuth client ID → Web application**:
   - Authorized redirect URI: `https://<your-app>.vercel.app/api/oauth/callback`
   - យក **Client ID** និង **Client secret**។

### 4) បង្កើត Secrets
```bash
npm install
node scripts/gen-secrets.js   # copy តម្លៃ ENCRYPTION_KEY / STATE_SECRET / CRON_SECRET / TELEGRAM_WEBHOOK_SECRET
```

### 5) Deploy លើ Vercel
1. Push code នេះឡើង GitHub។
2. Vercel → New Project → import repo។
3. **Settings → Environment Variables** → បំពេញគ្រប់ key តាម [`.env.example`](.env.example)
   (រួមទាំង `GOOGLE_REDIRECT_URI` = domain ពិតរបស់អ្នក)។
4. Deploy។

### 6) ចុះឈ្មោះ Webhook
```bash
# បង្កើត .env ក្នុង local (ចម្លងពី .env.example) រួច៖
node --env-file=.env scripts/set-webhook.js https://<your-app>.vercel.app
```

### 7) សាកល្បង
បើក bot នៅ Telegram → `/start` → `/connect` → authorize → `/today` 🎉

---

## ⏰ អំពី Reminder (Cron) — សំខាន់

- `vercel.json` កំណត់ cron **១ ដង/ថ្ងៃ** (`0 1 * * *`) ព្រោះ **Vercel Hobby (free)
  អនុញ្ញាត cron តែ ១ ដង/ថ្ងៃ** ប៉ុណ្ណោះ (schedule ញឹកជាងនេះ → deploy បរាជ័យ)។
- ដើម្បីឲ្យ reminder ដំណើរការ **ម៉ោងពិត** សូមជ្រើស **មួយ** ក្នុងចំណោម៖
  1. **Vercel Pro** → ប្ដូរ schedule ត្រឡប់ទៅ `*/15 * * * *`, ឬ
  2. **External cron ឥតគិតថ្លៃ** (ឧ. [cron-job.org](https://cron-job.org), GitHub Actions, UptimeRobot)
     រៀងរាល់ ៥–១៥ នាទី ដែលហៅ៖
     ```
     POST https://<your-app>.vercel.app/api/cron/reminders
     Header: Authorization: Bearer <CRON_SECRET>
     ```
- Logic គឺ idempotent — រត់ញឹកញាប់ក៏មិនផ្ញើ reminder ស្ទួនទេ។

---

## 🌐 ការចែករំលែកឲ្យគ្រប់គ្នា (Google Verification)

scope `calendar.events.readonly` ជា **sensitive scope**៖
- ពេល app នៅ **Testing** → refresh token ផុតក្នុង ៧ ថ្ងៃ និងកំណត់ ១០០ test users។
- ដើម្បីបើកឲ្យ **គ្រប់គ្នា** ប្រើបានយូរ → ត្រូវ **Publish** app និងឆ្លងកាត់
  **Google verification** (សម្រាប់ sensitive scope ជាទូទៅមិនទាមទារ security assessment ធ្ងន់ៗទេ)។

---

## 📁 រចនាសម្ព័ន្ធ

```
api/
  telegram.js          webhook (verify secret header)
  oauth/callback.js    Google OAuth redirect (verify signed state)
  cron/reminders.js    push reminders (verify CRON_SECRET)
lib/
  config.js            env loader + validation
  crypto.js            AES-256-GCM encrypt/decrypt
  state.js             HMAC signed OAuth state
  db.js                Supabase (service_role)
  google.js            OAuth + Calendar (fetch)
  telegram.js          Bot API helpers
  datetime.js          timezone / formatting
  handlers.js          command router
scripts/               gen-secrets, set/delete-webhook
supabase/schema.sql    tables + RLS
```

## 🛣 បន្ថែមនាពេលក្រោយ (ideas)
- Daily morning digest (សង្ខេបកិច្ចការពេលព្រឹក)
- Reminder ច្រើនកម្រិត (ឧ. ១ ថ្ងៃ + ៣០ នាទីមុន)
- ជ្រើស calendar ច្រើន (មិនត្រឹម `primary`)
- ប៊ូតុង inline ប្ដូរ timezone / reminder ដោយមិនវាយ command
- Rate-limit per-user (ការពារ abuse ពេលបើកសាធារណៈ)
