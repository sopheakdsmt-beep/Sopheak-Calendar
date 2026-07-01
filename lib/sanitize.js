// lib/sanitize.js
// សុវត្ថិភាព៖ បដិសេធ link/URL ក្នុង text ដែល user បញ្ចូល (note, event title)។
// ការពារ spam/phishing/មេរោគ — អ្នកប្រើមិនអាចបញ្ចូល link ចូលក្នុងព្រឹត្តិការណ៍/note ឡើយ។
// (ការ​បង្ហាញ​ត្រូវ esc() រួច​ដែរ ដើម្បី​ការពារ XSS)។

// URL schemes, www, t.me, @username links, ឬ domain ទូទៅ
const URL_RE =
  /(https?:\/\/|ftp:\/\/|www\.[a-z0-9-]+\.|t\.me\/|telegram\.me\/|@[a-z0-9_]{5,}|\b[a-z0-9][a-z0-9-]*\.(com|net|org|info|biz|io|co|me|app|site|online|store|shop|xyz|top|vip|live|fun|icu|click|link|work|cc|ws|to|ly|gg|tv|ru|tk|ml|ga|cf|gq|in|asia|space|website|tech)\b)/i;

export function containsUrl(text) {
  return URL_RE.test(String(text || ''));
}

// ត្រឡប់ null បើ valid; ត្រឡប់ error message (string) បើមិន valid
export function validateUserText(text, { max = 200 } = {}) {
  const t = String(text || '').trim();
  if (t.length < 1) return 'អត្ថបទទទេ';
  if (t.length > max) return `វែងពេក (អតិបរមា ${max} តួ)`;
  if (containsUrl(t)) return '🔒 មិនអនុញ្ញាតឲ្យដាក់ link/URL ទេ (ដើម្បីសុវត្ថិភាព)';
  return null;
}
