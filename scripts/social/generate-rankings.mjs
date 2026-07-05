#!/usr/bin/env node
// Mythique ranking carousels — "Top N" leaderboards built on the catalogue's
// data, including the proprietary fame_score. A countdown carousel: cover, the
// ranked list (counting down to #1), and a CTA.
//
//   node scripts/social/generate-rankings.mjs                          # top 10 most famous
//   node scripts/social/generate-rankings.mjs --alignment bad          # most famous villains
//   node scripts/social/generate-rankings.mjs --by strength            # strongest characters
//   node scripts/social/generate-rankings.mjs --by intelligence --publisher "Marvel Comics"
//   node scripts/social/generate-rankings.mjs --alignment bad --dry-run
//
// See ./README.md. Shared data layer + slide shell live in ./lib.mjs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, imgDataUri, fonts, OUT_DIR, renderPng, COLORS, slide } from './lib.mjs';

const { O, T, GOLD, CREAM, NAVY } = COLORS;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

const METRIC_WORD = {
  fame: 'MOST FAMOUS', strength: 'STRONGEST', speed: 'FASTEST',
  intelligence: 'SMARTEST', durability: 'TOUGHEST', power: 'MOST POWERFUL', combat: 'DEADLIEST',
};
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

function titles(opts) {
  const mw = METRIC_WORD[opts.by] || 'TOP';
  const scope = opts.alignment === 'bad' ? 'VILLAINS'
    : opts.alignment === 'good' ? 'HEROES'
      : opts.publisher ? `${opts.publisher.replace(/\s+comics?$/i, '').toUpperCase()} CHARACTERS`
        : 'CHARACTERS';
  const title = opts.title || `TOP ${opts.count} ${mw} ${scope}`;
  const sub = opts.by === 'fame' ? 'RANKED BY MYTHIQUE FAME SCORE' : `RANKED BY ${opts.by.toUpperCase()}`;
  return { title, sub };
}

async function fetchRanking(sb, opts) {
  const metric = opts.by === 'fame' ? 'fame_score' : opts.by;
  const cols = ['id', 'name', 'portrait_url', 'image_url', 'image_md_url', 'publisher', 'alignment', 'fame_score'];
  if (opts.by !== 'fame') cols.push(opts.by);
  let filter = '';
  if (opts.alignment) filter += `&alignment=eq.${opts.alignment}`;
  if (opts.publisher) filter += `&publisher=eq.${encodeURIComponent(opts.publisher)}`;
  let order;
  if (opts.by === 'fame') order = 'fame_score.desc';
  else { filter += `&${opts.by}=not.is.null`; order = `${opts.by}.desc.nullslast,fame_score.desc`; }
  const rows = await sb.rest(`heroes?select=${cols.join(',')}${filter}&order=${order}&limit=${opts.count}`);
  return rows.map((r, i) => ({ ...r, rank: i + 1, value: r[metric] ?? 0 }));
}

// ---- slides ----
function slideCover(t, F) {
  return slide(F, `<div class="body">
    <div style="font-size:38px;letter-spacing:8px;color:${GOLD};margin-bottom:34px">THE RANKING</div>
    <div style="font-size:104px;line-height:1.04;color:${CREAM};margin-bottom:40px" class="stroke">${esc(t.title)}</div>
    <div style="font-size:38px;letter-spacing:4px;color:${GOLD};margin-bottom:80px">${esc(t.sub)}</div>
    <div style="font-family:'S';font-size:40px;color:#9db4c4">swipe to count down →</div></div>`);
}

function rankRow(e) {
  const top = e.rank === 1;
  const border = top ? GOLD : 'rgba(224,168,62,.45)';
  const bg = top ? 'background:rgba(224,168,62,.10);border:2px solid rgba(224,168,62,.4);' : 'border-bottom:1px solid rgba(245,235,220,.08);';
  const size = top ? 150 : 112;
  return `<div style="display:flex;align-items:center;gap:26px;width:100%;padding:${top ? '22px 26px' : '16px 8px'};border-radius:${top ? '28px' : '0'};${bg}">
      <span class="pop" style="width:120px;text-align:center;font-size:${top ? 96 : 68}px;color:${GOLD}">${e.rank}</span>
      <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:5px solid ${border};flex:none;box-shadow:0 8px 24px rgba(0,0,0,.5)"><img src="${e.img}" style="width:100%;height:100%;object-fit:cover"></div>
      <span style="flex:1;text-align:left;font-family:'S';font-size:${top ? 58 : 48}px;color:${CREAM};line-height:1.05">${esc(clip(e.name, 22))}</span>
      <span class="pop" style="font-size:${top ? 78 : 60}px;color:${top ? GOLD : CREAM}">${e.value}</span></div>`;
}

function slideRanks(t, rows, F, showTitle) {
  const list = rows.map(rankRow).join('');
  const head = showTitle ? `<div class="h1" style="font-size:52px">${esc(t.title)}</div>` : '';
  return slide(F, `<div class="body">${head}<div class="full" style="display:flex;flex-direction:column;gap:14px">${list}</div></div>`);
}

function slideCta(t, F) {
  return slide(F, `<div class="body">
    <div style="font-size:56px;color:${CREAM};margin-bottom:66px">see the full ranking &amp;<br>every character on</div>
    <div style="font-size:96px;margin-bottom:90px" class="stroke"><span class="g">mythique.app</span></div>
    <div style="font-size:64px;margin-bottom:16px" class="stroke">follow <span class="g">@mythiqueapp</span></div>
    <div style="font-family:'S';font-size:38px;color:#9db4c4">daily matchups, rankings &amp; character files</div></div>`);
}

function caption(t, rows) {
  const top3 = rows.slice(0, 3).map((e, i) => `${i + 1}. ${e.name}`).join('   ');
  return [
    `${t.title.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase())} 🏆`, ``,
    `${top3}...`, ``,
    `Agree with the ranking? Who's robbed? 👇`,
    `Full leaderboard + every character on mythique.app`, ``,
    `#ranking #whowouldwin #superheroes #comics #anime #marvel #dc #powerscaling #mythique`,
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const opts = {
    by: (get('--by', 'fame')).toLowerCase(),
    alignment: get('--alignment', null),
    publisher: get('--publisher', null),
    count: parseInt(get('--count', '10'), 10),
    title: get('--title', null),
  };
  const dry = args.includes('--dry-run');
  if (!METRIC_WORD[opts.by]) { console.error('--by must be one of:', Object.keys(METRIC_WORD).join(', ')); process.exit(1); }

  const sb = makeSb(loadEnv());
  const t = titles(opts);
  const rows = await fetchRanking(sb, opts);
  if (!rows.length) { console.error('No characters matched that filter.'); process.exit(1); }

  console.log(`\n${t.title}  (${t.sub})`);
  for (const e of rows) console.log(`  #${e.rank}  ${e.name}  —  ${e.value}`);
  if (dry) return;

  // fetch portrait thumbs
  for (const e of rows) e.img = await imgDataUri(e.portrait_url || e.image_md_url || e.image_url);
  const valid = rows.filter((e) => e.img);

  // countdown: highest rank first, #1 last; 5 per slide
  const desc = [...valid].reverse();
  const pages = chunk(desc, 5);

  const F = fonts();
  const slides = [slideCover(t, F)];
  pages.forEach((pg, i) => slides.push(slideRanks(t, pg, F, i === 0)));
  slides.push(slideCta(t, F));

  const slug = t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dir = join(OUT_DIR, `ranking-${slug}`);
  mkdirSync(dir, { recursive: true });
  console.log(`\nRendering ${slides.length} slides...`);
  for (let i = 0; i < slides.length; i++) await renderPng(slides[i], join(dir, `slide-${i + 1}.png`), 1080, 1350);
  writeFileSync(join(dir, 'caption.txt'), caption(t, valid));
  console.log(`  -> ${dir}\nDone. Upload slides in order as an Instagram carousel.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
