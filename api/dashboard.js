// api/app.js
// បម្រើ Admin Mini App (Telegram Web App) ជា HTML។
// សុវត្ថិភាព៖ UI នេះ​ជា​សាធារណៈ ប៉ុន្តែ​រាល់ action ហៅ /api/admin ដែល​ផ្ទៀង initData + admin id។

export default function handler(req, res) {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.status(200).send(HTML);
}

const HTML = `<!doctype html>
<html lang="km"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Admin Dashboard</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
  :root{ --bg:var(--tg-theme-bg-color,#fff); --text:var(--tg-theme-text-color,#111);
    --hint:var(--tg-theme-hint-color,#888); --card:var(--tg-theme-secondary-bg-color,#f4f4f5);
    --btn:var(--tg-theme-button-color,#2ea6ff); --btnt:var(--tg-theme-button-text-color,#fff);
    --link:var(--tg-theme-link-color,#2ea6ff); }
  *{box-sizing:border-box}
  body{font-family:'Noto Sans Khmer',system-ui,sans-serif;margin:0;background:var(--bg);color:var(--text);
    padding:16px;line-height:1.6;font-size:15px}
  h1{font-size:19px;margin:0 0 4px} h2{font-size:15px;margin:0 0 10px}
  .hint{color:var(--hint);font-size:13px}
  .card{background:var(--card);border-radius:14px;padding:14px;margin:12px 0}
  .stats{display:flex;gap:12px}
  .stat{flex:1;text-align:center} .stat .n{font-size:26px;font-weight:600} .stat .l{color:var(--hint);font-size:13px}
  textarea,input{width:100%;border:none;border-radius:10px;padding:10px;font:inherit;background:var(--bg);
    color:var(--text);outline:none;border:1px solid var(--hint)}
  textarea{min-height:80px;resize:vertical}
  button{background:var(--btn);color:var(--btnt);border:none;border-radius:10px;padding:11px 14px;
    font:inherit;font-weight:500;cursor:pointer;width:100%;margin-top:8px}
  button.sec{background:transparent;color:var(--link);border:1px solid var(--hint);width:auto;padding:6px 12px;margin:0}
  .row{display:flex;gap:8px;align-items:center}
  .hol{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--card)}
  .hol .d{color:var(--hint);font-size:13px}
  .msg{font-size:13px;margin-top:6px;min-height:18px}
  .err{color:#e24b4a}
  #gate{text-align:center;padding:40px 0}
  .hidden{display:none}
</style></head>
<body>
<div id="gate" class="hint">កំពុងផ្ទៀងផ្ទាត់...</div>

<div id="app" class="hidden">
  <h1>🛠 ផ្ទាំងគ្រប់គ្រង</h1>
  <p class="hint">ផ្សាយដំណឹង · ថ្ងៃឈប់សម្រាក · ស្ថិតិ</p>

  <div class="card">
    <div class="stats">
      <div class="stat"><div class="n" id="s-users">–</div><div class="l">👥 អ្នកប្រើ</div></div>
      <div class="stat"><div class="n" id="s-hol">–</div><div class="l">🎉 ថ្ងៃឈប់</div></div>
    </div>
  </div>

  <div class="card">
    <h2>📢 ផ្សាយដំណឹង</h2>
    <textarea id="bc" placeholder="សារផ្ញើទៅអ្នកប្រើទាំងអស់..."></textarea>
    <button id="bc-btn">ផ្ញើទៅអ្នកប្រើទាំងអស់</button>
    <div class="msg" id="bc-msg"></div>
  </div>

  <div class="card">
    <h2>💎 Sponsor / អ្នកឧបត្ថម្ភ</h2>
    <textarea id="sp" placeholder="សារ (ឧ. ដើម្បីឲ្យ App ដំណើរការរលូន សូមអរគុណដល់ ...)"></textarea>
    <input id="sp-img" placeholder="URL រូបភាព (ស្រេចចិត្ត)" style="margin-top:8px">
    <label class="row" style="margin-top:8px;font-size:14px;color:var(--hint)">ចេញ ដង/សប្ដាហ៍៖
      <input type="number" id="sp-pw" min="0" max="14" value="2" style="width:64px;margin-left:8px"> <span class="hint">(0=បិទ)</span>
    </label>
    <button id="sp-btn">រក្សាទុក</button>
    <div class="msg" id="sp-msg"></div>
  </div>

  <div class="card">
    <h2>🖼 ផ្ទាំងពាណិជ្ជកម្ម (App Banner)</h2>
    <input id="ab-name" placeholder="ចំណងជើង (ឧ. Reankh.org)" style="margin-bottom:8px">
    <input id="ab-desc" placeholder="ការពិពណ៌នា (ឧ. សិក្សា · សៀវភៅ...)" style="margin-bottom:8px">
    <input id="ab-btn" placeholder="អក្សរលើប៊ូតុង (ឧ. ចូលទស្សនា →)" style="margin-bottom:8px">
    <input id="ab-url" placeholder="តំណភ្ជាប់ (URL)" style="margin-bottom:8px">
    <label style="display:flex;gap:8px;margin-bottom:8px;align-items:center;font-size:14px;color:var(--hint)">
      <input type="checkbox" id="ab-hide" style="width:auto"> លាក់ផ្ទាំងនេះ
    </label>
    <button id="ab-save">រក្សាទុក</button>
    <div class="msg" id="ab-msg"></div>
  </div>

  <div class="card">
    <h2>🎉 ថ្ងៃឈប់សម្រាក</h2>
    <div class="row"><input type="date" id="h-date"><input id="h-name" placeholder="ឈ្មោះ"></div>
    <button id="h-add">បន្ថែម</button>
    <div class="msg" id="h-msg"></div>
    <div id="h-list" style="margin-top:8px"></div>
  </div>
</div>

<script>
  const tg = window.Telegram?.WebApp;
  tg?.ready(); tg?.expand();
  const initData = tg?.initData || '';

  async function api(action, payload={}){
    const r = await fetch('/api/admin', { method:'POST',
      headers:{ 'content-type':'application/json', 'x-telegram-init-data': initData },
      body: JSON.stringify({ action, ...payload }) });
    if(!r.ok){ const e = await r.json().catch(()=>({})); throw new Error(e.error||('HTTP '+r.status)); }
    return r.json();
  }
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  async function loadStats(){ const d = await api('stats'); $('s-users').textContent=d.users; $('s-hol').textContent=d.holidays; }
  async function loadSponsor(){ const d = await api('getSponsorConfig'); $('sp').value=d.sponsor||''; $('sp-img').value=d.image||''; $('sp-pw').value=(d.perWeek!=null?d.perWeek:2); }
  async function loadAppBanner(){
    const d = await api('getAppBanner');
    if(d.banner){
      $('ab-name').value = d.banner.name || '';
      $('ab-desc').value = d.banner.desc || '';
      $('ab-btn').value = d.banner.btn || '';
      $('ab-url').value = d.banner.url || '';
      $('ab-hide').checked = !!d.banner.hidden;
    }
  }
  async function loadHolidays(){
    const d = await api('listHolidays');
    $('h-list').innerHTML = d.holidays.map(h =>
      '<div class="hol"><div><div>'+esc(h.name)+'</div><div class="d">'+h.holiday_date+'</div></div>'+
      '<button class="sec" data-del="'+h.holiday_date+'">លុប</button></div>').join('') || '<div class="hint">គ្មាន</div>';
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      b.disabled=true; try{ await api('deleteHoliday',{date:b.dataset.del}); await loadHolidays(); }catch(e){ alert(e.message); } });
  }

  $('bc-btn').onclick = async () => {
    const text = $('bc').value.trim(); if(!text) return;
    if(!confirm('ផ្ញើទៅអ្នកប្រើទាំងអស់?')) return;
    $('bc-btn').disabled=true; $('bc-msg').textContent='កំពុងផ្ញើ...';
    try{ const d = await api('broadcast',{text}); $('bc-msg').textContent='✅ ផ្ញើ '+d.sent+'/'+d.total; $('bc').value=''; }
    catch(e){ $('bc-msg').innerHTML='<span class="err">'+esc(e.message)+'</span>'; }
    finally{ $('bc-btn').disabled=false; }
  };
  $('sp-btn').onclick = async () => {
    $('sp-btn').disabled=true; $('sp-msg').textContent='';
    try{ await api('setSponsorConfig',{sponsor:$('sp').value,image:$('sp-img').value.trim(),perWeek:parseInt($('sp-pw').value,10)||0}); $('sp-msg').textContent='✅ រក្សាទុករួច'; }
    catch(e){ $('sp-msg').innerHTML='<span class="err">'+esc(e.message)+'</span>'; }
    finally{ $('sp-btn').disabled=false; }
  };
  $('ab-save').onclick = async () => {
    $('ab-save').disabled=true; $('ab-msg').textContent='';
    const banner = {
      name: $('ab-name').value.trim(),
      desc: $('ab-desc').value.trim(),
      btn: $('ab-btn').value.trim(),
      url: $('ab-url').value.trim(),
      hidden: $('ab-hide').checked
    };
    try{ await api('setAppBanner',{banner}); $('ab-msg').textContent='✅ រក្សាទុករួច'; }
    catch(e){ $('ab-msg').innerHTML='<span class="err">'+esc(e.message)+'</span>'; }
    finally{ $('ab-save').disabled=false; }
  };
  $('h-add').onclick = async () => {
    const date=$('h-date').value, name=$('h-name').value.trim();
    if(!date||!name){ $('h-msg').innerHTML='<span class="err">បំពេញ​ថ្ងៃ​និង​ឈ្មោះ</span>'; return; }
    $('h-add').disabled=true;
    try{ await api('addHoliday',{date,name}); $('h-name').value=''; $('h-msg').textContent='✅ បន្ថែមរួច'; await loadHolidays(); await loadStats(); }
    catch(e){ $('h-msg').innerHTML='<span class="err">'+esc(e.message)+'</span>'; }
    finally{ $('h-add').disabled=false; }
  };

  (async () => {
    try{
      await loadStats();
      $('gate').classList.add('hidden'); $('app').classList.remove('hidden');
      await Promise.all([loadSponsor(), loadAppBanner(), loadHolidays()]);
    }catch(e){
      $('gate').innerHTML = e.message==='Forbidden'
        ? '🔒 មិនមានសិទ្ធិ។ <br><br><a href="/api/admin/login" style="display:inline-block;background:var(--btn);color:var(--btnt);text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600">Login ជាមួយ Google Admin</a>' : '⚠️ ' + esc(e.message);
    }
  })();
</script>
</body></html>`;
