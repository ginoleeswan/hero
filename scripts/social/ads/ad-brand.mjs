#!/usr/bin/env node
// Catalogue-scale brand ad — zero character IP. The safest paid creative:
// leans entirely on Mythique's brand, design system, and catalogue scale.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR, renderPng } from '../lib.mjs';
import { adShell } from './shell.mjs';

const SIZES = { '1x1': [1080, 1080], '4x5': [1080, 1350], '9x16': [1080, 1920], '16x9': [1920, 1080], og: [1200, 630] };

async function heroCount(sb) {
  // exact count via PostgREST count header; fall back to null
  try {
    const r = await fetch(`${sb.url}/rest/v1/heroes?select=id&limit=1`, { headers: { ...sb.headers, Prefer: 'count=exact', Range: '0-0' } });
    const cr = r.headers.get('content-range'); // e.g. "0-0/35557"
    const n = cr && parseInt(cr.split('/')[1], 10);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

function body(count, F, w, h) {
  const big = Math.round(h * 0.11);
  const n = count ? `${(Math.floor(count / 1000) * 1000).toLocaleString()}+` : '30,000+';
  const pad = Math.round(w * 0.08);
  return adShell(F, { w, h }, `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${pad}px">
    <div style="font-size:${Math.round(h * 0.03)}px;letter-spacing:8px;color:#e0a83e;margin-bottom:${Math.round(h * 0.03)}px">THE HERO &amp; VILLAIN ENCYCLOPEDIA</div>
    <div class="pop" style="font-size:${big}px;line-height:1;color:#e0a83e">${n}</div>
    <div style="font-size:${Math.round(h * 0.05)}px;margin:${Math.round(h * 0.01)}px 0 ${Math.round(h * 0.04)}px">heroes &amp; villains, ranked &amp; rated</div>
    <div style="font-size:${Math.round(h * 0.032)}px;color:#9db4c4">powers · matchups · rankings · lore</div>
    <div style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px" class="g">mythique.app</div>
  </div>`);
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const want = get('--size', '1x1');
  const sizes = want === 'all' ? Object.keys(SIZES) : [want];
  if (sizes.some((s) => !SIZES[s])) { console.error('--size must be one of:', Object.keys(SIZES).join(', '), 'or all'); process.exit(1); }

  const sb = makeSb(loadEnv());
  const count = await heroCount(sb);
  const F = fonts();
  const dir = join(OUT_DIR, 'ad-brand');
  mkdirSync(dir, { recursive: true });
  for (const s of sizes) {
    const [w, h] = SIZES[s];
    await renderPng(body(count, F, w, h), join(dir, `${s}.png`), w, h);
    console.log(`  -> ${join(dir, `${s}.png`)}`);
  }
  writeFileSync(join(dir, 'caption.txt'), [
    `The whole comic-book multiverse, ranked. ⚡`, ``,
    `${count ? count.toLocaleString() : '30,000+'} heroes & villains — powers, matchups, rankings & lore.`, ``,
    `Explore free on mythique.app`, ``,
    `#superheroes #comics #anime #whowouldwin #mythique`,
  ].join('\n'));
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
