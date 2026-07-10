// Carousel renderer — every angle becomes a 3-5 slide, franchise-free story.
// Slides share the adShell (disclaimer baked in) and the balanced stage math
// from ad-brand.mjs; assertNoPortrait gates every slide.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderPng, ROOT } from '../lib.mjs';
import { adShell } from './shell.mjs';
import { assertNoPortrait } from './safe-assert.mjs';
import { silhouette, pickSilhouettePair } from './silhouettes.mjs';
import { relationPhrase } from './data.mjs';
const relForCopy = (r) => relationPhrase(r); // "the parent of" etc.

const GOLD = '#e0a83e', ORANGE = '#e8823a', TEAL = '#4fb3d0', CREAM = '#f6eddd', MUTED = '#9db4c4';
const SIZES = { '4x5': [1080, 1350], '1x1': [1080, 1080] };
// Painted venue per angle (scripts/social/plates masters, data-URI'd once).
const ANGLE_PLATE = { matchup: 'arena', ranking: 'sky', guess: 'vault', fact: 'sky', lore: 'throne' };
const LORE_PLATE = { family: 'throne', rivalry: 'arena', connected: 'sky' };
const plateCache = new Map();
const plateUri = (k) => {
  if (!plateCache.has(k)) plateCache.set(k, `data:image/png;base64,${readFileSync(join(ROOT, `scripts/social/plates/${k}.png`)).toString('base64')}`);
  return plateCache.get(k);
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const stage = (w, h, inner) =>
  `<div style="position:absolute;left:0;right:0;top:${Math.round(h * 0.055)}px;bottom:${Math.round(h * 0.11)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${Math.round(w * 0.08)}px">${inner}</div>`;
const eyebrow = (h, t, color = GOLD) => `<div style="font-size:${Math.round(h * 0.028)}px;letter-spacing:.24em;color:${color};margin-bottom:${Math.round(h * 0.028)}px">${t}</div>`;
const head = (h, t, size = 0.07) => `<div class="pop" style="font-size:${Math.round(h * size)}px;line-height:1;color:${CREAM}">${t}</div>`;
const sub = (h, t) => `<div style="font-size:${Math.round(h * 0.032)}px;color:${MUTED};margin-top:${Math.round(h * 0.02)}px">${t}</div>`;
const bar = (w, h, pct, color, hh = 0.04) =>
  `<div style="width:100%;height:${Math.round(h * hh)}px;border-radius:999px;background:rgba(255,255,255,.04);box-shadow:inset 0 1px 3px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.07)"><div style="width:${pct}%;height:100%;border-radius:999px;background:linear-gradient(90deg, ${color}, ${GOLD})"></div></div>`;
const plate = (w, c) => { const p = Math.round(w * 0.26); return `<div style="width:${p}px;height:${p}px;border-radius:26%;background:rgba(255,255,255,.035);border:${Math.max(2, Math.round(p * 0.011))}px solid ${c};display:flex;align-items:center;justify-content:center"><span class="pop" style="font-size:${Math.round(p * 0.5)}px;color:${c}">?</span></div>`; };

const SLIDES = {
  matchup: (e, w, h) => {
    const { a, b, rounds } = e.data;
    const hook = stage(w, h, `${eyebrow(h, 'SETTLE THE ARGUMENT')}
      <div style="display:flex;align-items:center;gap:${Math.round(w * 0.05)}px;margin-bottom:${Math.round(h * 0.05)}px">${plate(w, ORANGE)}<span class="pop" style="font-size:${Math.round(h * 0.07)}px;color:${GOLD}">VS</span>${plate(w, TEAL)}</div>
      ${head(h, `${a.name} vs ${b.name}`, 0.06)}${sub(h, 'Round by round. Swipe →')}`);
    const roundSlides = rounds.map(([label, av, bv], i) => stage(w, h,
      `${eyebrow(h, `ROUND ${i + 1}`)}${head(h, label, 0.075)}
       <div style="width:100%;margin-top:${Math.round(h * 0.05)}px;text-align:left">
         <div style="display:flex;justify-content:space-between;font-size:${Math.round(h * 0.034)}px;margin-bottom:8px"><span style="color:${ORANGE}">${a.name}</span><span class="pop" style="color:${ORANGE}">${av}</span></div>${bar(w, h, av, ORANGE)}
         <div style="display:flex;justify-content:space-between;font-size:${Math.round(h * 0.034)}px;margin:24px 0 8px"><span style="color:${TEAL}">${b.name}</span><span class="pop" style="color:${TEAL}">${bv}</span></div>${bar(w, h, bv, TEAL)}
       </div>
       <div class="pop" style="font-size:${Math.round(h * 0.042)}px;color:${av >= bv ? ORANGE : TEAL};margin-top:${Math.round(h * 0.05)}px">${av >= bv ? a.name : b.name} TAKES IT</div>`));
    const cta = stage(w, h, `${head(h, 'Who’s right?', 0.085)}${sub(h, 'The stats say one thing. The fans say another.')}
      <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">Vote on mythique.app&thinsp;→</div>`);
    return [hook, ...roundSlides, cta];
  },
  ranking: (e, w, h) => {
    const { label, rows } = e.data;
    const hook = stage(w, h, `${eyebrow(h, 'THE RANKINGS')}${head(h, `Top 10 ${label}`, 0.08)}${sub(h, 'Counted down. Swipe →')}`);
    const half = (rs, from) => stage(w, h, `${eyebrow(h, `#${from} → #${from - 4}`)}
      <div style="width:100%">${rs.map((r, i) => `<div style="display:flex;align-items:center;gap:${Math.round(w * 0.03)}px;padding:${Math.round(h * 0.012)}px 0">
        <span class="pop" style="font-size:${Math.round(h * 0.045)}px;color:${GOLD};width:${Math.round(w * 0.1)}px;text-align:left">${from - i}</span>
        <span style="flex:1;text-align:left;font-size:${Math.round(h * 0.036)}px;color:${CREAM}">${r.name}</span>
        <span class="pop" style="font-size:${Math.round(h * 0.036)}px;color:${MUTED}">${r.value}</span></div>
        ${bar(w, h, r.value, GOLD, 0.014)}`).join('')}</div>`);
    const cta = stage(w, h, `${head(h, 'Agree with #1?', 0.075)}${sub(h, 'Argue your case in the comments 👇')}
      <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">Full rankings · mythique.app&thinsp;→</div>`);
    return [hook, half(rows.slice(5, 10).reverse(), 10), half(rows.slice(0, 5).reverse(), 5), cta];
  },
  guess: (e, w, h) => {
    const g = e.data;
    const statRows = Object.entries(g.stats).map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:${Math.round(h * 0.034)}px;padding:${Math.round(h * 0.012)}px 0;border-bottom:1px solid rgba(224,168,62,.14)"><span style="letter-spacing:.14em;color:${MUTED}">${k.toUpperCase()}</span><span class="pop" style="color:${GOLD}">${v}</span></div>`).join('');
    return [
      stage(w, h, `${eyebrow(h, 'GUESS THE HERO')}${head(h, 'Six stats.<br>One legend.', 0.07)}
        <div style="width:100%;margin-top:${Math.round(h * 0.04)}px;background:rgba(13,30,42,.92);border:1px solid rgba(224,168,62,.28);border-radius:${Math.round(h * 0.018)}px;padding:${Math.round(h * 0.025)}px ${Math.round(w * 0.05)}px">${statRows}</div>
        ${sub(h, 'Who is it? Answer next slide →')}`),
      stage(w, h, `${eyebrow(h, 'THE ANSWER')}${head(h, g.name, 0.09)}${sub(h, `Fame ${g.fame_score}/100 · one of 35,000+ rated files`)}
        <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">mythique.app&thinsp;→</div>`),
    ];
  },
  fact: (e, w, h) => {
    const f = e.data;
    const statNum = f.stat && /^\d/.test(f.stat);
    // Real narrative facts run much longer than the old computed one-liners —
    // shrink the body text so long lore stays inside the stage box.
    const len = f.detail.length;
    const detailSize = len > 260 ? 0.024 : len > 180 ? 0.027 : 0.032;
    return [
      stage(w, h, `${f.hook ? eyebrow(h, f.hook) : ''}${head(h, f.headline, 0.062)}
        ${statNum ? `<div class="pop" style="font-size:${Math.round(h * 0.14)}px;color:${GOLD};margin:${Math.round(h * 0.04)}px 0">${f.stat}</div>` : ''}<div style="font-size:${Math.round(h * detailSize)}px;color:${MUTED};margin-top:${Math.round(h * 0.02)}px">${f.detail}</div>`),
      stage(w, h, `${head(h, 'There’s a file on everyone.', 0.065)}${sub(h, '35,000+ heroes & villains — powers, matchups, rankings & lore')}
        <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">mythique.app&thinsp;→</div>`),
    ];
  },
  lore: (e, w, h) => {
    const d = e.data;
    const twoBusts = (an, bn) => {
      const [ka, kb] = pickSilhouettePair(an, d.aHint, bn, d.bHint);
      return `<div style="display:flex;align-items:flex-end;justify-content:center;gap:${Math.round(w * 0.06)}px;margin-bottom:${Math.round(h * 0.04)}px">
      <div style="text-align:center">${silhouette(ka, { size: Math.round(w * 0.24), rim: ORANGE })}<div class="pop" style="font-size:${Math.round(h * 0.036)}px;color:${ORANGE};margin-top:8px">${an}</div></div>
      <div style="text-align:center">${silhouette(kb, { size: Math.round(w * 0.24), rim: TEAL })}<div class="pop" style="font-size:${Math.round(h * 0.036)}px;color:${TEAL};margin-top:8px">${bn}</div></div></div>`;
    };
    if (d.sub === 'family') return [
      stage(w, h, `${eyebrow(h, 'SAME BLOOD')}${head(h, 'Opposite<br>sides.', 0.085)}${sub(h, 'Swipe for the twist →')}`),
      stage(w, h, `${twoBusts(d.a, d.b)}${head(h, `${d.a} is<br>${relForCopy(d.relation)} ${d.b}.`, 0.055)}`),
      stage(w, h, `${head(h, 'Nature or<br>nurture?', 0.08)}${sub(h, 'The family tree tells the whole story.')}<div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">mythique.app&thinsp;→</div>`),
    ];
    if (d.sub === 'rivalry') return [
      stage(w, h, `${eyebrow(h, 'SOME FIGHTS NEVER END')}${twoBusts(d.a, d.b)}${head(h, `${d.a}<br><span style="color:${GOLD}">vs</span> ${d.b}`, 0.06)}${d.year ? sub(h, `Enemies since ${d.year}.`) : ''}`),
      stage(w, h, `${head(h, 'The best rivalry<br>in comics?', 0.07)}${sub(h, 'Fight about it in the comments 👇')}<div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">mythique.app&thinsp;→</div>`),
    ];
    return [ // connected
      stage(w, h, `${eyebrow(h, 'THE SOCIAL WEB')}${head(h, `The most connected<br>character in fiction?`, 0.055)}${head(h, d.a, 0.09)}`),
      stage(w, h, `<div style="display:flex;gap:${Math.round(w * 0.06)}px;justify-content:center;margin-bottom:${Math.round(h * 0.04)}px">
        <div><div class="pop" style="font-size:${Math.round(h * 0.09)}px;color:${ORANGE}">${d.allies}</div><div style="font-size:${Math.round(h * 0.028)}px;color:${MUTED}">ALLIES</div></div>
        <div><div class="pop" style="font-size:${Math.round(h * 0.09)}px;color:${TEAL}">${d.enemies}</div><div style="font-size:${Math.round(h * 0.028)}px;color:${MUTED}">ENEMIES</div></div>
        <div><div class="pop" style="font-size:${Math.round(h * 0.09)}px;color:${GOLD}">${d.teams}</div><div style="font-size:${Math.round(h * 0.028)}px;color:${MUTED}">TEAMS</div></div></div>
        <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">Explore the web · mythique.app&thinsp;→</div>`),
    ];
  },
};

export async function renderCarousel(entry, { outDir, F, size = '4x5' }) {
  const [w, h] = SIZES[size];
  const dir = join(outDir, `${String(entry.ord).padStart(2, '0')}-${slug(entry.title)}`);
  mkdirSync(dir, { recursive: true });
  const inners = SLIDES[entry.angle](entry, w, h);
  const plateKey = entry.angle === 'lore' ? LORE_PLATE[entry.data?.sub] ?? 'throne' : ANGLE_PLATE[entry.angle] ?? null;
  const slides = [];
  for (let i = 0; i < inners.length; i++) {
    const html = adShell(F, { w, h }, inners[i], '', { plate: plateKey ? plateUri(plateKey) : null });
    assertNoPortrait(html, `carousel:${entry.angle}:${entry.title}`);
    const out = join(dir, `slide-${i + 1}.png`);
    await renderPng(html, out, w, h);
    slides.push(out);
  }
  writeFileSync(join(dir, 'caption.txt'), entry.caption);
  return { dir, slides };
}
