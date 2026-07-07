#!/usr/bin/env node
// Social Studio — local GUI hub for every social-content generator.
//
//   yarn social         →  http://127.0.0.1:4747
//
// Zero dependencies (node:http). Spawns the existing CLIs as child processes —
// they stay the single source of truth; this file only adds discovery + a
// pleasant surface. Design: docs/superpowers/specs/2026-07-07-social-studio-design.md
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'out', 'social');
const PORT = Number(process.env.PORT || 4747);

// ---------------------------------------------------------------- recipes ----
const SIZES_ALL = ['1x1', '4x5', '9x16', '16x9', 'og', 'all'];
const METRICS = ['fame', 'strength', 'speed', 'intelligence', 'durability', 'power', 'combat'];
const sel = (flag, label, options, def) => ({ flag, label, type: 'select', options, def });
const txt = (flag, label, placeholder, required = false) => ({ flag, label, type: 'text', placeholder, required });
const num = (flag, label, def) => ({ flag, label, type: 'number', def });

const RECIPES = [
  {
    id: 'week', title: 'Content Week', track: 'ad', emoji: '📅',
    desc: 'A whole week in one click — 7 posts (brand/matchup/ranking mix, rotates weekly) + captions + the visual planner.',
    guide: 'Your Sunday ritual. Then one post a day from the planner.',
    script: 'ads/batch-week.mjs', long: false,
    fields: [sel('--size', 'Size', ['4x5', '9x16'], '4x5')],
    sample: () => latestIn(/^week-/, (d) => firstFile(d, /\.png$/)),
  },
  {
    id: 'ad-brand', title: 'Brand ad', track: 'ad', emoji: '✨',
    desc: 'Six franchise-free brand looks — scale, constellation, powerstats grid, versus, leaderboard, dossier — in any ad ratio.',
    guide: 'IG feed + X · 11:00–13:00 · safe for paid spend.',
    script: 'ads/ad-brand.mjs', long: false,
    fields: [
      sel('--style', 'Style', ['constellation', 'powerstats', 'dossier', 'scale', 'versus', 'leaderboard', 'all'], 'constellation'),
      sel('--size', 'Size', SIZES_ALL, '1x1'),
    ],
    sample: (v) => rel(join('ad-brand', `${v?.['--style'] && v['--style'] !== 'all' ? v['--style'] : 'constellation'}-1x1.png`)),
  },
  {
    id: 'ad-matchup', title: 'Matchup ad', track: 'ad', emoji: '⚔️',
    desc: 'Data-first “who would win” — community vote split + stat tug-of-war. Name plates, no faces: safe for paid.',
    guide: 'IG feed → story with poll sticker · 18:00–20:00.',
    script: 'ads/ad-matchup.mjs', long: false,
    fields: [txt('--matchup', 'Matchup', 'Goku,Superman', true), sel('--size', 'Size', ['1x1', '4x5', '9x16', 'all'], '4x5')],
    sample: () => latestIn(/^ad-matchup-/, (d) => firstFile(d, /\.png$/)),
  },
  {
    id: 'ad-ranking', title: 'Ranking ad', track: 'ad', emoji: '🏆',
    desc: 'Top-N leaderboard on the Mythique fame score or a raw stat — names + rank countdown, no portraits.',
    guide: 'IG feed · 12:00–14:00 · pin a “who got robbed?” comment.',
    script: 'ads/ad-ranking.mjs', long: false,
    fields: [sel('--by', 'Ranked by', METRICS, 'fame'), num('--count', 'Top N', 10), sel('--size', 'Size', SIZES_ALL, '4x5')],
    sample: () => latestIn(/^ad-ranking-/, (d) => firstFile(d, /\.png$/)),
  },
  {
    id: 'ad-web-hero', title: 'Web hero + OG', track: 'ad', emoji: '🌐',
    desc: 'Left-aligned landing hero and the 1200×630 share card for mythique.app.',
    guide: 'Website + link previews — not a feed post.',
    script: 'ads/ad-web-hero.mjs', long: false,
    fields: [sel('--size', 'Size', ['16x9', 'og', 'wide', 'all'], 'all')],
    sample: () => rel(join('ad-web-hero', '16x9.png')),
  },
  {
    id: 'carousels', title: 'Matchup carousel', track: 'organic', emoji: '🃏',
    desc: '4-slide IG carousel with portraits: cover → head-to-head → verdict → fan vote. Payoff on the last slide.',
    guide: 'IG feed carousel · upload slides in order.',
    script: 'generate-carousels.mjs', long: false,
    fields: [txt('--matchup', 'Matchup (blank = auto-pick)', 'Goku,Superman'), num('--count', 'How many', 2)],
    sample: () => latestIn(/-vs-/, (d) => firstFile(join(d, 'carousel'), /^slide-1\.png$/)),
  },
  {
    id: 'bios', title: 'Character file', track: 'organic', emoji: '🗂️',
    desc: 'Rich character-file carousel (up to 8 slides) with portrait, stats, relationships and lore.',
    guide: 'IG feed carousel · great for fandom hashtags.',
    script: 'generate-bios.mjs', long: false,
    fields: [txt('--character', 'Character (blank = auto-pick)', 'Batman'), num('--count', 'How many', 2)],
    sample: () => latestIn(/^bio-/, (d) => firstFile(d, /^slide-1\.png$/)),
  },
  {
    id: 'rankings', title: 'Ranking carousel', track: 'organic', emoji: '📊',
    desc: 'Top-N countdown carousel with portraits — most famous villains, strongest, smartest…',
    guide: 'IG feed carousel · payoff (#1) on the last slide.',
    script: 'generate-rankings.mjs', long: false,
    fields: [
      sel('--alignment', 'Alignment', ['', 'good', 'bad'], ''),
      sel('--by', 'Ranked by', METRICS, 'fame'),
      txt('--publisher', 'Publisher (optional)', 'Marvel'),
      num('--count', 'Top N', 10),
    ],
    sample: () => latestIn(/^ranking-/, (d) => firstFile(d, /^slide-1\.png$/)),
  },
  {
    id: 'reels', title: 'Versus reel (video)', track: 'organic', emoji: '🎬',
    desc: 'Fast-cut 9:16 “who would win” video for TikTok / Reels / Shorts. Silent by design — add a trending sound in-app.',
    guide: 'TikTok + Reels + Shorts · needs ffmpeg · slower to render.',
    script: 'generate-reels.mjs', long: true,
    fields: [txt('--matchup', 'Matchup (blank = auto-pick)', 'Goku,Superman'), num('--count', 'How many', 1)],
    sample: () => null,
  },
];

// ------------------------------------------------------------ fs helpers ----
const rel = (p) => (existsSync(join(OUT, p)) ? p : null);
function latestIn(dirRe, pick) {
  try {
    const dirs = readdirSync(OUT).filter((d) => dirRe.test(d))
      .map((d) => ({ d, t: statSync(join(OUT, d)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const { d } of dirs) { const f = pick(join(OUT, d)); if (f) return f.slice(OUT.length + 1); }
  } catch { /* out/social may not exist yet */ }
  return null;
}
function firstFile(absDir, re) {
  try { const f = readdirSync(absDir).filter((x) => re.test(x)).sort()[0]; return f ? join(absDir, f) : null; }
  catch { return null; }
}
function newFilesSince(t) {
  const found = [];
  const walk = (dir, depth) => {
    let items; try { items = readdirSync(dir); } catch { return; }
    for (const it of items) {
      const p = join(dir, it); let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (depth < 3) walk(p, depth + 1); }
      else if (st.mtimeMs >= t && /\.(png|jpe?g|mp4)$/i.test(it)) found.push(p.slice(OUT.length + 1));
    }
  };
  walk(OUT, 0);
  return found.sort().slice(0, 60);
}
function latestWeek() {
  const dir = latestIn(/^week-/, (d) => (existsSync(join(d, 'week.html')) ? join(d, 'week.html') : null));
  if (!dir) return null;
  const folder = dirname(dir);
  const files = readdirSync(join(OUT, folder)).filter((f) => f.endsWith('.png')).sort();
  return { folder, files };
}

// ------------------------------------------------------------------ jobs ----
let job = null; // { recipeId, log:[], done, code, startedAt, newFiles }
function startJob(recipe, values) {
  const args = [];
  for (const f of recipe.fields) {
    const v = String(values?.[f.flag] ?? '').trim();
    if (v !== '') args.push(f.flag, v);
  }
  job = { recipeId: recipe.id, log: [`$ node scripts/social/${recipe.script} ${args.join(' ')}`], done: false, code: null, startedAt: Date.now(), newFiles: [] };
  const child = execFile(process.execPath, [join(HERE, recipe.script), ...args], { cwd: ROOT, maxBuffer: 1024 * 1024 * 16 });
  const push = (chunk) => { for (const l of String(chunk).split('\n')) if (l.trim()) job.log.push(l); };
  child.stdout.on('data', push);
  child.stderr.on('data', push);
  child.on('close', (code) => { job.done = true; job.code = code; job.newFiles = newFilesSince(job.startedAt); });
}

// ------------------------------------------------------------------ http ----
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.mp4': 'video/mp4' };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(obj)); };
function serveOut(res, relPath) {
  const abs = resolve(OUT, relPath);
  if (!abs.startsWith(OUT + '/') || !existsSync(abs) || statSync(abs).isDirectory()) return json(res, 404, { error: 'not found' });
  res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' }).end(readFileSync(abs));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page()); return; }
  if (url.pathname === '/api/state') {
    const values = {}; // default sample per recipe
    return json(res, 200, {
      recipes: RECIPES.map((r) => ({ ...r, script: undefined, sample: r.sample(values), fields: r.fields })),
      week: latestWeek(),
      busy: !!(job && !job.done),
    });
  }
  if (url.pathname === '/api/generate' && req.method === 'POST') {
    if (job && !job.done) return json(res, 409, { error: 'A generation is already running.' });
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const { id, values } = JSON.parse(body || '{}');
        const recipe = RECIPES.find((r) => r.id === id);
        if (!recipe) return json(res, 400, { error: 'unknown recipe' });
        for (const f of recipe.fields) if (f.required && !String(values?.[f.flag] ?? '').trim()) return json(res, 400, { error: `${f.label} is required.` });
        startJob(recipe, values);
        json(res, 200, { ok: true });
      } catch (e) { json(res, 400, { error: String(e.message || e) }); }
    });
    return;
  }
  if (url.pathname === '/api/log') {
    if (!job) return json(res, 200, { lines: [], done: true, code: 0, newFiles: [] });
    const since = Number(url.searchParams.get('since') || 0);
    return json(res, 200, { lines: job.log.slice(since), total: job.log.length, done: job.done, code: job.code, newFiles: job.done ? job.newFiles : [] });
  }
  if (url.pathname === '/api/open') {
    const p = url.searchParams.get('p') || '';
    const abs = resolve(OUT, p);
    if (!abs.startsWith(OUT)) return json(res, 400, { error: 'bad path' });
    execFile('open', [existsSync(abs) ? abs : OUT]);
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/file') return serveOut(res, url.searchParams.get('p') || '');
  if (url.pathname.startsWith('/week/')) {
    const wk = latestWeek();
    if (!wk) return json(res, 404, { error: 'no week yet' });
    return serveOut(res, join(wk.folder, decodeURIComponent(url.pathname.slice(6))));
  }
  json(res, 404, { error: 'not found' });
});

// ------------------------------------------------------------------ page ----
function page() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mythique — Social Studio</title><style>
:root{--navy:#06121a;--panel:#0f2231;--panel2:#0b1c27;--gold:#e0a83e;--orange:#e8823a;--teal:#4fb3d0;--cream:#f6eddd;--muted:#9db4c4;--line:rgba(246,237,221,.09)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:linear-gradient(#0d1f2b,var(--navy) 42%);min-height:100vh;color:var(--cream);font:15px/1.55 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:30px 22px 90px}
.wrap{max-width:1240px;margin:0 auto}
h1{font-size:23px;font-weight:700}h1 b{color:var(--gold);font-weight:700}
.sub{color:var(--muted);font-size:13px;margin:4px 0 24px}
h2{font-size:15px;font-weight:650;letter-spacing:.12em;color:var(--gold);margin:30px 0 14px;text-transform:uppercase}
.strip{display:flex;gap:12px;align-items:stretch;overflow-x:auto;padding-bottom:6px}
.strip img{height:130px;border-radius:10px;border:1px solid var(--line);display:block}
.strip .none{color:var(--muted);font-size:13.5px;padding:18px;border:1px dashed var(--line);border-radius:12px}
.btn{background:var(--gold);color:#3a2708;border:0;border-radius:9px;padding:9px 16px;font-weight:700;font-size:13.5px;cursor:pointer;white-space:nowrap}
.btn:disabled{opacity:.45;cursor:default}.btn.ghost{background:transparent;color:var(--gold);border:1px solid rgba(224,168,62,.4)}
.btn:active{transform:translateY(1px)}
.weekbar{display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px}
.card{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .15s}
.card:hover{border-color:rgba(224,168,62,.45)}
.card.sel{border-color:var(--gold);box-shadow:0 0 0 1px rgba(224,168,62,.35)}
.thumb{aspect-ratio:16/10;background:radial-gradient(90% 90% at 50% 0%,#13293a,var(--navy));display:flex;align-items:center;justify-content:center;overflow:hidden;border-bottom:1px solid var(--line)}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top}
.thumb .ph{font-size:34px;opacity:.8}
.cb{padding:12px 14px 14px}
.row{display:flex;align-items:center;gap:8px}
.name{font-weight:650;font-size:14.5px}
.badge{margin-left:auto;font-size:10.5px;letter-spacing:.1em;padding:3px 8px;border-radius:99px;white-space:nowrap}
.badge.ad{color:#8fd6a8;border:1px solid rgba(143,214,168,.35)}
.badge.organic{color:var(--teal);border:1px solid rgba(79,179,208,.35)}
.desc{color:var(--muted);font-size:12.5px;margin-top:6px}
.guide{color:var(--cream);font-size:11.5px;margin-top:8px;opacity:.75}
#panel{position:sticky;bottom:0;margin-top:26px;background:linear-gradient(180deg,#122a3c,var(--panel2));border:1px solid rgba(224,168,62,.3);border-radius:16px;padding:18px 20px;display:none;box-shadow:0 -20px 50px -30px rgba(0,0,0,.9)}
#panel.show{display:block}
#panel .head{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}
#panel .head .t{font-weight:700;font-size:16px}
#panel .head .g{color:var(--muted);font-size:12.5px}
.fields{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:11px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
.field input,.field select{background:rgba(0,0,0,.3);border:1px solid var(--line);border-radius:8px;color:var(--cream);padding:8px 10px;font-size:13.5px;min-width:130px}
.field input:focus,.field select:focus{outline:none;border-color:rgba(224,168,62,.5)}
#log{display:none;white-space:pre-wrap;font:11.5px/1.5 ui-monospace,Menlo,monospace;color:var(--muted);background:rgba(0,0,0,.3);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:12px;max-height:180px;overflow:auto}
#results{display:none;margin-top:12px}
#results .imgs{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px}
#results img{height:150px;border-radius:10px;border:1px solid var(--line)}
#results .bar{display:flex;gap:10px;align-items:center;margin-top:10px}
.ok{color:#8fd6a8}.err{color:#ff8f6b}
</style></head><body><div class="wrap">
<h1>mythique<b>.</b> social studio</h1>
<div class="sub">Everything the pipelines can make — pick a recipe, tweak, generate. Ad-safe recipes are franchise-free by construction; organic ones use character art (own accounts only).</div>

<h2>This week</h2>
<div class="weekbar">
  <button class="btn" id="genWeek">Generate content week</button>
  <button class="btn ghost" id="openPlanner" style="display:none">Open planner</button>
  <button class="btn ghost" id="openWeekDir" style="display:none">Open folder</button>
</div>
<div class="strip" id="weekStrip"><div class="none">No week generated yet — one click above makes 7 posts + captions + planner.</div></div>

<h2>Recipes</h2>
<div class="grid" id="grid"></div>

<div id="panel">
  <div class="head"><span id="pEmoji"></span><span class="t" id="pTitle"></span><span class="g" id="pGuide"></span></div>
  <div class="fields" id="pFields"></div>
  <div id="log"></div>
  <div id="results"><div class="imgs" id="rImgs"></div><div class="bar"><span id="rMsg"></span><button class="btn ghost" id="rOpen">Open folder</button></div></div>
</div>
</div><script>
let STATE=null, SEL=null, polling=null;
const $=(id)=>document.getElementById(id);
async function load(){STATE=await (await fetch('/api/state')).json();render();}
function render(){
  const g=$('grid');g.innerHTML='';
  for(const r of STATE.recipes){
    const c=document.createElement('div');c.className='card'+(SEL===r.id?' sel':'');
    c.innerHTML=\`<div class="thumb">\${r.sample?'<img loading="lazy" src="/file?p='+encodeURIComponent(r.sample)+'">':'<div class="ph">'+r.emoji+'</div>'}</div>
      <div class="cb"><div class="row"><span>\${r.emoji}</span><span class="name">\${r.title}</span>
      <span class="badge \${r.track}">\${r.track==='ad'?'AD-SAFE':'ORGANIC'}</span></div>
      <div class="desc">\${r.desc}</div><div class="guide">\${r.guide}</div></div>\`;
    c.onclick=()=>select(r.id);g.appendChild(c);
  }
  const wk=STATE.week, strip=$('weekStrip');
  if(wk){strip.innerHTML=wk.files.map(f=>'<img loading="lazy" title="'+f+'" src="/week/'+encodeURIComponent(f)+'">').join('');
    $('openPlanner').style.display='';$('openWeekDir').style.display='';}
}
function select(id){
  SEL=id;const r=STATE.recipes.find(x=>x.id===id);render();
  $('panel').classList.add('show');$('pEmoji').textContent=r.emoji;$('pTitle').textContent=r.title;$('pGuide').textContent=r.guide;
  const f=$('pFields');f.innerHTML='';
  for(const fd of r.fields){
    const d=document.createElement('div');d.className='field';
    const inp=fd.type==='select'
      ?'<select data-flag="'+fd.flag+'">'+fd.options.map(o=>'<option '+(o===fd.def?'selected':'')+' value="'+o+'">'+(o||'any')+'</option>').join('')+'</select>'
      :'<input data-flag="'+fd.flag+'" type="'+(fd.type==='number'?'number':'text')+'" value="'+(fd.def??'')+'" placeholder="'+(fd.placeholder||'')+'">';
    d.innerHTML='<label>'+fd.label+'</label>'+inp;f.appendChild(d);
  }
  const b=document.createElement('button');b.className='btn';b.id='go';b.textContent=r.long?'Generate (video — takes a while)':'Generate';
  b.onclick=()=>generate(r);f.appendChild(b);
  $('log').style.display='none';$('results').style.display='none';
  $('panel').scrollIntoView({behavior:'smooth',block:'end'});
}
async function generate(r){
  const values={};document.querySelectorAll('#pFields [data-flag]').forEach(el=>values[el.dataset.flag]=el.value);
  const res=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id,values})});
  if(!res.ok){const e=await res.json();alert(e.error||'failed');return;}
  $('go').disabled=true;$('log').style.display='block';$('log').textContent='';$('results').style.display='none';
  let since=0;clearInterval(polling);
  polling=setInterval(async()=>{
    const j=await (await fetch('/api/log?since='+since)).json();
    if(j.lines.length){$('log').textContent+=j.lines.join('\\n')+'\\n';since=j.total;$('log').scrollTop=1e9;}
    if(j.done){clearInterval(polling);$('go').disabled=false;showResults(j);load();}
  },700);
}
function showResults(j){
  $('results').style.display='block';
  $('rMsg').innerHTML=j.code===0?'<span class="ok">Done — '+j.newFiles.length+' file(s)</span>':'<span class="err">Failed (exit '+j.code+') — see log</span>';
  $('rImgs').innerHTML=j.newFiles.filter(f=>/\\.(png|jpe?g)$/i.test(f)).map(f=>'<img title="'+f+'" src="/file?p='+encodeURIComponent(f)+'">').join('');
  $('rOpen').onclick=()=>fetch('/api/open?p='+encodeURIComponent(j.newFiles[0]?j.newFiles[0].split('/')[0]:''));
}
$('genWeek').onclick=()=>{select('week');setTimeout(()=>$('go').click(),50);};
$('openPlanner').onclick=()=>window.open('/week/week.html','_blank');
$('openWeekDir').onclick=()=>fetch('/api/open?p='+encodeURIComponent(STATE.week.folder));
load();
</script></body></html>`;
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Social Studio → http://127.0.0.1:${PORT}`);
});
