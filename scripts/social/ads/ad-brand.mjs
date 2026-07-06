#!/usr/bin/env node
// Brand ads — zero character IP. Each --style derives from a different true facet
// of the app (scale, relationship graph, powerstats, debate, rankings, dossier),
// so the creative has range without ever leaning on a franchise character.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR, renderPng } from '../lib.mjs';
import { adShell } from './shell.mjs';

const SIZES = { '1x1': [1080, 1080], '4x5': [1080, 1350], '9x16': [1080, 1920], '16x9': [1920, 1080], og: [1200, 630] };
const GOLD = '#e0a83e', ORANGE = '#e8823a', TEAL = '#4fb3d0', CREAM = '#f6eddd', MUTED = '#9db4c4';

async function heroCount(sb) {
  try {
    const r = await fetch(`${sb.url}/rest/v1/heroes?select=id&limit=1`, { headers: { ...sb.headers, Prefer: 'count=exact', Range: '0-0' } });
    const cr = r.headers.get('content-range');
    const n = cr && parseInt(cr.split('/')[1], 10);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
const nice = (count) => (count ? `${(Math.floor(count / 1000) * 1000).toLocaleString()}+` : '35,000+');

// A centred stage that clears the shell's footer.
const stage = (w, h, inner, extra = '') =>
  `<div style="position:absolute;left:0;right:0;top:0;bottom:${Math.round(h * 0.12)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${Math.round(w * 0.08)}px;${extra}">${inner}</div>`;
const eyebrow = (h, t, color = GOLD) => `<div style="font-size:${Math.round(h * 0.028)}px;letter-spacing:.24em;color:${color};margin-bottom:${Math.round(h * 0.028)}px">${t}</div>`;
const cta = (h) => `<div style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px" class="g pop" >mythique.app</div>`;

// seeded PRNG for a deterministic constellation
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function constellationSvg(w, h) {
  const r = rng(7);
  const N = Math.round((w * h) / 26000);
  const nodes = Array.from({ length: N }, () => ({ x: r() * w, y: r() * h, big: r() > 0.86 }));
  const col = () => { const v = r(); return v > 0.9 ? TEAL : v > 0.8 ? ORANGE : GOLD; };
  let edges = '';
  for (let i = 0; i < nodes.length; i++) {
    const d = nodes.map((n, j) => ({ j, d: (n.x - nodes[i].x) ** 2 + (n.y - nodes[i].y) ** 2 })).sort((a, b) => a.d - b.d).slice(1, 3);
    for (const { j } of d) if (j > i) edges += `<line x1="${nodes[i].x.toFixed(0)}" y1="${nodes[i].y.toFixed(0)}" x2="${nodes[j].x.toFixed(0)}" y2="${nodes[j].y.toFixed(0)}" stroke="${GOLD}" stroke-width="1" stroke-opacity="0.14"/>`;
  }
  const dots = nodes.map((n) => {
    const rad = n.big ? 7 : 3 + r() * 2, c = col();
    const halo = n.big ? `<circle cx="${n.x.toFixed(0)}" cy="${n.y.toFixed(0)}" r="${(rad * 3).toFixed(0)}" fill="${c}" opacity="0.08"/>` : '';
    return `${halo}<circle cx="${n.x.toFixed(0)}" cy="${n.y.toFixed(0)}" r="${rad.toFixed(1)}" fill="${c}" opacity="${n.big ? 1 : 0.5 + r() * 0.4}"/>`;
  }).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0">${edges}${dots}</svg>`;
}

// Hexagonal power-grid (radar) — the iconic superhero-stats visual.
function radar(size) {
  const stats = [['INTELLIGENCE', 88], ['STRENGTH', 74], ['SPEED', 92], ['DURABILITY', 69], ['POWER', 84], ['COMBAT', 78]];
  const cx = size / 2, cy = size / 2, R = size * 0.27;
  const ang = (i) => ((-90 + 60 * i) * Math.PI) / 180;
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const poly = (r) => stats.map((_, i) => pt(i, r).map((n) => n.toFixed(1)).join(',')).join(' ');
  let rings = '';
  for (const f of [0.25, 0.5, 0.75, 1]) rings += `<polygon points="${poly(R * f)}" fill="none" stroke="rgba(246,237,221,0.09)" stroke-width="1"/>`;
  let spokes = '';
  for (let i = 0; i < 6; i++) { const [x, y] = pt(i, R); spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(246,237,221,0.07)" stroke-width="1"/>`; }
  const dp = stats.map(([, v], i) => pt(i, (R * v) / 100).map((n) => n.toFixed(1)).join(',')).join(' ');
  const dots = stats.map(([, v], i) => { const [x, y] = pt(i, (R * v) / 100); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(size * 0.008).toFixed(1)}" fill="${GOLD}"/>`; }).join('');
  const labs = stats.map(([l, v], i) => {
    const [x, y] = pt(i, R * 1.26);
    const anchor = Math.abs(x - cx) < size * 0.03 ? 'middle' : x > cx ? 'start' : 'end';
    const fs = (size * 0.03).toFixed(0);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" style="font-family:'S';font-size:${fs}px;letter-spacing:.06em;fill:${MUTED}">${l} <tspan fill="${GOLD}">${v}</tspan></text>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><radialGradient id="rg" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="${GOLD}" stop-opacity="0.34"/><stop offset="100%" stop-color="${ORANGE}" stop-opacity="0.14"/></radialGradient></defs>${rings}${spokes}<polygon points="${dp}" fill="url(#rg)" stroke="${GOLD}" stroke-width="${(size * 0.005).toFixed(1)}" stroke-linejoin="round"/>${dots}${labs}</svg>`;
}

const STYLES = {
  // 1 — the sheer size of the catalogue
  scale: (w, h, d) => stage(w, h,
    `${eyebrow(h, 'THE HERO &amp; VILLAIN ENCYCLOPEDIA')}
     <div class="pop" style="font-size:${Math.round(h * 0.155)}px;line-height:.92;color:${GOLD}">${nice(d.count)}</div>
     <div style="font-size:${Math.round(h * 0.05)}px;margin:${Math.round(h * 0.012)}px 0 ${Math.round(h * 0.038)}px">heroes &amp; villains, ranked &amp; rated</div>
     <div style="font-size:${Math.round(h * 0.03)}px;color:${MUTED}">powers · matchups · rankings · lore</div>
     ${cta(h)}`),

  // 2 — the relationship graph / Social Web
  constellation: (w, h, d) => `${constellationSvg(w, h)}
    <div style="position:absolute;inset:0;background:radial-gradient(46% 34% at 50% 46%, rgba(6,18,26,.92) 0%, rgba(6,18,26,.5) 55%, transparent 78%)"></div>
    ${stage(w, h,
    `${eyebrow(h, 'THE SOCIAL WEB', TEAL)}
       <div class="pop" style="font-size:${Math.round(h * 0.072)}px;line-height:1.02;color:${CREAM}">Everyone is<br>connected.</div>
       <div style="font-size:${Math.round(h * 0.032)}px;color:${MUTED};margin-top:${Math.round(h * 0.028)}px;max-width:${Math.round(w * 0.7)}px">${nice(d.count)} heroes &amp; villains — allies, rivals, families, teams.</div>
       ${cta(h)}`)}`,

  // 3 — the powerstats rating system, as a hexagonal power grid
  powerstats: (w, h, d) => stage(w, h,
    `${eyebrow(h, 'SIX POWERS · ONE GRID')}
     <div class="pop" style="font-size:${Math.round(h * 0.062)}px;line-height:1;color:${CREAM};margin-bottom:${Math.round(h * 0.01)}px">Every hero, rated.</div>
     <div style="margin:${Math.round(h * 0.005)}px 0">${radar(Math.round(Math.min(w, h) * 0.62))}</div>
     ${cta(h)}`),

  // 4 — the debate / vote hub (no faces)
  versus: (w, h, d) => {
    const plate = Math.round(w * 0.28);
    const p = (glyph, c) => `<div style="width:${plate}px;height:${plate}px;border-radius:26%;background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.01));border:2px solid ${c};display:flex;align-items:center;justify-content:center;box-shadow:0 20px 50px -20px rgba(0,0,0,.7)"><span class="pop" style="font-size:${Math.round(plate * 0.5)}px;color:${c}">?</span></div>`;
    return stage(w, h,
      `${eyebrow(h, 'SETTLE THE ARGUMENT')}
       <div style="display:flex;align-items:center;gap:${Math.round(w * 0.045)}px;margin-bottom:${Math.round(h * 0.04)}px">
         ${p('?', ORANGE)}<span class="pop" style="font-size:${Math.round(h * 0.07)}px;color:${GOLD}">VS</span>${p('?', TEAL)}</div>
       <div class="pop" style="font-size:${Math.round(h * 0.06)}px;color:${CREAM}">Who would win?</div>
       <div style="font-size:${Math.round(h * 0.032)}px;color:${MUTED};margin-top:${Math.round(h * 0.014)}px">You decide. Cast your vote.</div>
       ${cta(h)}`);
  },

  // 5 — the rankings / fame score
  leaderboard: (w, h, d) => {
    const rows = [['1', 96], ['2', 88], ['3', 79], ['4', 71], ['5', 64]];
    const list = rows.map(([rank, pct]) => {
      const top = rank === '1';
      return `<div style="display:flex;align-items:center;gap:${Math.round(w * 0.025)}px;width:100%;padding:${Math.round(h * 0.006)}px 0">
        <span class="pop" style="font-size:${Math.round(h * (top ? 0.06 : 0.045))}px;color:${GOLD};width:${Math.round(w * 0.1)}px;text-align:center">${rank}</span>
        <div style="flex:1;height:${Math.round(h * (top ? 0.05 : 0.036))}px;border-radius:14px;background:${top ? 'rgba(224,168,62,.16)' : 'rgba(255,255,255,.05)'};border:1px solid ${top ? GOLD : 'rgba(255,255,255,.06)'};overflow:hidden">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,rgba(232,130,58,.5),rgba(224,168,62,.35))"></div></div></div>`;
    }).join('');
    return stage(w, h,
      `${eyebrow(h, 'THE RANKINGS')}
       <div class="pop" style="font-size:${Math.round(h * 0.062)}px;color:${CREAM};margin-bottom:${Math.round(h * 0.03)}px">Who's really #1?</div>
       <div style="width:100%;max-width:${Math.round(w * 0.8)}px">${list}</div>
       <div style="font-size:${Math.round(h * 0.028)}px;color:${MUTED};margin-top:${Math.round(h * 0.022)}px">Ranked by the Mythique fame score.</div>
       ${cta(h)}`);
  },

  // 6 — the encyclopedia dossier (redaction as the IP-safe device)
  dossier: (w, h, d) => {
    const cardW = Math.round(w * 0.74);
    const red = (units) => `<span style="display:inline-block;height:${Math.round(h * 0.02)}px;width:${units}px;background:${CREAM};opacity:.82;border-radius:3px;vertical-align:middle"></span>`;
    const field = (k, v) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:${Math.round(h * 0.014)}px 0;border-bottom:1px solid rgba(224,168,62,.14)">
      <span style="font-family:'S';font-size:${Math.round(h * 0.019)}px;letter-spacing:.14em;color:${MUTED}">${k}</span><span>${v}</span></div>`;
    const meter = `<div style="display:inline-flex;gap:5px;vertical-align:middle">${[1, 1, 1, 1, 0].map((on) => `<span style="width:${Math.round(w * 0.03)}px;height:${Math.round(h * 0.018)}px;border-radius:3px;background:${on ? GOLD : 'rgba(255,255,255,.12)'}"></span>`).join('')}</div>`;
    return stage(w, h,
      `${eyebrow(h, 'MYTHIQUE · CLASSIFIED FILE')}
       <div style="width:${cardW}px;background:linear-gradient(180deg,rgba(18,40,58,.85),rgba(11,28,39,.85));border:1px solid rgba(224,168,62,.28);border-radius:${Math.round(h * 0.02)}px;padding:${Math.round(h * 0.032)}px ${Math.round(w * 0.045)}px;text-align:left;box-shadow:0 24px 60px -28px rgba(0,0,0,.8)">
         <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:${Math.round(h * 0.01)}px">
           <span style="font-family:'S';font-size:${Math.round(h * 0.02)}px;letter-spacing:.1em;color:${MUTED}">FILE No.</span><span>${red(Math.round(w * 0.11))}</span></div>
         <div style="font-size:${Math.round(h * 0.05)}px;color:${CREAM};margin-bottom:${Math.round(h * 0.016)}px" class="pop">${red(Math.round(w * 0.42))}</div>
         ${field('ALIGNMENT', red(Math.round(w * 0.16)))}
         ${field('FIRST APPEARANCE', red(Math.round(w * 0.22)))}
         ${field('THREAT LEVEL', meter)}
         ${field('POWERS', red(Math.round(w * 0.28)))}
       </div>
       <div style="font-size:${Math.round(h * 0.03)}px;color:${MUTED};margin-top:${Math.round(h * 0.03)}px">One of ${nice(d.count)} files. Open the whole archive.</div>
       ${cta(h)}`);
  },
};

async function main() {
  const args = process.argv.slice(2);
  const get = (f, dv) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : dv; };
  const style = get('--style', 'scale');
  const wantSize = get('--size', '1x1');
  const styles = style === 'all' ? Object.keys(STYLES) : [style];
  const sizes = wantSize === 'all' ? Object.keys(SIZES) : [wantSize];
  if (styles.some((s) => !STYLES[s])) { console.error('--style:', Object.keys(STYLES).join(', '), 'or all'); process.exit(1); }
  if (sizes.some((s) => !SIZES[s])) { console.error('--size:', Object.keys(SIZES).join(', '), 'or all'); process.exit(1); }

  const sb = makeSb(loadEnv());
  const count = await heroCount(sb);
  const F = fonts();
  const dir = join(OUT_DIR, 'ad-brand');
  mkdirSync(dir, { recursive: true });
  const d = { count };
  for (const s of styles) for (const sz of sizes) {
    const [w, h] = SIZES[sz];
    await renderPng(adShell(F, { w, h }, STYLES[s](w, h, d)), join(dir, `${s}-${sz}.png`), w, h);
    console.log(`  -> ${join(dir, `${s}-${sz}.png`)}`);
  }
  writeFileSync(join(dir, 'caption.txt'), [
    `The whole comic-book multiverse, ranked. ⚡`, ``,
    `${count ? count.toLocaleString() : '35,000+'} heroes & villains — powers, matchups, rankings & lore.`, ``,
    `Explore free on mythique.app`, ``,
    `#superheroes #comics #anime #whowouldwin #mythique`,
  ].join('\n'));
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
