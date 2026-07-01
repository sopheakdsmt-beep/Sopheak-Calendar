// lib/telegram.js
// Helper តូចៗ ដើម្បីហៅ Telegram Bot API ដោយផ្ទាល់តាម fetch (គ្មាន dependency បន្ថែម)។
// ការមិនប្រើ library ខាងក្រៅ → កាត់បន្ថយ supply-chain risk។

import { config } from './config.js';

const API = () => `https://api.telegram.org/bot${config.botToken}`;

async function call(method, body) {
  const res = await fetch(`${API()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ ok: false }));
  if (!json.ok) {
    // កុំ log token ឬ payload ពេញ — log តែ method + description
    console.error('[telegram]', method, 'failed:', json.description || res.status);
  }
  return json;
}

// Escape សម្រាប់ HTML parse_mode (title/location មកពី user input)
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function sendMessage(chatId, text, extra = {}) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

export function answerCallbackQuery(id, text) {
  return call('answerCallbackQuery', { callback_query_id: id, text: text || '' });
}

// កែ inline keyboard នៃ message ដែលមានស្រាប់ (ឧ. ប្ដូរខែ​ក្នុង​ប្រតិទិន)
export function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  return call('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

// inline keyboard ដែលមានប៊ូតុង URL (ឧ. ភ្ជាប់ Google)
export function urlButton(text, url) {
  return { reply_markup: { inline_keyboard: [[{ text, url }]] } };
}

export function inlineButtons(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

// ប៊ូតុងបើក Telegram Mini App
export function webAppButton(text, url) {
  return { reply_markup: { inline_keyboard: [[{ text, web_app: { url } }]] } };
}

// កែ "About" ខ្លី​របស់ bot (បង្ហាញ​ចំនួន User + sponsor) — max 120 តួ
export function setShortDescription(text) {
  return call('setMyShortDescription', { short_description: String(text).slice(0, 120) });
}

// ផ្ញើរូបភាព (ឧ. sponsor banner) — photo ជា URL ឬ file_id; caption max 1024 តួ
export function sendPhoto(chatId, photo, caption) {
  return call('sendPhoto', {
    chat_id: chatId,
    photo,
    caption: caption ? String(caption).slice(0, 1024) : undefined,
    parse_mode: 'HTML',
  });
}
