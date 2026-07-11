#!/usr/bin/env node
// Brand ads — zero character IP. Each --style derives from a different true facet
// of the app (scale, relationship graph, powerstats, debate, rankings, dossier),
// so the creative has range without ever leaning on a franchise character.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR, renderPng, ROOT } from '../lib.mjs';
import { adShell } from './shell.mjs';
import { rng } from './plan.mjs';

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
const nice = (count) => (count ? `${(Math.floor(count / 1000) * 1000).toLocaleString('en-US')}+` : '35,000+');

// A centred stage that clears the shell's footer. Offsets are balanced (a small
// top inset vs. the footer clearance) so content sits at the true optical centre
// instead of riding high — the fix for the old top-heavy / dead-bottom look.
const stage = (w, h, inner, extra = '') =>
  `<div style="position:absolute;left:0;right:0;top:${Math.round(h * 0.055)}px;bottom:${Math.round(h * 0.11)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${Math.round(w * 0.08)}px;${extra}">${inner}</div>`;
// Left-anchored stack (vertically centred) — ratio-safe compositional variety.
const stageLeft = (w, h, inner, wid = 0.74) =>
  `<div style="position:absolute;left:${Math.round(w * 0.09)}px;top:${Math.round(h * 0.055)}px;bottom:${Math.round(h * 0.11)}px;width:${Math.round(w * wid)}px;display:flex;flex-direction:column;justify-content:center;text-align:left">${inner}</div>`;
// Bottom-left corner anchor — for text over a full-bleed visual.
const stageCorner = (w, h, inner, wid = 0.6) =>
  `<div style="position:absolute;left:${Math.round(w * 0.08)}px;bottom:${Math.round(h * 0.155)}px;width:${Math.round(w * wid)}px;text-align:left">${inner}</div>`;
const eyebrow = (h, t, color = GOLD) => `<div style="font-size:${Math.round(h * 0.028)}px;letter-spacing:.24em;color:${color};margin-bottom:${Math.round(h * 0.028)}px">${t}</div>`;
const cta = (h, top = 0.045) => `<div style="font-size:${Math.round(h * 0.034)}px;letter-spacing:.5px;margin-top:${Math.round(h * top)}px" class="g pop">mythique.app&thinsp;→</div>`;

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

// Hexagonal power-grid (radar) — the iconic superhero-stats visual. Box is
// cropped to the content's true bounds (no dead vertical padding).
function radar(width) {
  const stats = [['INTELLIGENCE', 88], ['STRENGTH', 74], ['SPEED', 92], ['DURABILITY', 69], ['POWER', 84], ['COMBAT', 78]];
  const R = width * 0.30, fs = width * 0.03, cx = width / 2, LR = 1.16;
  const pad = fs * 1.6, cy = R * LR + pad, H = Math.round(cy + R * LR + pad);
  const ang = (i) => ((-90 + 60 * i) * Math.PI) / 180;
  const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const poly = (r) => stats.map((_, i) => pt(i, r).map((n) => n.toFixed(1)).join(',')).join(' ');
  let rings = '';
  for (const f of [0.25, 0.5, 0.75, 1]) rings += `<polygon points="${poly(R * f)}" fill="none" stroke="rgba(246,237,221,0.09)" stroke-width="1"/>`;
  let spokes = '';
  for (let i = 0; i < 6; i++) { const [x, y] = pt(i, R); spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(246,237,221,0.07)" stroke-width="1"/>`; }
  const dp = stats.map(([, v], i) => pt(i, (R * v) / 100).map((n) => n.toFixed(1)).join(',')).join(' ');
  const dots = stats.map(([, v], i) => { const [x, y] = pt(i, (R * v) / 100); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(width * 0.009).toFixed(1)}" fill="${GOLD}"/>`; }).join('');
  const labs = stats.map(([l, v], i) => {
    const [x, y] = pt(i, R * LR);
    const anchor = Math.abs(x - cx) < width * 0.03 ? 'middle' : x > cx ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" style="font-family:'S';font-size:${fs.toFixed(0)}px;letter-spacing:.06em;fill:${MUTED}">${l} <tspan fill="${GOLD}">${v}</tspan></text>`;
  }).join('');
  return `<svg width="${width}" height="${H}" viewBox="0 0 ${width} ${H}"><defs><radialGradient id="rg" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="${GOLD}" stop-opacity="0.34"/><stop offset="100%" stop-color="${ORANGE}" stop-opacity="0.14"/></radialGradient></defs>${rings}${spokes}<polygon points="${dp}" fill="rgba(224,168,62,0.13)" stroke="${GOLD}" stroke-width="${(width * 0.005).toFixed(1)}" stroke-linejoin="round"/>${dots}${labs}</svg>`;
}

// Painted venue per style (scripts/social/plates masters) — the veil in
// adShell keeps each style's own graphics readable on top.
const STYLE_PLATE = { scale: 'vault', constellation: 'sky', powerstats: 'sky', dossier: 'throne', leaderboard: 'sky', versus: 'arena' };
const plateCache = new Map();
const plateUri = (k) => {
  if (!plateCache.has(k)) plateCache.set(k, `data:image/png;base64,${readFileSync(join(ROOT, `scripts/social/plates/${k}.png`)).toString('base64')}`);
  return plateCache.get(k);
};

const STYLES = {
  // 1 — the sheer size of the catalogue
  scale: (w, h, d) => stage(w, h,
    `${eyebrow(h, 'THE HERO &amp; VILLAIN ENCYCLOPEDIA')}
     <div class="pop" style="font-size:${Math.round(h * 0.165)}px;line-height:.9;color:${GOLD}">${nice(d.count)}</div>
     <div style="font-size:${Math.round(h * 0.052)}px;margin:${Math.round(h * 0.024)}px 0 ${Math.round(h * 0.05)}px">heroes &amp; villains, ranked &amp; rated</div>
     <div style="font-size:${Math.round(h * 0.03)}px;color:${MUTED}">powers · matchups · rankings · lore</div>
     ${cta(h, 0.06)}`),

  // 2 — the relationship graph / Social Web
  constellation: (w, h, d) => `${constellationSvg(w, h)}
    <div style="position:absolute;inset:0;background:linear-gradient(100deg, rgba(6,18,26,.95) 0%, rgba(6,18,26,.68) 30%, transparent 60%), linear-gradient(0deg, rgba(6,18,26,.82) 0%, transparent 20%)"></div>
    ${stageCorner(w, h,
    `<div style="font-size:${Math.round(h * 0.026)}px;letter-spacing:.22em;color:${TEAL};margin-bottom:${Math.round(h * 0.016)}px">THE SOCIAL WEB</div>
       <div class="pop" style="font-size:${Math.round(h * 0.075)}px;line-height:1.0;color:${CREAM}">Everyone is<br>connected.</div>
       <div style="font-size:${Math.round(h * 0.03)}px;color:${MUTED};margin-top:${Math.round(h * 0.02)}px">${nice(d.count)} heroes &amp; villains —<br>allies, rivals, families &amp; teams.</div>
       ${cta(h, 0.028)}`, 0.62)}`,

  // 3 — the powerstats rating system, as a hexagonal power grid
  powerstats: (w, h, d) => stage(w, h,
    `${eyebrow(h, 'SIX POWERS · ONE GRID')}
     <div class="pop" style="font-size:${Math.round(h * 0.066)}px;line-height:1;color:${CREAM};margin-bottom:${Math.round(h * 0.036)}px">Every hero, rated.</div>
     ${radar(Math.round(Math.min(w, h) * 0.72))}
     ${cta(h, 0.055)}`),

  // 4 — the debate / vote hub (no faces)
  versus: (w, h, d) => {
    const plate = Math.round(w * 0.31);
    const p = (glyph, c) => `<div style="width:${plate}px;height:${plate}px;border-radius:26%;background:rgba(255,255,255,.035);border:${Math.max(2, Math.round(plate * 0.011))}px solid ${c};display:flex;align-items:center;justify-content:center;box-shadow:0 20px 50px -20px rgba(0,0,0,.7)"><span class="pop" style="font-size:${Math.round(plate * 0.5)}px;color:${c}">?</span></div>`;
    return stage(w, h,
      `${eyebrow(h, 'SETTLE THE ARGUMENT')}
       <div style="display:flex;align-items:center;gap:${Math.round(w * 0.05)}px;margin-bottom:${Math.round(h * 0.055)}px">
         ${p('?', ORANGE)}<span class="pop" style="font-size:${Math.round(h * 0.075)}px;color:${GOLD}">VS</span>${p('?', TEAL)}</div>
       <div class="pop" style="font-size:${Math.round(h * 0.066)}px;color:${CREAM}">Who would win?</div>
       <div style="font-size:${Math.round(h * 0.032)}px;color:${MUTED};margin-top:${Math.round(h * 0.02)}px">You decide. Cast your vote.</div>
       ${cta(h, 0.06)}`);
  },

  // 5 — the rankings / fame score  (left-anchored for variety)
  leaderboard: (w, h, d) => {
    const rows = [['1', 96], ['2', 88], ['3', 79], ['4', 71], ['5', 64]];
    const barH = (top) => Math.round(h * (top ? 0.052 : 0.044));
    const list = rows.map(([rank, pct]) => {
      const top = rank === '1';
      // Recessed track (clearly visible) with a clean gold→amber fill — the
      // descending lengths read as a real ranking, not muddy smears.
      return `<div style="display:flex;align-items:center;gap:${Math.round(w * 0.028)}px;width:100%;padding:${Math.round(h * 0.011)}px 0">
        <span class="pop" style="font-size:${Math.round(h * (top ? 0.06 : 0.05))}px;color:${GOLD};width:${Math.round(w * 0.075)}px;text-align:left">${rank}</span>
        <div style="flex:1;height:${barH(top)}px;border-radius:${Math.round(barH(top) / 2)}px;background:rgba(255,255,255,.04);box-shadow:inset 0 1px 3px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.07)">
          <div style="width:${pct}%;height:100%;border-radius:${Math.round(barH(top) / 2)}px;background:linear-gradient(90deg, ${ORANGE}, ${GOLD});box-shadow:0 2px 10px -3px ${GOLD}${top ? '' : ';opacity:.82'}"></div></div></div>`;
    }).join('');
    return stageLeft(w, h,
      `<div style="font-size:${Math.round(h * 0.026)}px;letter-spacing:.2em;color:${GOLD};margin-bottom:${Math.round(h * 0.018)}px">THE RANKINGS</div>
       <div class="pop" style="font-size:${Math.round(h * 0.066)}px;line-height:1;color:${CREAM};margin-bottom:${Math.round(h * 0.036)}px">Who's really<br>number one?</div>
       <div style="width:100%">${list}</div>
       <div style="font-size:${Math.round(h * 0.03)}px;margin-top:${Math.round(h * 0.036)}px"><span style="color:${MUTED}">Ranked by the Mythique fame score · </span><span class="g pop" style="letter-spacing:.5px">mythique.app&thinsp;→</span></div>`, 0.82);
  },

  // 6 — the encyclopedia dossier (redaction as the IP-safe device; left-anchored)
  dossier: (w, h, d) => {
    const red = (u) => `<span style="display:inline-block;height:${Math.round(h * 0.019)}px;width:${u}px;background:${CREAM};opacity:.8;border-radius:3px;vertical-align:middle"></span>`;
    const field = (k, v) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:${Math.round(h * 0.017)}px 0;border-bottom:1px solid rgba(224,168,62,.14)">
      <span style="font-family:'S';font-size:${Math.round(h * 0.018)}px;letter-spacing:.14em;color:${MUTED}">${k}</span><span>${v}</span></div>`;
    const meter = `<div style="display:inline-flex;gap:5px;vertical-align:middle">${[1, 1, 1, 1, 0].map((on) => `<span style="width:${Math.round(w * 0.028)}px;height:${Math.round(h * 0.016)}px;border-radius:3px;background:${on ? GOLD : 'rgba(255,255,255,.12)'}"></span>`).join('')}</div>`;
    return stageLeft(w, h,
      `<div style="font-size:${Math.round(h * 0.025)}px;letter-spacing:.2em;color:${GOLD};margin-bottom:${Math.round(h * 0.02)}px">MYTHIQUE · CLASSIFIED FILE</div>
       <div class="pop" style="font-size:${Math.round(h * 0.058)}px;line-height:1;color:${CREAM};margin-bottom:${Math.round(h * 0.036)}px">The file on every<br>hero &amp; villain.</div>
       <div style="width:100%;background:rgba(13,30,42,.92);border:1px solid rgba(224,168,62,.28);border-radius:${Math.round(h * 0.018)}px;padding:${Math.round(h * 0.03)}px ${Math.round(w * 0.04)}px;box-shadow:0 24px 60px -28px rgba(0,0,0,.8)">
         <div style="display:flex;justify-content:space-between;align-items:baseline;padding-bottom:${Math.round(h * 0.017)}px;border-bottom:1px solid rgba(224,168,62,.14)">
           <span style="font-family:'S';font-size:${Math.round(h * 0.019)}px;letter-spacing:.1em;color:${MUTED}">FILE No.</span><span>${red(Math.round(w * 0.1))}</span></div>
         ${field('ALIGNMENT', red(Math.round(w * 0.15)))}
         ${field('FIRST APPEARANCE', red(Math.round(w * 0.2)))}
         ${field('THREAT LEVEL', meter)}
         <div style="display:flex;justify-content:space-between;align-items:center;padding-top:${Math.round(h * 0.017)}px">
           <span style="font-family:'S';font-size:${Math.round(h * 0.018)}px;letter-spacing:.14em;color:${MUTED}">POWERS</span><span>${red(Math.round(w * 0.26))}</span></div>
       </div>
       <div style="font-size:${Math.round(h * 0.03)}px;margin-top:${Math.round(h * 0.036)}px"><span style="color:${MUTED}">One of ${nice(d.count)} files · </span><span class="g pop" style="letter-spacing:.5px">mythique.app&thinsp;→</span></div>`, 0.72);
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
    await renderPng(adShell(F, { w, h }, STYLES[s](w, h, d), '', { plate: STYLE_PLATE[s] ? plateUri(STYLE_PLATE[s]) : null }), join(dir, `${s}-${sz}.png`), w, h);
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
