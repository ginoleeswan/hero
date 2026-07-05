#!/usr/bin/env node
// Mythique character-showcase carousels — a 4:5 "character file" that flexes the
// depth of the catalogue for a single character: portrait, power stats, profile
// dossier, and aliases. Shows off what a Mythique page holds.
//
//   node scripts/social/generate-bios.mjs --character "Batman"
//   node scripts/social/generate-bios.mjs --count 6            # random popular
//   node scripts/social/generate-bios.mjs --count 6 --dry-run
//
// See ./README.md. Shared data layer + slide shell live in ./lib.mjs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadEnv, makeSb, heroFullByName, popularHeroes, portraitDataUri, fonts,
  OUT_DIR, renderPng, COLORS, slide, STAT_KEYS,
} from './lib.mjs';

const { O, T, GOLD, CREAM, NAVY } = COLORS;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const titlecase = (s) => String(s ?? '').replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const realVal = (v) => v && String(v).trim() && String(v).trim() !== '-';

function tagline(h) {
  const name = h.name.toLowerCase();
  const aliases = (Array.isArray(h.aliases) ? h.aliases : [])
    .filter((a) => a && a.trim().length > 3 && a.length <= 24
      && a.toLowerCase() !== name
      && !a.toLowerCase().startsWith(name) // drop "Batman II", "Superman Prime"
      && !/[0-9]/.test(a));
  const epithet = aliases.find((a) => /^the\s/i.test(a)) || aliases[0];
  return (epithet || h.publisher || 'Mythique').toUpperCase();
}

function slideCover(h, img, F) {
  const inner = `
   <div style="position:absolute;top:92px;left:0;right:0;text-align:center;font-size:34px;letter-spacing:8px;color:${GOLD}">CHARACTER FILE</div>
   <div style="position:absolute;top:150px;left:40px;right:40px;text-align:center;font-size:110px;color:${CREAM}" class="stroke">${esc(h.name.toUpperCase())}</div>
   <div class="sqc" style="position:absolute;top:326px;left:50%;transform:translateX(-50%);width:600px;height:660px;border:8px solid ${GOLD};box-shadow:0 24px 70px rgba(0,0,0,.6),0 0 90px -18px ${GOLD}"><img src="${img}"><div class="glare"></div></div>
   <div style="position:absolute;top:1030px;left:0;right:0;text-align:center;font-size:52px;letter-spacing:5px;color:${GOLD}">${esc(tagline(h))}</div>
   <div style="position:absolute;top:1108px;left:0;right:0;text-align:center;font-family:'S';font-size:34px;color:#9db4c4">${esc(h.publisher || '')}  ·  swipe →</div>`;
  return slide(F, inner);
}

function slideStats(h, F) {
  const rows = STAT_KEYS.map((k) => {
    const v = h[k] ?? 0;
    return `<div style="margin:0 0 28px 0;padding:0 90px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px"><span style="font-size:38px;letter-spacing:3px;color:${GOLD}">${k.toUpperCase()}</span><span class="pop" style="font-size:64px;color:${CREAM}">${v}</span></div>
      <div style="height:34px;border-radius:20px;overflow:hidden;background:#0e2330;border:4px solid rgba(245,235,220,.15)"><div style="width:${v}%;height:100%;background:linear-gradient(90deg, ${O}, ${GOLD})"></div></div></div>`;
  }).join('');
  const inner = `
   <div style="position:absolute;top:92px;left:0;right:0;text-align:center;font-size:64px;letter-spacing:5px;color:${GOLD}" class="stroke">POWER STATS</div>
   <div style="position:absolute;top:210px;left:0;right:0">${rows}</div>`;
  return slide(F, inner);
}

function slideProfile(h, F) {
  const fields = [
    ['REAL NAME', h.full_name],
    ['FIRST APPEARANCE', h.first_appearance],
    ['RACE', h.race],
    ['ALIGNMENT', h.alignment ? titlecase(h.alignment) : ''],
    ['OCCUPATION', clip(h.occupation, 46)],
    ['TEAM', clip(h.group_affiliation, 46)],
  ].filter(([, v]) => realVal(v));
  const rows = fields.map(([label, v]) => `<div style="margin:0 0 40px 0;padding:0 90px">
      <div style="font-size:30px;letter-spacing:4px;color:${GOLD};margin-bottom:6px">${label}</div>
      <div style="font-family:'S';font-size:50px;color:${CREAM};line-height:1.1">${esc(v)}</div></div>`).join('');
  const inner = `
   <div style="position:absolute;top:92px;left:0;right:0;text-align:center;font-size:64px;letter-spacing:5px;color:${GOLD}" class="stroke">PROFILE</div>
   <div style="position:absolute;top:220px;left:0;right:0">${rows}</div>`;
  return slide(F, inner);
}

function slideAka(h, F) {
  const aliases = (Array.isArray(h.aliases) ? h.aliases : []).filter((a) => a && a.toLowerCase() !== h.name.toLowerCase()).slice(0, 4);
  const chips = aliases.map((a) => `<div style="display:inline-block;margin:10px;padding:16px 34px;border-radius:100px;border:2px solid rgba(224,168,62,.4);background:rgba(245,235,220,.05);font-size:44px;color:${CREAM}">${esc(a)}</div>`).join('');
  const inner = `
   <div style="position:absolute;top:150px;left:0;right:0;text-align:center;font-size:64px;letter-spacing:4px;color:${GOLD}" class="stroke">ALSO KNOWN AS</div>
   <div style="position:absolute;top:300px;left:80px;right:80px;text-align:center">${chips || `<div style="font-family:'S';font-size:44px;color:#9db4c4">${esc(h.name)}</div>`}</div>
   <div style="position:absolute;top:760px;left:0;right:0;text-align:center;font-size:52px;color:${CREAM}">one of <span class="g">34,000+</span> characters</div>
   <div style="position:absolute;top:930px;left:0;right:0;text-align:center;font-size:70px" class="stroke">full profile on <span class="g">mythique.app</span></div>
   <div style="position:absolute;top:1070px;left:0;right:0;text-align:center;font-family:'S';font-size:40px;color:#9db4c4">follow @mythiqueapp for daily matchups</div>`;
  return slide(F, inner);
}

function caption(h) {
  const tl = titlecase(tagline(h));
  return [
    `Meet ${h.name} — ${tl}. 🦸`, ``,
    [h.first_appearance && `First appearance: ${h.first_appearance}`, h.race && `Race: ${h.race}`].filter(Boolean).join('  ·  '),
    ``,
    `Full profile, powers and every matchup on mythique.app — one of 34,000+ characters.`, ``,
    `#${h.name.replace(/[^a-z0-9]/gi, '')} #${(h.publisher || '').replace(/[^a-z0-9]/gi, '')} #superheroes #comics #anime #marvel #dc #mythique`,
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const dry = args.includes('--dry-run');
  const count = parseInt(get('--count', '6'), 10);
  const character = get('--character', null);

  const sb = makeSb(loadEnv());
  let heroes;
  if (character) {
    const h = await heroFullByName(sb, character);
    if (!h) { console.error('Character not found:', character); process.exit(1); }
    heroes = [h];
  } else {
    const pool = await popularHeroes(sb, Math.max(count * 3, 30));
    // deterministic-but-varied sample from the top of the pool
    heroes = pool.filter((_, i) => i % 3 === 0).slice(0, count);
  }

  console.log(`\n${heroes.length} character(s):`);
  for (const h of heroes) console.log(`  ${h.name} (${h.publisher || '—'}, fame ${h.fame_score})`);
  if (dry) return;

  const F = fonts();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const h of heroes) {
    const img = await portraitDataUri(h);
    const slides = [slideCover(h, img, F), slideStats(h, F), slideProfile(h, F), slideAka(h, F)];
    const slug = h.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dir = join(OUT_DIR, `bio-${slug}`);
    mkdirSync(dir, { recursive: true });
    console.log(`Rendering ${h.name} character file (${slides.length} slides)...`);
    for (let i = 0; i < slides.length; i++) await renderPng(slides[i], join(dir, `slide-${i + 1}.png`), 1080, 1350);
    writeFileSync(join(dir, 'caption.txt'), caption(h));
    console.log(`  -> ${dir}`);
  }
  console.log('\nDone. Upload slides in order as an Instagram carousel.');
}

main().catch((e) => { console.error(e); process.exit(1); });
