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

const { GOLD, CREAM } = COLORS;
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

// "Strongest" and "Most Powerful" are overall-might framings, so rank them by the
// weighted power_rating composite — a single 0-100 stat ties hard at the ceiling
// (154 characters at power=100, 92 at strength=100), giving a wall of identical
// 100s. Single-attribute boards (smartest/fastest/toughest/deadliest) keep their
// raw stat. Composite values display to one decimal so the countdown descends.
const COMPOSITE_BY = new Set(['strength', 'power']);

async function fetchRanking(sb, opts) {
  const composite = COMPOSITE_BY.has(opts.by);
  const metric = opts.by === 'fame' ? 'fame_score' : composite ? 'power_rating' : opts.by;
  const cols = ['id', 'name', 'portrait_url', 'image_url', 'image_md_url', 'publisher', 'alignment', 'fame_score'];
  if (opts.by !== 'fame') cols.push(metric);
  let filter = '';
  if (opts.alignment) filter += `&alignment=eq.${opts.alignment}`;
  if (opts.publisher) filter += `&publisher=eq.${encodeURIComponent(opts.publisher)}`;
  if (opts.minFame > 0) filter += `&fame_score=gte.${opts.minFame}`;
  let order;
  // issue_count tiebreak: many heroes tie on fame; without it the list order is
  // arbitrary and changes between runs (Elmer Fudd once outranked Venom).
  if (opts.by === 'fame') order = 'fame_score.desc,issue_count.desc.nullslast';
  else { filter += `&${metric}=not.is.null`; order = `${metric}.desc.nullslast,fame_score.desc,issue_count.desc.nullslast`; }
  const rows = await sb.rest(`heroes?select=${cols.join(',')}${filter}&order=${order}&limit=${opts.count}`);
  return rows.map((r, i) => ({ ...r, rank: i + 1, value: composite ? Number(r[metric] ?? 0).toFixed(1) : (r[metric] ?? 0) }));
}

// ---- slides ----
// Overlapping avatar row — the composition anchor for cover + finale.
function avatarRow(imgs, size, bigIdx = -1) {
  const rings = [GOLD, '#e8823a', '#37a3c4'];
  const items = imgs.map((src, i) => {
    const big = i === bigIdx;
    const s = big ? Math.round(size * 1.22) : size;
    const ring = big ? GOLD : `${rings[i % 3]}88`;
    const z = big ? 9 : 5 - Math.abs(i - Math.floor(imgs.length / 2));
    return `<div style="width:${s}px;height:${s}px;border-radius:50%;overflow:hidden;border:6px solid ${ring};flex:none;box-shadow:0 16px 40px rgba(0,0,0,.6);margin-left:${i ? -Math.round(size * 0.24) : 0}px;position:relative;z-index:${z};${big ? `box-shadow:0 0 60px rgba(224,168,62,.35),0 16px 40px rgba(0,0,0,.6);` : ''}">
      <img src="${src}" style="width:100%;height:100%;object-fit:cover"></div>`;
  }).join('');
  return `<div style="display:flex;align-items:center;justify-content:center">${items}</div>`;
}

function slideCover(t, F, faces) {
  return slide(F, `<div class="body">
    <div style="font-size:36px;letter-spacing:8px;color:${GOLD};margin-bottom:30px">THE RANKING</div>
    <div style="font-size:100px;line-height:1.04;color:${CREAM};margin-bottom:30px" class="stroke">${esc(t.title)}</div>
    <div style="font-size:34px;letter-spacing:4px;color:${GOLD}">${esc(t.sub)}</div>
    ${faces.length ? `<div style="margin:64px 0 70px">${avatarRow(faces, 176)}</div>` : '<div style="height:70px"></div>'}
    <div style="font-family:'S';font-size:40px;color:#9db4c4">swipe to count down →</div></div>`);
}

function rankRow(e) {
  const top = e.rank === 1;
  const border = top ? GOLD : 'rgba(224,168,62,.4)';
  const bg = top ? 'background:rgba(224,168,62,.10);border:2px solid rgba(224,168,62,.45);' : 'border-bottom:1px solid rgba(245,235,220,.08);';
  const size = top ? 180 : 142;
  return `<div style="display:flex;align-items:center;gap:32px;width:100%;padding:${top ? '26px 30px' : '14px 10px'};border-radius:${top ? '32px' : '0'};${bg}">
      <span class="pop" style="width:112px;text-align:center;font-size:${top ? 100 : 70}px;color:${GOLD}">${e.rank}</span>
      <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:6px solid ${border};flex:none;box-shadow:0 10px 28px rgba(0,0,0,.55)"><img src="${e.img}" style="width:100%;height:100%;object-fit:cover"></div>
      <div style="flex:1;min-width:0;text-align:left">
        <div style="font-family:'S';font-size:${top ? 64 : 54}px;color:${CREAM};line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(clip(e.name, 20))}</div>
        <div style="font-family:'FR';font-size:27px;letter-spacing:3px;color:${top ? GOLD : '#9db4c4'};margin-top:4px">FAME ${e.value}</div>
      </div></div>`;
}

function slideRanks(t, rows, F, showTitle) {
  const list = rows.map(rankRow).join('');
  const head = showTitle ? `<div class="h1" style="font-size:52px;margin-bottom:30px">${esc(t.title)}</div>` : '';
  return slide(F, `<div class="body">${head}<div class="full" style="display:flex;flex-direction:column;justify-content:space-evenly;flex:1;min-height:0">${list}</div></div>`);
}

function slideCta(t, F, podium) {
  return slide(F, `<div class="body">
    ${podium.length ? `<div style="margin-bottom:56px">${avatarRow(podium, 172, 1)}</div>` : ''}
    <div style="font-size:54px;color:${CREAM};margin-bottom:50px">see the full ranking &amp;<br>every character on</div>
    <div style="font-size:92px;margin-bottom:70px" class="stroke"><span class="g">mythique.app</span></div>
    <div style="font-size:58px;margin-bottom:14px" class="stroke">follow <span class="g">@mythiqueapp</span></div>
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
    // Floor out unrecognizable characters (obscure all-100 cosmic beings otherwise
    // top the stat boards). Overridable with --min-fame 0 for a full sweep.
    minFame: parseInt(get('--min-fame', '20'), 10),
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

  // cover: top-5 faces, order scrambled so the countdown isn't spoiled;
  // finale: the podium (2nd, 1st big, 3rd) — earned after the reveal.
  const top5 = valid.slice(0, 5).map((e) => e.img);
  const faces = [top5[3], top5[0], top5[2], top5[1], top5[4]].filter(Boolean); // centre ≠ #1 (no spoiler)
  const podium = valid.length >= 3 ? [valid[1].img, valid[0].img, valid[2].img] : [];

  const F = fonts();
  const slides = [slideCover(t, F, faces)];
  pages.forEach((pg, i) => slides.push(slideRanks(t, pg, F, i === 0)));
  slides.push(slideCta(t, F, podium));

  const slug = t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dir = join(OUT_DIR, `ranking-${slug}`);
  mkdirSync(dir, { recursive: true });
  console.log(`\nRendering ${slides.length} slides...`);
  for (let i = 0; i < slides.length; i++) await renderPng(slides[i], join(dir, `slide-${i + 1}.png`), 1080, 1350);
  writeFileSync(join(dir, 'caption.txt'), caption(t, valid));
  console.log(`  -> ${dir}\nDone. Upload slides in order as an Instagram carousel.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
