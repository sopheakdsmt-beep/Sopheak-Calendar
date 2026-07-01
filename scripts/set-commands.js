// scripts/set-commands.js
// កំណត់បញ្ជី command ដែលបង្ហាញក្នុងប៊ូតុង "☰ Menu" និង autocomplete "/"។
//   node --env-file=.env scripts/set-commands.js

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ ខ្វះ TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const commands = [
  { command: 'new', description: 'បង្កើតព្រឹត្តិការណ៍ថ្មី' },
  { command: 'today', description: 'កិច្ចការថ្ងៃនេះ' },
  { command: 'week', description: '៧ ថ្ងៃខាងមុខ' },
  { command: 'next', description: 'ព្រឹត្តិការណ៍បន្ទាប់' },
  { command: 'connect', description: 'ភ្ជាប់ Google Calendar' },
  { command: 'status', description: 'ស្ថានភាពភ្ជាប់' },
  { command: 'remind', description: 'កំណត់ពេលរំលឹក (នាទី)' },
  { command: 'timezone', description: 'កំណត់ល្វែងម៉ោង' },
  { command: 'notify', description: 'បើក/បិទ ការជូនដំណឹងប្រចាំថ្ងៃ' },
  { command: 'disconnect', description: 'ផ្ដាច់ Google Calendar' },
  { command: 'rate', description: 'អត្រាប្ដូរប្រាក់ USD ថ្ងៃនេះ' },
  { command: 'sila', description: 'ថ្ងៃសីល ៨ ថ្ងៃខាងមុខ' },
  { command: 'tools', description: 'ជំនួយការ Excel & Sheets (AI)' },
  { command: 'help', description: 'ជំនួយ' },
];

const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ commands }),
});
const json = await res.json();
console.log(json.ok ? '✅ Menu commands set' : `❌ ${json.description}`);
