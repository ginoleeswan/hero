#!/usr/bin/env node
// Data-first leaderboard ad. Leans on the proprietary Mythique fame_score (or a
// stat) — names + score bars, no portraits. The metric is the hero, so it stays
// clean and off the risky edge while still being real, argument-starting data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR, renderPng } from '../lib.mjs';
import { adShell } from './shell.mjs';

const SIZES = { '1x1': [1080, 1080], '4x5': [1080, 1350], '9x16': [1080, 1920], '16x9': [1920, 1080], og: [1200, 630] };
const GOLD = '#e0a83e', ORANGE = '#e8823a', CREAM = '#f6eddd', MUTED = '#9db4c4';
const q = (s) => encodeURIComponent(s);

const METRIC_WORD = { fame: 'MOST FAMOUS', strength: 'STRONGEST', speed: 'FASTEST', intelligence: 'SMARTEST', durability: 'TOUGHEST', power: 'MOST POWERFUL', combat: 'DEADLIEST' };

async function fetchRanking(sb, by, count) {
  const metric = by === 'fame' ? 'fame_score' : by;
  const cols = ['id', 'name', 'fame_score'];
  if (by !== 'fame') cols.push(by);
  // issue_count tiebreak keeps tie order deterministic run-to-run
  const order = by === 'fame' ? 'fame_score.desc,issue_count.desc.nullslast' : `${by}.desc.nullslast,fame_score.desc,issue_count.desc.nullslast`;
  const filter = by === 'fame' ? '' : `&${by}=not.is.null`;
  const rows = await sb.rest(`heroes?select=${cols.join(',')}&order=${order}${filter}&limit=${count}`);
  return rows.map((r, i) => ({ rank: i + 1, name: r.name, value: r[metric] ?? 0 }));
}

function render(rows, title, sub, w, h) {
  const n = rows.length;
  const rowH = (h * 0.6) / n, gap = rowH * 0.18, barH = rowH - gap;
  const fName = Math.round(barH * 0.5), fNum = Math.round(rowH * 0.62);
  const list = rows.map((e) => {
    const isTop = e.rank === 1;
    const bw = 100 - (e.rank - 1) * (44 / n); // decreasing by rank — the countdown
    return `<div style="display:flex;align-items:center;gap:${Math.round(w * 0.02)}px;height:${Math.round(rowH)}px;width:100%">
      <span class="pop" style="width:${Math.round(w * 0.1)}px;text-align:center;font-size:${isTop ? Math.round(fNum * 1.1) : fNum}px;color:${GOLD}">${e.rank}</span>
      <div style="flex:1;position:relative;height:${Math.round(barH)}px;border-radius:12px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid ${isTop ? GOLD : 'rgba(255,255,255,.06)'}">
        <div style="position:absolute;inset:0;width:${bw}%;background:linear-gradient(90deg,${isTop ? 'rgba(224,168,62,.34)' : 'rgba(232,130,58,.24)'},rgba(224,168,62,.12))"></div>
        <span style="position:absolute;left:${Math.round(w * 0.022)}px;top:50%;transform:translateY(-50%);font-family:'S';font-size:${fName}px;color:${isTop ? GOLD : CREAM}">${e.name}</span></div></div>`;
  }).join('');
  return `<div style="position:absolute;left:0;right:0;top:0;bottom:${Math.round(h * 0.12)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 ${Math.round(w * 0.07)}px">
    <div style="font-size:${Math.round(h * 0.025)}px;letter-spacing:.2em;color:${GOLD};margin-bottom:${Math.round(h * 0.01)}px">${sub}</div>
    <div class="pop" style="font-size:${Math.round(h * 0.052)}px;color:${CREAM};margin-bottom:${Math.round(h * 0.028)}px;text-align:center">${title}</div>
    <div style="width:100%;max-width:${Math.round(w * 0.86)}px;display:flex;flex-direction:column;gap:${Math.round(gap)}px">${list}</div>
    <div style="font-size:${Math.round(h * 0.028)}px;letter-spacing:.5px;margin-top:${Math.round(h * 0.028)}px"><span style="color:${MUTED}">see the full list · </span><span class="g pop">mythique.app&thinsp;→</span></div>
  </div>`;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const by = get('--by', 'fame').toLowerCase();
  const count = parseInt(get('--count', '10'), 10);
  const wantSize = get('--size', '1x1');
  const sizes = wantSize === 'all' ? Object.keys(SIZES) : [wantSize];
  if (!METRIC_WORD[by]) { console.error('--by:', Object.keys(METRIC_WORD).join(', ')); process.exit(1); }
  if (sizes.some((s) => !SIZES[s])) { console.error('--size:', Object.keys(SIZES).join(', '), 'or all'); process.exit(1); }

  const sb = makeSb(loadEnv());
  const rows = await fetchRanking(sb, by, count);
  if (!rows.length) { console.error('No rows.'); process.exit(1); }
  const title = get('--title', `TOP ${count} ${METRIC_WORD[by]}`);
  const sub = by === 'fame' ? 'RANKED BY MYTHIQUE FAME SCORE' : `RANKED BY ${by.toUpperCase()}`;

  const F = fonts();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dir = join(OUT_DIR, `ad-ranking-${slug}`);
  mkdirSync(dir, { recursive: true });
  for (const size of sizes) {
    const [w, h] = SIZES[size];
    await renderPng(adShell(F, { w, h }, render(rows, title, sub, w, h)), join(dir, `${size}.png`), w, h);
    console.log(`  -> ${join(dir, `${size}.png`)}`);
  }
  writeFileSync(join(dir, 'caption.txt'), [
    `${title.replace(/\b\w+/g, (x) => x[0] + x.slice(1).toLowerCase())} 🏆`, ``,
    `${rows.slice(0, 3).map((e) => `${e.rank}. ${e.name}`).join('  ')}…`, ``,
    `Agree? Who's robbed? 👇  Full list on mythique.app`, ``,
    `#ranking #whowouldwin #powerscaling #comics #anime #mythique`,
  ].join('\n'));
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
