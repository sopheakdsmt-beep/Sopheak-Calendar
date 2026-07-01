// lib/config.js
// ផ្ទុក និងផ្ទៀងផ្ទាត់ environment variables ទាំងអស់នៅកន្លែងតែមួយ។
// មិនមាន secret ណាមួយ hardcode ក្នុង code ឡើយ — ទាំងអស់មកពី Vercel env vars។

function required(name) {
  const v = process.env[name];
  if (!v) {
    // បោះ error ច្បាស់លាស់ ដើម្បីងាយស្រួល debug នៅពេល deploy ខ្វះ env
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const config = {
  // --- Telegram ---
  get botToken() {
    return required('TELEGRAM_BOT_TOKEN');
  },
  // secret token ដែលយើងផ្តល់ឲ្យ Telegram ពេល setWebhook;
  // Telegram បញ្ជូនមកវិញក្នុង header X-Telegram-Bot-Api-Secret-Token
  get webhookSecret() {
    return required('TELEGRAM_WEBHOOK_SECRET');
  },

  // --- Google OAuth ---
  get googleClientId() {
    return required('GOOGLE_CLIENT_ID');
  },
  get googleClientSecret() {
    return required('GOOGLE_CLIENT_SECRET');
  },
  // ឧ. https://<your-app>.vercel.app/api/oauth/callback
  get googleRedirectUri() {
    return required('GOOGLE_REDIRECT_URI');
  },

  // --- Supabase (service_role — server only) ---
  get supabaseUrl() {
    return required('SUPABASE_URL');
  },
  get supabaseServiceKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },

  // --- Secrets សម្រាប់ encryption / signing ---
  get encryptionKey() {
    return required('ENCRYPTION_KEY'); // 32 bytes (base64 ឬ hex)
  },
  get stateSecret() {
    return required('STATE_SECRET'); // HMAC សម្រាប់ OAuth state
  },
  get cronSecret() {
    return required('CRON_SECRET'); // ការពារ endpoint cron
  },

  // --- Admin / Mini App ---
  adminId: process.env.ADMIN_TELEGRAM_ID ? parseInt(process.env.ADMIN_TELEGRAM_ID, 10) : null,
  adminEmail: process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).trim() : null,
  get baseUrl() {
    return process.env.PUBLIC_BASE_URL || this.googleRedirectUri.replace(/\/api\/oauth\/callback$/, '');
  },
  get webAppUrl() {
    return `${this.baseUrl}/api/app`; // public Mini App
  },
  get adminAppUrl() {
    return `${this.baseUrl}/api/dashboard`; // admin-only dashboard
  },
  reankhUrl: process.env.REANKH_URL || 'https://reankh.org',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@reankh.org',
  brandName: process.env.BRAND_NAME || 'Telegram Calendar',

  // --- ការកំណត់ default ---
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Phnom_Penh',
  defaultReminderMinutes: parseInt(process.env.DEFAULT_REMINDER_MINUTES || '30', 10),

  // Google Calendar scope — អាន + សរសេរ events (ត្រូវការ ដើម្បីបង្កើតព្រឹត្តិការណ៍)
  // calendar.events = read/write events; នៅតែជា scope កម្រិត "sensitive" ដដែល
  googleScopes: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};
