// lib/google.js
// Google OAuth 2.0 + Calendar API ដោយប្រើ fetch ផ្ទាល់ (គ្មាន SDK ធ្ងន់)។
// Scope = read-only (calendar.events.readonly) → least privilege។

import { config } from './config.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// បង្កើត URL ឲ្យ user ចុច authorize
export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: 'code',
    scope: config.googleScopes.join(' '),
    access_type: 'offline', // ដើម្បីទទួល refresh_token
    prompt: 'consent', // បង្ខំឲ្យផ្តល់ refresh_token គ្រប់ពេល
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// ប្តូរ authorization code → tokens (access + refresh)
export async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

// ប្រើ refresh_token → យក access_token ថ្មី
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    // 400 invalid_grant ជាទូទៅ = user ដក access ឬ token ផុតសុពលភាព
    const err = new Error(`Token refresh failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return json.access_token;
}

export async function getUserEmail(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.email || null;
}

// បង្កើតព្រឹត្តិការណ៍ថ្មី; event = Google Calendar event resource
// ត្រឡប់ event ដែលបង្កើត (មាន id, htmlLink)។ បោះ error ជាមួយ .status បើបរាជ័យ។
export async function createEvent(accessToken, event) {
  const res = await fetch(EVENTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    // 403 = ខ្វះសិទ្ធិសរសេរ (scope readonly ចាស់) → ត្រូវ /connect ម្ដងទៀត
    const err = new Error(`Calendar create failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// list events; opts: { timeMin, timeMax, maxResults }
export async function listEvents(accessToken, opts = {}) {
  const params = new URLSearchParams({
    singleEvents: 'true', // ពន្លាត recurring events
    orderBy: 'startTime',
    maxResults: String(opts.maxResults || 20),
  });
  if (opts.timeMin) params.set('timeMin', opts.timeMin);
  if (opts.timeMax) params.set('timeMax', opts.timeMax);

  const res = await fetch(`${EVENTS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Calendar list failed: ${res.status}`);
  }
  const json = await res.json();
  return json.items || [];
}
