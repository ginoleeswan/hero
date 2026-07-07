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
const FONT = join(ROOT, 'node_modules/@expo-google-fonts/righteous/400Regular/Righteous_400Regular.ttf');
const PORT = Number(process.env.PORT || 4747);

// ---------------------------------------------------------------- recipes ----
const SIZES_ALL = ['1x1', '4x5', '9x16', '16x9', 'og', 'all'];
const METRICS = ['fame', 'strength', 'speed', 'intelligence', 'durability', 'power', 'combat'];
const BRAND_STYLES = ['constellation', 'powerstats', 'dossier', 'scale', 'versus', 'leaderboard'];
const sel = (flag, label, options, def) => ({ flag, label, type: 'select', options, def });
const txt = (flag, label, placeholder, required = false) => ({ flag, label, type: 'text', placeholder, required });
const num = (flag, label, def) => ({ flag, label, type: 'number', def });

const RECIPES = [
  {
    id: 'week', title: 'Content Week', track: 'ad', icon: 'calendar',
    desc: 'A whole week in one click — 7 posts (brand/matchup/ranking mix, rotates weekly) + captions + the visual planner.',
    where: 'your Sunday ritual', when: 'then one post a day',
    how: 'Generate, then work through the day cards — copy the caption, post, tick it off.',
    script: 'ads/batch-week.mjs', long: false,
    fields: [sel('--size', 'Size', ['4x5', '9x16'], '4x5')],
    sample: () => latestIn(/^week-/, (d) => firstFile(d, /\.png$/)),
  },
  {
    id: 'ad-brand', title: 'Brand ad', track: 'ad', icon: 'sparkle',
    desc: 'Six franchise-free brand looks, each built from a real facet of the app — pick a style and the preview follows.',
    where: 'IG feed · X', when: '11:00–13:00',
    how: 'Awareness post — let the image speak; short caption. Safe for paid spend.',
    script: 'ads/ad-brand.mjs', long: false,
    fields: [
      { ...sel('--style', 'Style', [...BRAND_STYLES, 'all'], 'constellation'), thumbs: true },
      sel('--size', 'Size', SIZES_ALL, '1x1'),
    ],
    sample: () => rel(join('ad-brand', 'constellation-1x1.png')),
  },
  {
    id: 'ad-matchup', title: 'Matchup ad', track: 'ad', icon: 'bolt',
    desc: 'Data-first “who would win” — community vote split + stat tug-of-war. Name plates, no faces: safe for paid.',
    where: 'IG feed → story', when: '18:00–20:00',
    how: 'Comment bait — ask the question again as your first comment; 9x16 to story with a poll sticker.',
    script: 'ads/ad-matchup.mjs', long: false,
    fields: [{ ...txt('--matchup', 'Matchup', 'Goku,Superman', true), def: 'Goku,Superman' }, sel('--size', 'Size', ['1x1', '4x5', '9x16', 'all'], '4x5')],
    sample: () => latestIn(/^ad-matchup-/, (d) => firstFile(d, /\.png$/)),
  },
  {
    id: 'ad-ranking', title: 'Ranking ad', track: 'ad', icon: 'trophy',
    desc: 'Top-N leaderboard on the Mythique fame score or a raw stat — names + rank countdown, no portraits.',
    where: 'IG feed', when: '12:00–14:00',
    how: 'Save/share bait — pin a “who got robbed?” comment; great for X quote-posts.',
    script: 'ads/ad-ranking.mjs', long: false,
    fields: [sel('--by', 'Ranked by', METRICS, 'fame'), num('--count', 'Top N', 10), sel('--size', 'Size', SIZES_ALL, '4x5')],
    sample: () => latestIn(/^ad-ranking-/, (d) => firstFile(d, /\.png$/)),
  },
  {
    id: 'ad-web-hero', title: 'Web hero + OG', track: 'ad', icon: 'globe',
    desc: 'Left-aligned landing hero and the 1200×630 share card for mythique.app.',
    where: 'website + link previews', when: 'whenever it changes',
    how: 'Not a feed post — art for the landing page and social link previews.',
    script: 'ads/ad-web-hero.mjs', long: false,
    fields: [sel('--size', 'Size', ['16x9', 'og', 'wide', 'all'], 'all')],
    sample: () => rel(join('ad-web-hero', '16x9.png')),
  },
  {
    id: 'carousels', title: 'Matchup carousel', track: 'organic', icon: 'layers',
    desc: '4-slide IG carousel with portraits: cover → head-to-head → verdict → fan vote. Payoff on the last slide.',
    where: 'IG feed carousel', when: '18:00–20:00',
    how: 'Upload slides in order; the winner is held to the last slide so people swipe.',
    script: 'generate-carousels.mjs', long: false,
    fields: [txt('--matchup', 'Matchup (blank = auto-pick)', 'Goku,Superman'), num('--count', 'How many', 2)],
    sample: () => latestIn(/-vs-/, (d) => firstFile(join(d, 'carousel'), /^slide-1\.png$/)),
  },
  {
    id: 'bios', title: 'Character file', track: 'organic', icon: 'file',
    desc: 'Rich character-file carousel (up to 8 slides) with portrait, stats, relationships and lore.',
    where: 'IG feed carousel', when: '12:00–14:00',
    how: 'Great for fandom hashtags — tag the character’s community.',
    script: 'generate-bios.mjs', long: false,
    fields: [txt('--character', 'Character (blank = auto-pick)', 'Batman'), num('--count', 'How many', 2)],
    sample: () => latestIn(/^bio-/, (d) => firstFile(d, /^slide-1\.png$/)),
  },
  {
    id: 'rankings', title: 'Ranking carousel', track: 'organic', icon: 'chart',
    desc: 'Top-N countdown carousel with portraits — most famous villains, strongest, smartest…',
    where: 'IG feed carousel', when: '12:00–14:00',
    how: 'Countdown to #1 on the last slide; pin a “who got robbed?” comment.',
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
    id: 'reels', title: 'Versus reel', track: 'organic', icon: 'play',
    desc: 'Fast-cut 9:16 “who would win” video for TikTok / Reels / Shorts. Silent by design — add a trending sound in-app.',
    where: 'TikTok · Reels · Shorts', when: '19:00–21:00',
    how: 'Needs ffmpeg and renders slowly. Use a Creator account so trending sounds are available.',
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
  if (url.pathname === '/font.ttf') {
    if (!existsSync(FONT)) return json(res, 404, { error: 'font missing' });
    res.writeHead(200, { 'Content-Type': 'font/ttf', 'Cache-Control': 'max-age=86400' }).end(readFileSync(FONT));
    return;
  }
  if (url.pathname === '/api/state') {
    return json(res, 200, {
      recipes: RECIPES.map((r) => ({ ...r, script: undefined, sample: r.sample(), fields: r.fields })),
      brandSamples: Object.fromEntries(BRAND_STYLES.map((s) => [s, rel(join('ad-brand', `${s}-1x1.png`))])),
      week: latestWeek(),
      busy: !!(job && !job.done),
    });
  }
  if (url.pathname === '/api/generate' && req.method === 'POST') {
    if (job && !job.done) return json(res, 409, { error: 'A generation is already running — wait for it to finish.' });
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
<title>Mythique — Social Studio</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2306121a'/%3E%3Ccircle cx='16' cy='16' r='6.5' fill='none' stroke='%23e0a83e' stroke-width='2.4'/%3E%3C/svg%3E">
<style>
@font-face{font-family:'Righteous';src:url('/font.ttf') format('truetype');font-display:swap}
:root{--navy:#06121a;--navy2:#0a1926;--panel:#0e2130;--panel2:#0b1c27;--gold:#e0a83e;--orange:#e8823a;--teal:#4fb3d0;
  --cream:#f6eddd;--ink:#3a2708;--muted:#93a9ba;--line:rgba(246,237,221,.08);--goldline:rgba(224,168,62,.38);
  --r-s:8px;--r-m:12px;--r-l:16px;--disp:'Righteous',ui-rounded,-apple-system,sans-serif;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
::selection{background:rgba(224,168,62,.35)}
body{background:var(--navy);color:var(--cream);font:14px/1.55 var(--sans);display:flex;overflow:hidden;-webkit-font-smoothing:antialiased}
button{font:inherit}
:focus-visible{outline:2px solid var(--gold);outline-offset:2px;border-radius:4px}
@media(prefers-reduced-motion:no-preference){
  .item,.pill,.tpick,.wcard,.btn,.mini{transition:background .14s,border-color .14s,color .14s,transform .14s,box-shadow .14s}
  .wcard:hover,.tpick:hover{transform:translateY(-2px)}
  #main>*{animation:rise .25s ease both}
  @keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
}
svg.i{width:16px;height:16px;flex:none;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
/* ---------------- sidebar ---------------- */
#side{width:236px;flex:none;background:linear-gradient(180deg,#0c1f2e,var(--navy2));border-right:1px solid var(--line);display:flex;flex-direction:column;padding:24px 14px 18px;overflow-y:auto;position:relative}
#side::before{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,rgba(224,168,62,.07) 1px,transparent 1.5px);background-size:26px 26px;-webkit-mask-image:linear-gradient(#000 30%,transparent 85%);mask-image:linear-gradient(#000 30%,transparent 85%)}
#side>*{position:relative}
.brand{font-family:var(--disp);font-size:21px;letter-spacing:.3px;padding:0 10px}
.brand i{font-style:normal;color:var(--gold)}
.tag{font-size:11px;color:var(--muted);padding:3px 10px 20px;letter-spacing:.02em}
.sec{font-size:10px;letter-spacing:.18em;color:var(--muted);text-transform:uppercase;padding:16px 10px 7px;opacity:.85}
.item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r-s);cursor:pointer;color:var(--cream);font-size:13.5px;border:1px solid transparent;font-weight:500}
.item svg.i{color:var(--muted)}
.item:hover{background:rgba(246,237,221,.05)}
.item.on{background:rgba(224,168,62,.1);border-color:var(--goldline);color:var(--gold)}
.item.on svg.i{color:var(--gold)}
.sfoot{margin-top:auto;padding:18px 10px 0;font-size:10.5px;line-height:1.6;color:var(--muted);opacity:.7}
/* ---------------- main ---------------- */
#main{flex:1;overflow-y:auto;background:radial-gradient(80% 34% at 60% -8%,#132a3b,var(--navy) 60%)}
.page{max-width:1180px;margin:0 auto;padding:34px 40px 80px}
.crumb{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;display:flex;align-items:center;gap:8px}
.crumb b{color:var(--gold);font-weight:600}
.viewhead{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px}
.viewhead h1{font-family:var(--disp);font-size:26px;font-weight:400;letter-spacing:.3px}
.badge{font-size:9.5px;letter-spacing:.14em;padding:4px 10px;border-radius:99px;white-space:nowrap;font-weight:700;transform:translateY(-2px)}
.badge.ad{color:#8fd6a8;border:1px solid rgba(143,214,168,.4);background:rgba(143,214,168,.06)}
.badge.organic{color:var(--teal);border:1px solid rgba(79,179,208,.4);background:rgba(79,179,208,.06)}
.desc{color:var(--muted);max-width:64ch;font-size:14.5px}
.meta{display:flex;gap:18px;flex-wrap:wrap;align-items:center;margin:16px 0 6px;font-size:12.5px;color:var(--muted)}
.meta .m{display:flex;align-items:center;gap:7px}
.meta .m b{color:var(--cream);font-weight:600}
.meta svg.i{width:14px;height:14px;color:var(--gold)}
.playbook{border-left:2px solid var(--goldline);padding:2px 0 2px 14px;margin:14px 0 26px;color:var(--muted);font-size:13px;max-width:60ch}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;background:var(--gold);color:var(--ink);border:0;border-radius:10px;padding:11px 22px;font-weight:700;font-size:13.5px;cursor:pointer;white-space:nowrap;box-shadow:0 6px 18px -8px rgba(224,168,62,.55)}
.btn:hover{filter:brightness(1.06)}
.btn:disabled{opacity:.4;cursor:default;box-shadow:none}
.btn.ghost{background:transparent;color:var(--gold);border:1px solid var(--goldline);box-shadow:none}
.btn.ghost:hover{background:rgba(224,168,62,.08)}
.btn:active{transform:translateY(1px)}
.spin{width:14px;height:14px;border:2px solid rgba(58,39,8,.35);border-top-color:var(--ink);border-radius:50%;animation:sp .7s linear infinite}
.ghost .spin{border-color:rgba(224,168,62,.3);border-top-color:var(--gold)}
@keyframes sp{to{transform:rotate(1turn)}}
.banner{display:none;align-items:center;gap:10px;background:rgba(224,168,62,.07);border:1px solid var(--goldline);color:var(--gold);border-radius:var(--r-m);padding:10px 15px;font-size:12.5px;margin:0 0 18px}
/* ---------------- week ---------------- */
.weekbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:20px 0 26px}
.wgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:18px}
.wcard{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:var(--r-l);overflow:hidden;display:flex;flex-direction:column;box-shadow:0 14px 34px -22px rgba(0,0,0,.85)}
.wcard:hover{border-color:rgba(224,168,62,.25)}
.wcard.is-done{opacity:.38;filter:saturate(.6)}
.wthumb{aspect-ratio:4/5;background:#040c12;position:relative}
.wthumb img{width:100%;height:100%;object-fit:contain;display:block;cursor:zoom-in}
.day{font-size:10px;letter-spacing:.16em;font-weight:700;color:var(--gold);border:1px solid var(--goldline);border-radius:6px;padding:2px 7px;flex:none}
.wb{padding:12px 14px 14px;display:flex;flex-direction:column;gap:9px}
.wname{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wmeta{font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:6px}
.wmeta svg.i{width:12.5px;height:12.5px;color:var(--gold);opacity:.8}
.wacts{display:flex;gap:8px;align-items:center}
.mini{display:inline-flex;align-items:center;gap:6px;background:transparent;color:var(--gold);border:1px solid var(--goldline);border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer}
.mini:hover{background:rgba(224,168,62,.08)}
.mini svg.i{width:12.5px;height:12.5px}
.pchk{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--muted);border:1px solid var(--line);border-radius:99px;padding:5px 12px;cursor:pointer;user-select:none}
.pchk input{display:none}
.pchk.on{color:#8fd6a8;border-color:rgba(143,214,168,.45);background:rgba(143,214,168,.07)}
.empty{border:1px dashed rgba(246,237,221,.18);border-radius:var(--r-l);padding:52px 30px;text-align:center;color:var(--muted)}
.empty .big{font-family:var(--disp);font-size:17px;color:var(--cream);margin-bottom:6px}
/* ---------------- recipe ---------------- */
.duo{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(310px,.95fr);gap:30px;align-items:start;margin-top:4px}
@media(max-width:1000px){.duo{grid-template-columns:1fr}}
.stage{background:#040c12;border:1px solid var(--line);border-radius:var(--r-l);overflow:hidden;box-shadow:0 20px 44px -26px rgba(0,0,0,.9)}
.stage .art{display:flex;align-items:center;justify-content:center;padding:22px;min-height:220px}
.stage img{max-width:100%;max-height:56vh;object-fit:contain;display:block;border-radius:6px}
.stage .cap{display:flex;align-items:center;gap:8px;border-top:1px solid var(--line);padding:9px 16px;font-size:11px;letter-spacing:.06em;color:var(--muted)}
.stage .cap b{color:var(--gold);font-weight:600}
.stage .ph{color:var(--muted);text-align:center;padding:70px 20px}
.stage .ph svg.i{width:30px;height:30px;margin-bottom:10px;color:var(--muted)}
.controls{display:flex;flex-direction:column;gap:20px}
.f label{display:block;font-size:10.5px;letter-spacing:.16em;color:var(--muted);text-transform:uppercase;margin-bottom:9px;font-weight:600}
.pills{display:flex;gap:7px;flex-wrap:wrap}
.pill{border:1px solid var(--line);background:rgba(246,237,221,.035);color:var(--muted);border-radius:99px;padding:6px 15px;font-size:12.5px;cursor:pointer}
.pill:hover{border-color:rgba(224,168,62,.3);color:var(--cream)}
.pill.on{border-color:var(--gold);color:var(--gold);background:rgba(224,168,62,.1);font-weight:600}
.thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.tpick{border:1px solid var(--line);border-radius:var(--r-m);overflow:hidden;cursor:pointer;background:#040c12;position:relative}
.tpick img{width:100%;aspect-ratio:1;object-fit:cover;object-position:top;display:block;opacity:.9}
.tpick .tl{position:absolute;left:0;right:0;bottom:0;font-size:10px;letter-spacing:.08em;text-align:center;padding:4px 2px;background:rgba(4,12,18,.85);color:var(--muted)}
.tpick.on{border-color:var(--gold);box-shadow:0 0 0 1px var(--goldline)}
.tpick.on .tl{color:var(--gold);font-weight:700}
.lbl-row{display:flex;align-items:baseline;justify-content:space-between}
.linky{font-size:11px;color:var(--muted);cursor:pointer;border-bottom:1px dotted var(--muted)}
.linky.on{color:var(--gold);border-color:var(--gold)}
.f input{background:rgba(0,0,0,.32);border:1px solid var(--line);border-radius:10px;color:var(--cream);padding:10px 13px;font-size:13.5px;width:100%}
.f input::placeholder{color:rgba(147,169,186,.5)}
.f input:focus{outline:none;border-color:var(--goldline);box-shadow:0 0 0 3px rgba(224,168,62,.08)}
.gwrap{margin-top:4px}
.gwrap .btn{width:100%;padding:13px}
.gnote{font-size:11px;color:var(--muted);text-align:center;margin-top:8px;opacity:.8}
/* ---------------- activity ---------------- */
#activity{display:none;margin-top:30px}
#activity .ahead{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px}
#log{white-space:pre-wrap;font:11.5px/1.55 ui-monospace,Menlo,monospace;color:var(--muted);background:rgba(0,0,0,.34);border:1px solid var(--line);border-radius:var(--r-m);padding:12px 14px;max-height:190px;overflow:auto}
#results{display:none;margin-top:18px}
#results .imgs{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 8px}
#results img{height:200px;border-radius:var(--r-m);border:1px solid var(--line);cursor:zoom-in}
#results img:hover{border-color:var(--goldline)}
#results .bar{display:flex;gap:14px;align-items:center;margin-top:12px}
.ok{color:#8fd6a8;font-weight:600}.err{color:#ff8f6b;font-weight:600}
</style></head><body>
<nav id="side">
  <div class="brand">mythique<i>.</i> studio</div>
  <div class="tag">social content, one click at a time</div>
  <div id="nav"></div>
  <div class="sfoot">Local only — nothing leaves this machine.<br><br>Ad-safe = franchise-free, OK for paid.<br>Organic = character art, own accounts.</div>
</nav>
<main id="main"><div class="page" id="pg"></div></main>
<script>
const ICONS={
 calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
 sparkle:'<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6-5.6-1.9 5.6-1.9z"/>',
 bolt:'<path d="M13 2.5L4.5 14H10l-1 7.5L17.5 10H12z"/>',
 trophy:'<path d="M8 4h8v5.5a4 4 0 01-8 0z"/><path d="M8 5.5H5a3 3 0 003.2 4M16 5.5h3a3 3 0 01-3.2 4M12 13.5V17M8.5 20h7M10 17h4"/>',
 globe:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.8 3.2 2.8 13.8 0 17-2.8-3.2-2.8-13.8 0-17z"/>',
 layers:'<rect x="4" y="7" width="12.5" height="13" rx="2"/><path d="M8 4.5h10a2 2 0 012 2V17"/>',
 file:'<path d="M4.5 7a2 2 0 012-2h4l1.8 2h7.2v11a2 2 0 01-2 2h-11a2 2 0 01-2-2z"/>',
 chart:'<path d="M5 20v-8M12 20V5M19 20v-5"/>',
 play:'<rect x="4" y="4.5" width="16" height="15" rx="2.5"/><path d="M10.5 9.5l4.5 2.5-4.5 2.5z"/>',
 pin:'<path d="M12 21s-6.2-5.7-6.2-10.2a6.2 6.2 0 1112.4 0C18.2 15.3 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.1"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.8l3 1.8"/>',
 open:'<path d="M13.5 5H19v5.5M19 5l-8.5 8.5M19 13.5V18a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2h4.5"/>',
 copy:'<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5.5 15.5h-1a2 2 0 01-2-2v-9a2 2 0 012-2h9a2 2 0 012 2v1"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>'};
const I=(n,cls='i')=>'<svg class="'+cls+'" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[n]||ICONS.sparkle)+'</svg>';
let STATE=null, VIEW=location.hash.slice(1)||'week', VALUES={}, polling=null;
const $=(s,el=document)=>el.querySelector(s);
const esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const KIND_META={brand:{where:'IG feed · X',when:'11:00–13:00'},matchup:{where:'IG → story + poll',when:'18:00–20:00'},ranking:{where:'IG feed',when:'12:00–14:00'}};

async function load(){STATE=await (await fetch('/api/state')).json();render();}
function nav(to){VIEW=to;location.hash=to;VALUES={};render();$('#main').scrollTop=0;}
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(h&&h!==VIEW){VIEW=h;VALUES={};render();}});

function render(){renderNav();VIEW==='week'?renderWeek():renderRecipe();}
function renderNav(){
  const groups=[['This week',['week']],['Ad-safe',['ad-brand','ad-matchup','ad-ranking','ad-web-hero']],['Organic',['carousels','bios','rankings','reels']]];
  $('#nav').innerHTML=groups.map(([t,ids])=>'<div class="sec">'+t+'</div>'+ids.map(id=>{
    const r=STATE.recipes.find(x=>x.id===id);
    return '<div class="item'+(VIEW===(id==='week'?'week':id)?' on':'')+'" onclick="nav(\\''+(id==='week'?'week':id)+'\\')">'+I(r.icon)+' '+r.title+'</div>';
  }).join('')).join('');
}
const activity='<div id="activity"><div class="ahead" id="ahead">'+'Activity'+'</div><div id="log"></div><div id="results"><div class="imgs" id="rImgs"></div><div class="bar"><span id="rMsg"></span><button class="btn ghost" id="rOpen">'+I('open')+' Open folder</button></div></div></div>';
function busyBanner(){return '<div class="banner" id="busy" style="'+(STATE.busy?'display:flex':'')+'"><span class="spin" style="border-color:rgba(224,168,62,.3);border-top-color:var(--gold)"></span> A generation is running — controls unlock when it finishes.</div>';}

function renderWeek(){
  const wk=STATE.week;
  let cards;
  if(!wk){cards='<div class="empty"><div class="big">No content week yet</div>One click makes 7 posts + captions + a plan for the week.</div>';}
  else{
    cards='<div class="wgrid">'+wk.files.map(f=>{
      const base=f.replace(/\\.png$/,'');
      const m=base.match(/^\\d+-(\\w+)-(\\w+?)-(.+)$/)||[];
      const day=(m[1]||'').toUpperCase(), kind=m[2]||'', name=(m[3]||base).replace(/-/g,' ');
      const g=KIND_META[kind]||{where:'',when:''};
      return '<div class="wcard" data-id="'+base+'"><div class="wthumb"><img loading="lazy" src="/week/'+encodeURIComponent(f)+'" onclick="window.open(this.src)"></div>'+
        '<div class="wb"><div style="display:flex;align-items:center;gap:9px"><span class="day">'+day+'</span><div class="wname">'+esc(name)+'</div></div>'+
        (g.where?'<div class="wmeta">'+I('pin')+' '+g.where+' · '+g.when+'</div>':'')+
        '<div class="wacts"><button class="mini" onclick="copyCaption(\\''+base+'\\',this)">'+I('copy')+' Caption</button>'+
        '<label class="pchk"><input type="checkbox" class="posted"><span>posted</span></label></div></div></div>';
    }).join('')+'</div>';
  }
  $('#pg').innerHTML='<div class="crumb">Studio <b>›</b> This week'+(wk?' <b>›</b> '+wk.folder:'')+'</div>'+
    '<div class="viewhead"><h1>This week</h1></div>'+
    '<div class="desc">Generate once, then post one card a day — copy the caption, post it, tick it off. Ticks stay in sync with the planner.</div>'+
    '<div class="weekbar">'+busyBanner()+'<button class="btn" id="genWeek" '+(STATE.busy?'disabled':'')+'>'+I('calendar')+' Generate content week</button>'+
    (wk?'<button class="btn ghost" onclick="window.open(\\'/week/week.html\\')">'+I('open')+' Planner</button>'+
        '<button class="btn ghost" onclick="fetch(\\'/api/open?p=\\'+encodeURIComponent(STATE.week.folder))">'+I('file')+' Folder</button>':'')+
    '</div>'+cards+activity;
  $('#genWeek').onclick=()=>runRecipe('week',{'--size':'4x5'});
  document.querySelectorAll('.wcard').forEach(card=>{
    const id='mq-'+card.dataset.id, box=$('input.posted',card), lab=$('.pchk',card);
    const sync=()=>{card.classList.toggle('is-done',box.checked);lab.classList.toggle('on',box.checked);lab.querySelector('span').textContent=box.checked?'posted ✓':'posted';};
    box.checked=localStorage.getItem(id)==='1';sync();
    box.addEventListener('change',()=>{localStorage.setItem(id,box.checked?'1':'0');sync();});
  });
}
async function copyCaption(base,btn){
  try{const t=await (await fetch('/week/'+encodeURIComponent(base)+'.caption.txt')).text();
    await navigator.clipboard.writeText(t);btn.innerHTML=I('check')+' Copied';}
  catch{btn.textContent='No caption';}
  setTimeout(()=>btn.innerHTML=I('copy')+' Caption',1300);
}

function renderRecipe(){
  const r=STATE.recipes.find(x=>x.id===VIEW);
  if(!r){nav('week');return;}
  for(const f of r.fields) if(!(f.flag in VALUES)) VALUES[f.flag]=f.def??'';
  const fields=r.fields.map(f=>{
    if(f.thumbs){
      return '<div class="f"><div class="lbl-row"><label>'+f.label+'</label><span class="linky '+(VALUES[f.flag]==='all'?'on':'')+'" onclick="setVal(\\''+f.flag+'\\',\\'all\\')">generate all six</span></div><div class="thumbs">'+f.options.filter(o=>o!=='all').map(o=>{
        const s=STATE.brandSamples[o];
        return '<div class="tpick'+(VALUES[f.flag]===o?' on':'')+'" onclick="setVal(\\''+f.flag+'\\',\\''+o+'\\')">'+
          (s?'<img src="/file?p='+encodeURIComponent(s)+'">':'<div style="aspect-ratio:1"></div>')+'<div class="tl">'+o+'</div></div>';
      }).join('')+'</div></div>';
    }
    if(f.type==='select'){
      return '<div class="f"><label>'+f.label+'</label><div class="pills">'+f.options.map(o=>
        '<span class="pill'+(String(VALUES[f.flag])===o?' on':'')+'" onclick="setVal(\\''+f.flag+'\\',\\''+o+'\\')">'+(o||'any')+'</span>').join('')+'</div></div>';
    }
    return '<div class="f"><label>'+f.label+(f.required?' *':'')+'</label><input data-flag="'+f.flag+'" type="'+(f.type==='number'?'number':'text')+'" value="'+esc(VALUES[f.flag])+'" placeholder="'+(f.placeholder||'')+'" oninput="VALUES[this.dataset.flag]=this.value"></div>';
  }).join('');
  const style=VALUES['--style'];
  const preview=(r.id==='ad-brand'&&style&&style!=='all'&&STATE.brandSamples[style])?STATE.brandSamples[style]:r.sample;
  const capLabel=r.id==='ad-brand'&&style&&style!=='all'?style:'latest render';
  $('#pg').innerHTML='<div class="crumb">Studio <b>›</b> '+(r.track==='ad'?'Ad-safe':'Organic')+' <b>›</b> '+r.title+'</div>'+
    '<div class="viewhead"><h1>'+r.title+'</h1><span class="badge '+r.track+'">'+(r.track==='ad'?'AD-SAFE':'ORGANIC')+'</span></div>'+
    '<div class="desc">'+r.desc+'</div>'+
    '<div class="meta"><span class="m">'+I('pin')+' <b>'+r.where+'</b></span><span class="m">'+I('clock')+' '+r.when+'</span></div>'+
    '<div class="playbook">'+r.how+'</div>'+
    busyBanner()+
    '<div class="duo"><div class="stage"><div class="art">'+(preview?'<img src="/file?p='+encodeURIComponent(preview)+'">':'<div class="ph">'+I(r.icon)+'<br>No sample yet — your first generation will appear here.</div>')+'</div>'+
    (preview?'<div class="cap">'+I(r.icon)+' <b>'+capLabel+'</b> · preview — yours will use the options on the right</div>':'')+'</div>'+
    '<div class="controls">'+fields+
    '<div class="gwrap"><button class="btn" id="go" '+(STATE.busy?'disabled':'')+'>'+I(r.icon)+' '+(r.long?'Generate video':'Generate')+'</button>'+
    '<div class="gnote">'+(r.long?'Video renders take a few minutes.':'Roughly 8–10 seconds per image.')+'</div></div></div></div>'+activity;
  $('#go').onclick=()=>runRecipe(r.id,VALUES);
}
function setVal(flag,v){VALUES[flag]=v;renderRecipe();}

async function runRecipe(id,values){
  const res=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,values})});
  const act=$('#activity');
  if(!res.ok){const e=await res.json();act.style.display='block';$('#log').textContent='✗ '+(e.error||'failed');return;}
  STATE.busy=true;
  const go=$('#go')||$('#genWeek');
  if(go){go.disabled=true;go.innerHTML='<span class="spin"></span> Generating…';}
  act.style.display='block';$('#ahead').innerHTML='<span class="spin" style="border-color:rgba(147,169,186,.3);border-top-color:var(--muted)"></span> Running';
  $('#log').textContent='';$('#results').style.display='none';
  let since=0,fullLog='';clearInterval(polling);
  polling=setInterval(async()=>{
    const j=await (await fetch('/api/log?since='+since)).json();
    if(j.lines.length){fullLog+=j.lines.join('\\n')+'\\n';$('#log').textContent=fullLog;since=j.total;$('#log').scrollTop=1e9;}
    if(j.done){clearInterval(polling);showResults(j,fullLog);}
  },700);
}
async function showResults(j,fullLog){
  // refresh state FIRST (new samples, week strip), re-render, then paint the
  // outcome into the fresh DOM — otherwise the re-render wipes it.
  STATE=await (await fetch('/api/state')).json();
  render();
  $('#activity').style.display='block';
  $('#ahead').textContent='Activity';
  $('#log').textContent=fullLog;
  $('#results').style.display='block';
  $('#rMsg').innerHTML=j.code===0?'<span class="ok">Done — '+j.newFiles.length+' file(s)</span>':'<span class="err">Failed (exit '+j.code+') — see log</span>';
  $('#rImgs').innerHTML=j.newFiles.filter(f=>/\\.(png|jpe?g)$/i.test(f)).map(f=>'<img title="'+f+'" src="/file?p='+encodeURIComponent(f)+'" onclick="window.open(this.src)">').join('');
  const open=$('#rOpen');if(open)open.onclick=()=>fetch('/api/open?p='+encodeURIComponent(j.newFiles[0]?j.newFiles[0].split('/')[0]:''));
  $('#activity').scrollIntoView({behavior:'smooth',block:'end'});
}
load();
</script></body></html>`;
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Social Studio → http://127.0.0.1:${PORT}`);
});
