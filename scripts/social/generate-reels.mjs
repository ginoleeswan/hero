#!/usr/bin/env node
// Mythique social reel generator.
//
// Generates fast-cut 9:16 "who would win" videos (TikTok / Reels / Shorts) from
// REAL matchup data, styled like the app's matchup screen. One command makes a
// batch of ready-to-post mp4s plus captions.
//
//   node scripts/social/generate-reels.mjs --count 8
//   node scripts/social/generate-reels.mjs --matchup "Goku,Superman"
//   node scripts/social/generate-reels.mjs --count 10 --dry-run   # list picks only
//
// Everything runs off the PUBLIC (publishable/anon) Supabase key — the same
// read path the app uses. No secret key. Reads EXPO_PUBLIC_SUPABASE_URL /
// EXPO_PUBLIC_SUPABASE_KEY from .env.local (or the environment).
//
// Requirements (local machine):
//   - Node >= 18 (global fetch)
//   - playwright-core  (yarn add -D playwright-core) + a Chrome/Chromium
//       set PW_CHROME to an executable, or it uses channel:"chrome"
//   - ffmpeg on PATH (brew install ffmpeg), or set FFMPEG=/path/to/ffmpeg
//
// Data flow per matchup:
//   heroes table  -> portraits + 6 stats + fame_score      (public key)
//   winner        -> computed from stats (more stat wins), matching the app
//   get_matchup_tally RPC -> real community vote split       (public key)
//   generate-verdict edge fn -> cached verdict, else Gemini  (public key)

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'out', 'social');
const STAT_KEYS = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'];

// Curated marquee rivalries — the ones people show up to argue about. Filled out
// with random popular pairs. Names are resolved to ids against the heroes table.
const RIVALRIES = [
  ['Goku', 'Superman'], ['Batman', 'Iron Man'], ['Hulk', 'Superman'],
  ['Thanos', 'Darkseid'], ['Naruto', 'Ichigo'], ['Spider-Man', 'Batman'],
  ['Thor', 'Superman'], ['Wolverine', 'Deadpool'], ['Saitama', 'Goku'],
  ['Doctor Strange', 'Zatanna'], ['Flash', 'Quicksilver'], ['Joker', 'Green Goblin'],
];

// Selection thresholds
const MIN_VOTES = 40; // a matchup people actually engaged with
const MAX_SPREAD = 18; // |pct - 50| <= this => close/controversial => gets talking
const FAME_POOL = 160; // sample random pairs from the top-N most famous

// ---------- env ----------
function loadEnv() {
  const envPath = join(ROOT, '.env.local');
  const out = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || out.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY || out.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY (checked .env.local and env).');
    process.exit(1);
  }
  return { url, key };
}

// ---------- supabase (public key) ----------
function makeSb({ url, key }) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  return {
    async rest(path) {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers });
      if (!r.ok) throw new Error(`REST ${path} -> ${r.status}`);
      return r.json();
    },
    async rpc(fn, body) {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`RPC ${fn} -> ${r.status}`);
      return r.json();
    },
    async invoke(fn, body) {
      const r = await fetch(`${url}/functions/v1/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`fn ${fn} -> ${r.status}`);
      return r.json();
    },
  };
}

const q = (s) => encodeURIComponent(s);
const statWins = (a, b) => {
  let wa = 0, wb = 0;
  for (const k of STAT_KEYS) { if ((a[k] ?? 0) > (b[k] ?? 0)) wa++; else if ((b[k] ?? 0) > (a[k] ?? 0)) wb++; }
  return [wa, wb];
};

async function heroByName(sb, name) {
  const sel = 'id,name,publisher,portrait_url,image_url,image_md_url,fame_score,' + STAT_KEYS.join(',');
  const rows = await sb.rest(`heroes?name=eq.${q(name)}&select=${sel}&limit=1`);
  return rows[0] || null;
}
async function famousPool(sb) {
  const sel = 'id,name,publisher,portrait_url,image_url,image_md_url,fame_score,' + STAT_KEYS.join(',');
  return sb.rest(`heroes?select=${sel}&order=fame_score.desc&limit=${FAME_POOL}`);
}

// A matchup is postable if it has a real, close-ish vote split.
async function evaluate(sb, a, b) {
  const [ka, kb] = a.id <= b.id ? [a, b] : [b, a]; // tally normalizes smaller id as A
  let tally;
  try { tally = await sb.rpc('get_matchup_tally', { p_a: ka.id, p_b: kb.id }); } catch { return null; }
  const total = tally.total ?? 0;
  if (total < MIN_VOTES) return null;
  const pctKa = Math.round((tally.votes_a / total) * 100);
  if (Math.abs(pctKa - 50) > MAX_SPREAD) return null;
  return { ka, kb, votesA: tally.votes_a, votesB: tally.votes_b, total, pctA: pctKa, pctB: 100 - pctKa };
}

const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = ((i + 1) * 2654435761) % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

async function selectMatchups(sb, count) {
  const picks = [];
  const seen = new Set();
  const key = (a, b) => [a, b].sort().join(':');
  // 1) curated rivalries first (people show up for these)
  for (const [na, nb] of shuffle([...RIVALRIES])) {
    if (picks.length >= count) break;
    const a = await heroByName(sb, na), b = await heroByName(sb, nb);
    if (!a || !b || seen.has(key(a.id, b.id))) continue;
    const ev = await evaluate(sb, a, b);
    if (ev) { seen.add(key(a.id, b.id)); picks.push(ev); }
  }
  // 2) fill with random popular cross-publisher pairs
  if (picks.length < count) {
    const pool = await famousPool(sb);
    let attempts = 0;
    while (picks.length < count && attempts < 400) {
      attempts++;
      const a = pool[Math.floor((attempts * 2654435761) % pool.length)];
      const b = pool[Math.floor((attempts * 40503) % pool.length)];
      if (!a || !b || a.id === b.id || seen.has(key(a.id, b.id))) continue;
      if (a.publisher && a.publisher === b.publisher) continue; // cross-universe = more argument
      const ev = await evaluate(sb, a, b);
      if (ev) { seen.add(key(a.id, b.id)); picks.push(ev); }
    }
  }
  return picks;
}

// ---------- assets ----------
const b64 = (p) => readFileSync(p).toString('base64');
function fonts() {
  return {
    R: b64(join(ROOT, 'node_modules/@expo-google-fonts/righteous/400Regular/Righteous_400Regular.ttf')),
    F: b64(join(ROOT, 'assets/fonts/Flame-Bold.ttf')),
    S: b64(join(ROOT, 'assets/fonts/FlameSans-Regular.ttf')),
  };
}
async function portraitDataUri(hero) {
  const src = hero.portrait_url || hero.image_url || hero.image_md_url;
  const r = await fetch(src);
  const buf = Buffer.from(await r.arrayBuffer());
  const mime = src.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// ---------- render template (app aesthetic, fast-cut) ----------
function buildHtml(M, F) {
  const O = '#e8823a', T = '#37a3c4', GOLD = '#e0a83e', CREAM = '#f5ebdc', NAVY = '#06121a';
  const grain = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}`;
  const card = (c) => `<div class="sqin ${c.dim ? 'loser' : ''}"><img class="${c.flip ? 'flip' : ''}" src="${c.img}"><div class="glare"></div></div><div class="pname" style="color:${c.col}">${c.name}</div>`;
  const a = M.a, b = M.b;
  const stats = M.stats.map((s, i) => {
    const aw = s[1] >= s[2];
    return `<div class="scene stat" id="s_stat${i}">
      <div class="rlabel">ROUND ${i + 1}</div>
      <div class="statname">${s[0]}</div>
      <div class="snums"><span class="na cnt" data-to="${s[1]}">0</span><span class="vs2">vs</span><span class="nb cnt" data-to="${s[2]}">0</span></div>
      <div class="track"><div class="fa" style="width:${Math.round((s[1] / (s[1] + s[2])) * 100)}%"></div><div class="fb"></div></div>
      <div class="wlabel" style="color:${aw ? O : T}">${aw ? a.name : b.name} TAKES IT</div>
    </div>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'R';src:url(data:font/ttf;base64,${F.R});}
@font-face{font-family:'F';src:url(data:font/ttf;base64,${F.F});}
@font-face{font-family:'S';src:url(data:font/ttf;base64,${F.S});}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:1080px;height:1920px;overflow:hidden;background:${NAVY};font-family:'F';}
.root{position:relative;width:1080px;height:1920px;overflow:hidden;
 background:radial-gradient(60% 44% at 50% 34%, rgba(224,168,62,.12), transparent 62%), radial-gradient(120% 90% at 50% 10%, #12242f, ${NAVY} 70%);}
.dots{position:absolute;inset:0;background-image:radial-gradient(circle, rgba(224,168,62,.10) 1.4px, transparent 2px);background-size:30px;-webkit-mask-image:radial-gradient(130% 100% at 50% 40%, transparent 40%, #000);opacity:.6;}
.grain{position:absolute;inset:0;background-image:url("${grain}");background-size:340px;opacity:.05;mix-blend-mode:overlay;}
.scene{position:absolute;inset:0;opacity:0;}.scene.on{opacity:1;}
.sq{position:absolute;top:520px;width:452px;}.sq.l{left:60px;}.sq.r{right:60px;}
.sqin{position:relative;width:452px;height:600px;border-radius:23%/17%;overflow:hidden;border:7px solid var(--tc);box-shadow:0 30px 70px rgba(0,0,0,.6),0 0 60px -10px var(--tc);}
.sqin img{width:100%;height:100%;object-fit:cover;}.sqin img.flip{transform:scaleX(-1);}.sqin.loser{filter:grayscale(1) brightness(.42);}
.glare{position:absolute;inset:0;background:linear-gradient(120deg, rgba(255,255,255,.14), transparent 40%);}
.pname{text-align:center;font-size:60px;margin-top:20px;-webkit-text-stroke:8px ${NAVY};paint-order:stroke fill;}
.scene.on .sq.l{animation:inL .5s cubic-bezier(.16,1,.3,1) both;}.scene.on .sq.r{animation:inR .5s cubic-bezier(.16,1,.3,1) both;}
.vs{position:absolute;top:770px;left:50%;transform:translateX(-50%);width:172px;height:172px;border-radius:50%;background:${NAVY};border:6px solid ${GOLD};color:${GOLD};display:flex;align-items:center;justify-content:center;font-size:78px;box-shadow:0 0 0 10px ${NAVY},0 0 70px rgba(224,168,62,.7);z-index:5;}
.scene.on .vs{animation:pop .45s .25s cubic-bezier(.2,1.7,.4,1) both;}
.flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;}.scene.on .flash{animation:flash .4s ease-out both;}
.cap{position:absolute;left:60px;right:60px;text-align:center;color:${CREAM};-webkit-text-stroke:9px ${NAVY};paint-order:stroke fill;text-shadow:0 8px 26px rgba(0,0,0,.6);}
.scene.on .cap{animation:slam .3s cubic-bezier(.2,1.5,.4,1) both;}
.title{top:170px;font-size:92px;}.title .o{color:${O}}.title .t{color:${T}}.g{color:${GOLD}}
.subq{top:1270px;font-size:74px;}
.rlabel{position:absolute;top:470px;left:0;right:0;text-align:center;font-size:44px;letter-spacing:8px;color:${GOLD};opacity:.85;}
.statname{position:absolute;top:560px;left:0;right:0;text-align:center;font-size:104px;color:${GOLD};-webkit-text-stroke:9px ${NAVY};paint-order:stroke fill;}
.snums{position:absolute;top:760px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:60px;font-size:230px;-webkit-text-stroke:12px ${NAVY};paint-order:stroke fill;}
.snums .na{color:${O}}.snums .nb{color:${T}}.snums .vs2{color:${CREAM};font-size:96px;}
.track{position:absolute;top:1120px;left:120px;right:120px;height:52px;border-radius:30px;overflow:hidden;display:flex;border:5px solid rgba(245,235,220,.18);background:#0e2330;}
.track .fa{background:${O};}.track .fb{background:${T};flex:1;}
.wlabel{position:absolute;top:1230px;left:0;right:0;text-align:center;font-size:60px;-webkit-text-stroke:7px ${NAVY};paint-order:stroke fill;opacity:0;}
.scene.on .statname{animation:slam .26s cubic-bezier(.2,1.5,.4,1) both;}.scene.on .snums{animation:slam .3s .04s cubic-bezier(.2,1.4,.4,1) both;}
.qbig{top:780px;font-size:150px;}
.winnerlbl{position:absolute;top:360px;left:0;right:0;text-align:center;font-size:64px;color:${GOLD};letter-spacing:4px;-webkit-text-stroke:6px ${NAVY};paint-order:stroke fill;}
.winnerlbl .u{display:block;width:220px;height:8px;background:${GOLD};margin:14px auto 0;border-radius:6px;}
.wglow{position:absolute;top:520px;width:452px;height:600px;border-radius:23%/17%;box-shadow:0 0 130px 12px rgba(224,168,62,.85);}
.xmark{position:absolute;top:640px;font-size:300px;color:#e2402f;z-index:6;-webkit-text-stroke:14px ${NAVY};paint-order:stroke fill;opacity:0;}
.scene.on .xmark{animation:xin .4s .25s cubic-bezier(.2,1.6,.4,1) both;}
.bigwin{position:absolute;top:1200px;left:0;right:0;text-align:center;font-size:112px;color:${GOLD};-webkit-text-stroke:11px ${NAVY};paint-order:stroke fill;}
.scene.on .winnerlbl,.scene.on .bigwin{animation:slam .32s .1s cubic-bezier(.2,1.5,.4,1) both;}
.vlabel{position:absolute;top:560px;left:0;right:0;text-align:center;font-size:44px;letter-spacing:6px;color:${GOLD};}
.vquote{position:absolute;top:720px;left:90px;right:90px;text-align:center;font-family:'R';font-size:64px;line-height:1.32;color:${CREAM};}
.vquote .mark{color:${GOLD};font-size:120px;line-height:0;vertical-align:-30px;}
.scene.on .vquote{animation:upIn .5s .1s both;}
.vbar{position:absolute;top:1040px;left:90px;right:90px;height:74px;border-radius:40px;overflow:hidden;display:flex;border:6px solid rgba(245,235,220,.2);}
.vbar .a{background:${O};}.vbar .b{background:${T};flex:1;}
.vpc{position:absolute;top:1150px;left:90px;right:90px;display:flex;justify-content:space-between;font-size:108px;-webkit-text-stroke:9px ${NAVY};paint-order:stroke fill;}
.vpc .pa{color:${O}}.vpc .pb{color:${T}}
.ctaq{top:430px;font-size:118px;}.ctabig{position:absolute;top:1120px;left:0;right:0;text-align:center;font-family:'R';font-size:120px;color:${CREAM};}
.ctah{position:absolute;top:1280px;left:0;right:0;text-align:center;font-size:52px;color:${GOLD};}
@keyframes slam{from{opacity:0;transform:scale(.6)}70%{transform:scale(1.07)}to{opacity:1;transform:scale(1)}}
@keyframes inL{from{opacity:0;transform:translateX(-120px)}to{opacity:1;transform:none}}
@keyframes inR{from{opacity:0;transform:translateX(120px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:translateX(-50%) scale(.2)}to{opacity:1;transform:translateX(-50%) scale(1)}}
@keyframes flash{from{opacity:.9}to{opacity:0}}
@keyframes xin{from{opacity:0;transform:scale(2) rotate(-18deg)}to{opacity:1;transform:scale(1) rotate(-10deg)}}
@keyframes upIn{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:none}}
</style></head><body>
<div class="root"><div class="dots"></div><div class="grain"></div>
 <div class="scene" id="s_hook">
  <div class="cap title"><span class=o>${a.name}</span> <span class="g">vs</span> <span class=t>${b.name}</span></div>
  <div class="sq l" style="--tc:${O}">${card({ ...a, col: O })}</div>
  <div class="sq r" style="--tc:${T}">${card({ ...b, col: T })}</div>
  <div class="vs">VS</div><div class="cap subq">who <span class="g">actually</span> wins?</div><div class="flash"></div>
 </div>
 ${stats}
 <div class="scene" id="s_sus"><div class="cap qbig">SO WHO<br>WINS<span class="g">?</span></div></div>
 <div class="scene" id="s_win">
  <div class="winnerlbl">WINNER<span class="u"></span></div>
  <div class="sq l" style="--tc:${O}">${card({ ...a, col: O, flip: false, dim: M.winner === 'b' })}</div>
  <div class="sq r" style="--tc:${T}">${card({ ...b, col: T, flip: b.flip, dim: M.winner === 'a' })}</div>
  <div class="wglow" style="${M.winner === 'b' ? 'right:60px;left:auto' : 'left:60px'}"></div>
  <div class="xmark" style="${M.winner === 'b' ? 'left:150px' : 'right:150px'}">X</div>
  <div class="bigwin">${M[M.winner].name} WINS</div><div class="flash"></div>
 </div>
 <div class="scene" id="s_verdict"><div class="vlabel">THE VERDICT</div>
  <div class="vquote"><span class="mark">&ldquo;</span>${M.verdict}<span class="mark">&rdquo;</span></div></div>
 <div class="scene" id="s_twist"><div class="cap title">BUT FANS<br><span class="g">DISAGREE</span></div>
  <div class="vbar"><div class="a" style="width:${M.voteA}%"></div><div class="b"></div></div>
  <div class="vpc"><span class="pa">${M.voteA}%</span><span class="pb">${M.voteB}%</span></div>
  <div class="cap" style="top:1330px;font-size:60px">${M.voteA >= M.voteB ? a.name : b.name} is <span class="g">winning the vote</span></div></div>
 <div class="scene" id="s_cta"><div class="cap ctaq">who's <span class="g">YOUR</span><br>pick?</div>
  <div class="ctabig">mythique</div><div class="ctah">@mythiqueapp  ·  34,000+ characters</div></div>
</div>
<script>
function cu(el,to,d){var t0=null;function s(ts){if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/d);el.textContent=Math.round(k*to);if(k<1)requestAnimationFrame(s);}requestAnimationFrame(s);}
var tl=[['s_hook',0,1900],['s_stat0',1900,950],['s_stat1',2850,950],['s_stat2',3800,950],['s_sus',4750,850],['s_win',5600,1900],['s_verdict',7500,1900],['s_twist',9400,1800],['s_cta',11200,1900]];
tl.forEach(function(t){setTimeout(function(){var el=document.getElementById(t[0]);if(!el)return;el.classList.add('on');el.querySelectorAll('.cnt').forEach(function(c){cu(c,parseInt(c.dataset.to),420);});var w=el.querySelector('.wlabel');if(w)setTimeout(function(){w.style.transition='opacity .2s';w.style.opacity=1;},430);},t[1]);setTimeout(function(){var el=document.getElementById(t[0]);if(el)el.classList.remove('on');},t[1]+t[2]);});
</script></body></html>`;
}

async function render(html, outMp4, workDir) {
  const pw = await import('playwright-core');
  const launchOpts = process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : { channel: 'chrome' };
  const browser = await pw.chromium.launch({ ...launchOpts, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, recordVideo: { dir: workDir, size: { width: 1080, height: 1920 } } });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(13300);
  await page.close(); await ctx.close(); await browser.close();
  const { readdirSync } = await import('node:fs');
  const webm = join(workDir, readdirSync(workDir).find((f) => f.endsWith('.webm')));
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  execFileSync(ffmpeg, ['-y', '-i', webm, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', outMp4], { stdio: 'ignore' });
}

function caption(M) {
  const a = M.a.name, b = M.b.name;
  const w = M[M.winner].name;
  const lead = M.voteA >= M.voteB ? a : b;
  return [
    `${a} vs ${b} — who actually wins? 🥊`,
    ``,
    `Our model says ${w}. But the fans have ${lead} ahead ${Math.max(M.voteA, M.voteB)}/${Math.min(M.voteA, M.voteB)} 👀`,
    `"${M.verdict}"`,
    ``,
    `Who's your pick? Settle it on mythique.app`,
    ``,
    `#whowouldwin #${a.replace(/[^a-z0-9]/gi, '')} #${b.replace(/[^a-z0-9]/gi, '')} #superheroes #anime #marvel #dc #powerscaling #mythique`,
  ].join('\n');
}

// ---------- main ----------
async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const dry = args.includes('--dry-run');
  const count = parseInt(get('--count', '6'), 10);
  const manual = get('--matchup', null);

  const env = loadEnv();
  const sb = makeSb(env);

  let selections;
  if (manual) {
    const [na, nb] = manual.split(',').map((s) => s.trim());
    const a = await heroByName(sb, na), b = await heroByName(sb, nb);
    if (!a || !b) { console.error('Could not find one of:', na, nb); process.exit(1); }
    const ev = await evaluate(sb, a, b);
    if (!ev) { console.warn('Note: that matchup has few/no votes; the fan bar may be empty.'); }
    selections = [ev || { ka: a.id <= b.id ? a : b, kb: a.id <= b.id ? b : a, votesA: 0, votesB: 0, total: 0, pctA: 50, pctB: 50 }];
  } else {
    console.log(`Selecting ${count} popular, close-vote matchups...`);
    selections = await selectMatchups(sb, count);
  }

  console.log(`\n${selections.length} matchup(s):`);
  for (const s of selections) console.log(`  ${s.ka.name} vs ${s.kb.name}  —  ${s.pctA}/${s.pctB}  (${s.total} votes)`);
  if (dry) return;

  const F = fonts();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const s of selections) {
    // Orient: A = ka (left, orange, no flip), B = kb (right, teal, flipped to face in)
    const [wa, wb] = statWins(s.ka, s.kb);
    const winner = wa >= wb ? 'a' : 'b';
    let verdict = '';
    try {
      const r = await sb.invoke('generate-verdict', {
        heroAId: s.ka.id, heroBId: s.kb.id, heroA: s.ka.name, heroB: s.kb.name,
        winsA: wa, winsB: wb,
        statsA: Object.fromEntries(STAT_KEYS.map((k) => [k, s.ka[k] ?? 0])),
        statsB: Object.fromEntries(STAT_KEYS.map((k) => [k, s.kb[k] ?? 0])),
      });
      verdict = r.verdict || '';
    } catch (e) { console.warn('verdict fetch failed:', e.message); }

    const M = {
      a: { name: s.ka.name.toUpperCase(), img: await portraitDataUri(s.ka), flip: false },
      b: { name: s.kb.name.toUpperCase(), img: await portraitDataUri(s.kb), flip: true },
      winner, verdict,
      voteA: s.pctA, voteB: s.pctB,
      stats: [
        ['COMBAT', s.ka.combat ?? 0, s.kb.combat ?? 0],
        ['SPEED', s.ka.speed ?? 0, s.kb.speed ?? 0],
        ['INTELLIGENCE', s.ka.intelligence ?? 0, s.kb.intelligence ?? 0],
      ],
    };
    const slug = `${s.ka.name}-vs-${s.kb.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dir = join(OUT_DIR, slug);
    mkdirSync(dir, { recursive: true });
    const html = buildHtml(M, F);
    const mp4 = join(dir, 'video.mp4');
    console.log(`Rendering ${slug} ...`);
    await render(html, mp4, dir);
    writeFileSync(join(dir, 'caption.txt'), caption(M));
    console.log(`  -> ${mp4}`);
    console.log(`  -> ${join(dir, 'caption.txt')}`);
  }
  console.log('\nDone. Add a trending sound in-app when you upload.');
}

main().catch((e) => { console.error(e); process.exit(1); });
