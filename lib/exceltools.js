// lib/exceltools.js
// ម៉ឺនុយ "Excel & Sheets" — ជួយ user តាមរយៈការផ្ដល់ prompt ខ្មែររួចរាល់ ដើម្បីចម្លងទៅសួរ
// ChatGPT/Gemini ផ្ទាល់ (bot មិនហៅ AI API ណាមួយទេ — ចៀសវាង cost/key management)។

import { esc } from './telegram.js';

export const EXCELTOOLS = {
  formula_build: {
    label: '🧮 បង្កើតរូបមន្តតាមការពណ៌នា',
    prompt:
      'សូមជួយបង្កើតរូបមន្ត Excel/Google Sheets មួយសម្រាប់ការងារនេះ ជាភាសាខ្មែរងាយយល់៖\n' +
      '[ពិពណ៌នាការងារដែលអ្នកចង់ធ្វើនៅទីនេះ]',
  },
  formula_check: {
    label: '🔍 ពិនិត្យរូបមន្តដុសស្គាល់',
    prompt:
      'សូមពន្យល់ពីដំណើរការរូបមន្ត Excel/Google Sheets នេះម្ដងបំបែកជំហាន ជាភាសាខ្មែរឲ្យខ្ញុំយល់៖\n' +
      '[បិទភ្ជាប់រូបមន្តរបស់អ្នកនៅទីនេះ]',
  },
  formula_error: {
    label: '🩹 ដោះស្រាយរូបមន្ត Error',
    prompt:
      'រូបមន្តរបស់ខ្ញុំក្នុង Excel/Google Sheets បង្ហាញ Error។ សូមជួយរកមូលហេតុ និងកែឲ្យត្រូវ ជាភាសាខ្មែរ៖\n' +
      'រូបមន្ត៖ [បិទភ្ជាប់រូបមន្ត]\n' +
      'សារ Error៖ [បិទភ្ជាប់សារ Error]',
  },
  vlookup_xlookup: {
    label: '🔗 របៀបប្រើ VLOOKUP និង XLOOKUP',
    prompt:
      'សូមបង្រៀនរបៀបប្រើ VLOOKUP និង XLOOKUP ក្នុង Excel/Google Sheets ជាភាសាខ្មែរ ជាមួយឧទាហរណ៍ងាយយល់ សម្រាប់ការងារនេះ៖\n' +
      '[ពិពណ៌នាទិន្នន័យ/ការងាររបស់អ្នក]',
  },
  pivot_table: {
    label: '📊 បង្កើត Pivot Table',
    prompt:
      'សូមបង្ហាញជំហានៗ បង្កើត Pivot Table ក្នុង Excel/Google Sheets ជាភាសាខ្មែរ សម្រាប់វិភាគទិន្នន័យនេះ៖\n' +
      '[ពិពណ៌នាទិន្នន័យ/លទ្ធផលដែលចង់បាន]',
  },
  vba_macro: {
    label: '🧩 បង្កើតកូដ VBA / Macro',
    prompt:
      'សូមសរសេរកូដ VBA/Macro សម្រាប់ Excel ធ្វើការងារនេះ ព្រមទាំងពន្យល់ជាភាសាខ្មែរខ្លីៗពីរបៀបប្រើ៖\n' +
      '[ពិពណ៌នាការងារ]',
  },
  apps_script: {
    label: '⚙️ បង្កើត Google Apps Script',
    prompt:
      'សូមសរសេរ Google Apps Script សម្រាប់ Google Sheets ធ្វើការងារនេះ ព្រមទាំងពន្យល់ជាភាសាខ្មែរខ្លីៗពីរបៀបដំឡើង៖\n' +
      '[ពិពណ៌នាការងារ]',
  },
  conditional_formatting: {
    label: '🎨 Conditional Formatting',
    prompt:
      'សូមបង្ហាញជំហានៗ កំណត់ Conditional Formatting ក្នុង Excel/Google Sheets ជាភាសាខ្មែរ សម្រាប់ល័ក្ខខ័ណ្ឌនេះ៖\n' +
      '[ពិពណ៌នាល័ក្ខខ័ណ្ឌចង់ highlight]',
  },
};

const ORDER = Object.keys(EXCELTOOLS);

export function exceltoolsMenuText() {
  return '📊 <b>Excel & Sheets</b>\n\nជ្រើសប្រធានបទ ដើម្បីទទួល prompt រួចរាល់សម្រាប់សួរ AI:';
}

export function exceltoolsMenuKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        ...ORDER.map((key) => [{ text: EXCELTOOLS[key].label, callback_data: `xl:${key}` }]),
      ],
    },
  };
}

export function exceltoolsDetail(key) {
  const item = EXCELTOOLS[key];
  if (!item) return null;
  const text =
    `${item.label}\n\n` +
    `<pre>${esc(item.prompt)}</pre>\n\n` +
    '👆 ចុចលើអត្ថបទខាងលើដើម្បី copy → បិទភ្ជាប់ក្នុង AI';
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💬 ChatGPT', url: 'https://chat.openai.com/' },
          { text: '⭐ Gemini', url: 'https://gemini.google.com/' },
        ],
        [{ text: '⬅ ត្រឡប់ Excel & Sheets', callback_data: 'xl:menu' }],
      ],
    },
  };
  return { text, keyboard };
}
