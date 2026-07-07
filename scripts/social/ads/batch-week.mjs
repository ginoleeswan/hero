#!/usr/bin/env node
// One command → a week of ready-to-post content. Composes the existing ad
// generators (brand / matchup / ranking) into a dated folder with day-prefixed
// images + captions. The mix rotates by ISO week so consecutive weeks differ.
//
//   node scripts/social/ads/batch-week.mjs             # 7 posts, 4x5 (IG feed)
//   node scripts/social/ads/batch-week.mjs --size 1x1
//   node scripts/social/ads/batch-week.mjs --dry-run   # print the plan only
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUT_DIR, RIVALRIES, loadEnv, makeSb, heroByName } from '../lib.mjs';

const ADS = dirname(fileURLToPath(import.meta.url));
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const BRAND_STYLES = ['constellation', 'powerstats', 'dossier', 'scale', 'versus', 'leaderboard'];
const RANKINGS = [
  ['fame', 'top-10-most-famous'],
  ['strength', 'top-10-strongest'],
  ['intelligence', 'top-10-smartest'],
  ['speed', 'top-10-fastest'],
];

// Weekly rotation seed — same week = same plan (idempotent), next week differs.
const week = Math.floor(Date.now() / 604_800_000);

// Where + how each kind of post performs best.
const GUIDE = {
  brand: {
    where: 'Instagram feed · X',
    when: '11:00–13:00',
    how: 'Awareness post — let the image speak; caption short. Cross-post to X as-is.',
  },
  matchup: {
    where: 'Instagram feed → story',
    when: '18:00–20:00',
    how: 'Comment bait — ask the question again as your first comment. Re-run with --size 9x16 and post to your story with a poll sticker (“who wins?”).',
  },
  ranking: {
    where: 'Instagram feed',
    when: '12:00–14:00',
    how: 'Save/share bait — pin a comment asking “who got robbed?”. Great for X quote-posts arguing the order.',
  },
};

// Only rivalries whose BOTH names exact-match the heroes table (names drift).
async function resolvableRivalries() {
  const sb = makeSb(loadEnv());
  const checks = await Promise.all(RIVALRIES.map(async ([a, b]) =>
    ((await heroByName(sb, a)) && (await heroByName(sb, b))) ? [a, b] : null));
  return checks.filter(Boolean);
}

function buildPlan(pool) {
  const bs = (i) => BRAND_STYLES[(week + i) % BRAND_STYLES.length];
  const riv = (i) => pool[(week * 2 + i) % pool.length];
  const rank = (i) => RANKINGS[(week + i) % RANKINGS.length];
  // Mon..Sun: brand / matchup / ranking / brand / matchup / brand / ranking
  return [
    { kind: 'brand', style: bs(0) },
    { kind: 'matchup', pair: riv(0) },
    { kind: 'ranking', by: rank(0)[0], slug: rank(0)[1] },
    { kind: 'brand', style: bs(1) },
    { kind: 'matchup', pair: riv(1) },
    { kind: 'brand', style: bs(2) },
    { kind: 'ranking', by: rank(1)[0], slug: rank(1)[1] },
  ];
}

// Chrome launches flake occasionally — retry each generator before giving up.
function run(script, args, tries = 3) {
  for (let t = 1; ; t++) {
    try { return execFileSync(process.execPath, [join(ADS, script), ...args], { stdio: 'inherit' }); }
    catch (e) {
      if (t >= tries) throw e;
      console.warn(`  retry ${t}/${tries - 1} for ${script}…`);
    }
  }
}

const slugPair = ([a, b]) => `${a}-vs-${b}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function sources(post, size) {
  // Where each generator leaves its output → [image, caption]
  if (post.kind === 'brand') {
    const d = join(OUT_DIR, 'ad-brand');
    return [join(d, `${post.style}-${size}.png`), join(d, 'caption.txt')];
  }
  if (post.kind === 'matchup') {
    // ad-matchup orders the pair by hero id, so the folder may be either order.
    const [a, b] = post.pair;
    let d = join(OUT_DIR, `ad-matchup-${slugPair([a, b])}`);
    if (!existsSync(join(d, `${size}.png`))) d = join(OUT_DIR, `ad-matchup-${slugPair([b, a])}`);
    return [join(d, `${size}.png`), join(d, 'caption.txt')];
  }
  const d = join(OUT_DIR, `ad-ranking-${post.slug}`);
  return [join(d, `${size}.png`), join(d, 'caption.txt')];
}

const label = (post) =>
  post.kind === 'brand' ? `brand-${post.style}`
    : post.kind === 'matchup' ? `matchup-${slugPair(post.pair)}`
      : `ranking-${post.slug}`;

// Self-contained visual planner written next to the images — open week.html in a
// browser: previews, where/when/how per post, one-click caption copy, and a
// "posted" checkbox persisted in localStorage. No server, no dependencies.
function dashboard(stamp, size, entries) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cards = entries.map((e) => {
    const g = GUIDE[e.kind];
    return `<div class="card" data-id="${e.base}">
      <div class="imgwrap"><img src="${e.base}.png" alt="${esc(e.name)}" loading="lazy"></div>
      <div class="body">
        <div class="row"><span class="day">${e.day.toUpperCase()}</span><span class="name">${esc(e.name)}</span>
          <label class="done"><input type="checkbox" class="posted"> posted</label></div>
        <div class="meta"><b>${esc(g.where)}</b> · ${esc(g.when)}</div>
        <div class="how">${esc(g.how)}</div>
        <pre class="cap">${esc(e.caption.trim())}</pre>
        <button class="copy">Copy caption</button>
      </div></div>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mythique — week ${stamp}</title><style>
:root{--navy:#06121a;--panel:#0f2231;--gold:#e0a83e;--cream:#f6eddd;--muted:#9db4c4;--line:rgba(246,237,221,.09)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:linear-gradient(#0d1f2b,var(--navy) 40%);color:var(--cream);font:15px/1.55 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:34px 22px 80px}
.wrap{max-width:1180px;margin:0 auto}
h1{font-size:24px;font-weight:650;letter-spacing:.2px}
h1 span{color:var(--gold)}
.sub{color:var(--muted);font-size:13.5px;margin:6px 0 26px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}
.card{background:linear-gradient(180deg,var(--panel),#0b1c27);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.card.is-done{opacity:.45}
.imgwrap img{display:block;width:100%;height:auto;border-bottom:1px solid var(--line)}
.body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px}
.row{display:flex;align-items:baseline;gap:10px}
.day{color:var(--gold);font-weight:700;font-size:12px;letter-spacing:.14em}
.name{font-weight:600;font-size:14px}
.done{margin-left:auto;color:var(--muted);font-size:12.5px;display:flex;gap:5px;align-items:center;cursor:pointer;white-space:nowrap}
.meta{font-size:13px;color:var(--cream)}.meta b{color:var(--gold);font-weight:600}
.how{font-size:12.5px;color:var(--muted)}
.cap{white-space:pre-wrap;font:12px/1.5 ui-monospace,Menlo,monospace;color:var(--muted);background:rgba(0,0,0,.25);border:1px solid var(--line);border-radius:8px;padding:10px;max-height:120px;overflow:auto}
.copy{align-self:flex-start;background:var(--gold);color:#3a2708;border:0;border-radius:8px;padding:7px 14px;font-weight:650;font-size:13px;cursor:pointer}
.copy:active{transform:translateY(1px)}
.foot{margin-top:30px;color:var(--muted);font-size:12.5px;text-align:center}
</style></head><body><div class="wrap">
<h1>mythique<span>.</span> — content week ${stamp}</h1>
<div class="sub">${entries.length} posts · ${size} · one per day · stories: re-run with --size 9x16 (matchups → poll sticker)</div>
<div class="grid">${cards}</div>
<div class="foot">Consistency beats timing — one post a day, reply to every comment. · Unofficial fan encyclopedia. Characters © their respective owners.</div>
</div><script>
document.querySelectorAll('.card').forEach(card=>{
  const id='mq-'+card.dataset.id, box=card.querySelector('.posted');
  const sync=()=>card.classList.toggle('is-done',box.checked);
  box.checked=localStorage.getItem(id)==='1';sync();
  box.addEventListener('change',()=>{localStorage.setItem(id,box.checked?'1':'0');sync();});
  card.querySelector('.copy').addEventListener('click',async(ev)=>{
    const text=card.querySelector('.cap').textContent;
    try{await navigator.clipboard.writeText(text);}catch{
      const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();}
    ev.target.textContent='Copied ✓';setTimeout(()=>ev.target.textContent='Copy caption',1200);});
});
</script></body></html>`;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const size = get('--size', '4x5');
  const dry = args.includes('--dry-run');

  const pool = await resolvableRivalries();
  if (!pool.length) { console.error('No rivalry pair resolves against the heroes table.'); process.exit(1); }
  const plan = buildPlan(pool);
  console.log(`Week plan (rotation #${week}, size ${size}):`);
  plan.forEach((p, i) => console.log(`  ${DAYS[i]}  ${label(p)}`));
  if (dry) return;

  const stamp = new Date().toISOString().slice(0, 10);
  const weekDir = join(OUT_DIR, `week-${stamp}`);
  mkdirSync(weekDir, { recursive: true });

  const lines = [`# Mythique — content week ${stamp}`, '', `Size: ${size} · rotation #${week}`, ''];
  const entries = [];
  for (let i = 0; i < plan.length; i++) {
    const post = plan[i];
    console.log(`\n[${DAYS[i]}] ${label(post)}`);
    if (post.kind === 'brand') run('ad-brand.mjs', ['--style', post.style, '--size', size]);
    else if (post.kind === 'matchup') run('ad-matchup.mjs', ['--matchup', post.pair.join(','), '--size', size]);
    else run('ad-ranking.mjs', ['--by', post.by, '--size', size]);

    const [img, cap] = sources(post, size);
    const base = `${String(i + 1).padStart(2, '0')}-${DAYS[i]}-${label(post)}`;
    if (!existsSync(img)) { console.error(`  !! expected output missing: ${img}`); continue; }
    copyFileSync(img, join(weekDir, `${base}.png`));
    const caption = existsSync(cap) ? readFileSync(cap, 'utf8') : '';
    if (caption) writeFileSync(join(weekDir, `${base}.caption.txt`), caption);
    const g = GUIDE[post.kind];
    lines.push(`- **${DAYS[i]}** — ${label(post)} (\`${base}.png\`) · ${g.where} · ${g.when}`);
    entries.push({ day: DAYS[i], base, kind: post.kind, name: label(post), caption });
  }
  lines.push('', 'Post one per day; paste the matching `.caption.txt`. Stories: re-run with `--size 9x16`.');
  writeFileSync(join(weekDir, 'PLAN.md'), lines.join('\n') + '\n');
  writeFileSync(join(weekDir, 'week.html'), dashboard(stamp, size, entries));
  console.log(`\nWeek ready → ${weekDir}`);
  console.log(`Open the visual planner:  open "${join(weekDir, 'week.html')}"`);
}

main().catch((e) => { console.error(e); process.exit(1); });
