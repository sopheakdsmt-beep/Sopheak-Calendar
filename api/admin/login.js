// api/admin/login.js
// ចាប់ផ្ដើមការភ្ជាប់ Google OAuth សម្រាប់ Admin Web Login

import { createState } from '../../lib/state.js';
import { buildAuthUrl } from '../../lib/google.js';

export default function handler(req, res) {
  // បង្កើត state ពិសេសដោយមាន { admin: true } ដើម្បីប្រាប់កន្លែងទទួល (callback) ថាវាជាការ Login របស់ Admin
  const state = createState({ admin: true });
  const url = buildAuthUrl(state);
  res.redirect(url);
}
