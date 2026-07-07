#!/usr/bin/env node
// Website hero + OG share card. A left-aligned landing composition (not a centred
// social post): eyebrow, headline, subhead, pill CTA, with a faint hex-grid motif
// echoing the powerstats grid. Zero character IP.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR, renderPng } from '../lib.mjs';
import { adShell } from './shell.mjs';

const SIZES = { '16x9': [1920, 1080], og: [1200, 630], wide: [2400, 900] };
const GOLD = '#e0a83e', CREAM = '#f6eddd', MUTED = '#9db4c4';

async function heroCount(sb) {
  try {
    const r = await fetch(`${sb.url}/rest/v1/heroes?select=id&limit=1`, { headers: { ...sb.headers, Prefer: 'count=exact', Range: '0-0' } });
    const cr = r.headers.get('content-range');
    const n = cr && parseInt(cr.split('/')[1], 10);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
const nice = (c) => (c ? `${(Math.floor(c / 1000) * 1000).toLocaleString('en-US')}+` : '35,000+');

// Faint concentric-hexagon motif for the right side.
function hexMotif(cx, cy, R) {
  const pt = (i, r) => [cx + r * Math.cos(((-90 + 60 * i) * Math.PI) / 180), cy + r * Math.sin(((-90 + 60 * i) * Math.PI) / 180)];
  const poly = (r) => Array.from({ length: 6 }, (_, i) => pt(i, r).map((n) => n.toFixed(0)).join(',')).join(' ');
  let s = '';
  for (const f of [0.28, 0.5, 0.72, 0.94]) s += `<polygon points="${poly(R * f)}" fill="none" stroke="rgba(224,168,62,0.16)" stroke-width="1.5"/>`;
  for (let i = 0; i < 6; i++) { const [x, y] = pt(i, R * 0.94); s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(0)}" y2="${y.toFixed(0)}" stroke="rgba(224,168,62,0.1)" stroke-width="1"/>`; }
  return s;
}

function hero(count, w, h) {
  const motifR = h * 0.42, mcx = w * 0.82, mcy = h * 0.5;
  const motif = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0"><defs><radialGradient id="mg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${GOLD}" stop-opacity="0.05"/><stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs><circle cx="${mcx}" cy="${mcy}" r="${motifR * 1.1}" fill="url(#mg)"/>${hexMotif(mcx, mcy, motifR)}</svg>`;
  const inner = `<div style="position:absolute;left:${Math.round(w * 0.08)}px;top:0;bottom:${Math.round(h * 0.12)}px;width:${Math.round(w * 0.62)}px;display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:${Math.round(h * 0.028)}px;letter-spacing:.24em;color:${GOLD};margin-bottom:${Math.round(h * 0.03)}px">THE HERO &amp; VILLAIN ENCYCLOPEDIA</div>
    <div class="pop" style="font-size:${Math.round(h * 0.115)}px;line-height:.98;color:${CREAM}">${nice(count)} legends,<br>one universe.</div>
    <div style="font-size:${Math.round(h * 0.04)}px;color:${MUTED};margin-top:${Math.round(h * 0.03)}px;max-width:${Math.round(w * 0.52)}px">Powers, matchups, rankings and lore for every hero and villain — ranked &amp; rated.</div>
    <div style="margin-top:${Math.round(h * 0.05)}px"><span style="display:inline-block;background:${GOLD};color:#3a2708;font-family:'FR';font-size:${Math.round(h * 0.036)}px;padding:${Math.round(h * 0.022)}px ${Math.round(h * 0.045)}px;border-radius:${Math.round(h * 0.06)}px">Explore free · mythique.app →</span></div>
  </div>`;
  return `${motif}${inner}`;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const wantSize = get('--size', 'all');
  const sizes = wantSize === 'all' ? Object.keys(SIZES) : [wantSize];
  if (sizes.some((s) => !SIZES[s])) { console.error('--size:', Object.keys(SIZES).join(', '), 'or all'); process.exit(1); }

  const sb = makeSb(loadEnv());
  const count = await heroCount(sb);
  const F = fonts();
  const dir = join(OUT_DIR, 'ad-web-hero');
  mkdirSync(dir, { recursive: true });
  for (const s of sizes) {
    const [w, h] = SIZES[s];
    await renderPng(adShell(F, { w, h }, hero(count, w, h)), join(dir, `${s}.png`), w, h);
    console.log(`  -> ${join(dir, `${s}.png`)}`);
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
