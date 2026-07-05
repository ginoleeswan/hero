#!/usr/bin/env node
// Mythique character-file carousels — a rich 4:5 dossier for one character that
// flexes the catalogue depth: cover, profile, by-the-numbers footprint, power
// stats, abilities, associates (enemies/allies/family), and did-you-know facts.
//
//   node scripts/social/generate-bios.mjs --character "Batman"
//   node scripts/social/generate-bios.mjs --count 6            # random popular
//   node scripts/social/generate-bios.mjs --count 6 --dry-run
//
// See ./README.md. Shared data layer + slide shell live in ./lib.mjs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadEnv, makeSb, heroFullByName, popularHeroes, portraitDataUri, imgDataUri,
  getRelated, getFamily, getFact, fonts, OUT_DIR, renderPng, COLORS, slide, STAT_KEYS,
} from './lib.mjs';

const { O, T, GOLD, CREAM } = COLORS;
const RED = '#e2503f';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const titlecase = (s) => String(s ?? '').replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
const realVal = (v) => v && String(v).trim() && String(v).trim() !== '-';
const fmt = (n) => Number(n).toLocaleString('en-US');
const YEAR = new Date().getFullYear();

function tagline(h) {
  const name = h.name.toLowerCase();
  const aliases = (Array.isArray(h.aliases) ? h.aliases : [])
    .filter((a) => a && a.trim().length > 3 && a.length <= 24 && a.toLowerCase() !== name
      && !a.toLowerCase().startsWith(name) && !/[0-9]/.test(a));
  return ((aliases.find((a) => /^the\s/i.test(a)) || aliases[0]) || h.publisher || 'Mythique').toUpperCase();
}

// ---- slides ----
function slideCover(h, img, F) {
  return slide(F, `
   <div style="position:absolute;top:92px;left:0;right:0;text-align:center;font-size:34px;letter-spacing:8px;color:${GOLD}">CHARACTER FILE</div>
   <div style="position:absolute;top:150px;left:40px;right:40px;text-align:center;font-size:110px;color:${CREAM}" class="stroke">${esc(h.name.toUpperCase())}</div>
   <div class="sqc" style="position:absolute;top:326px;left:50%;transform:translateX(-50%);width:600px;height:660px;border:8px solid ${GOLD};box-shadow:0 24px 70px rgba(0,0,0,.6),0 0 90px -18px ${GOLD}"><img src="${img}"><div class="glare"></div></div>
   <div style="position:absolute;top:1030px;left:0;right:0;text-align:center;font-size:52px;letter-spacing:5px;color:${GOLD}">${esc(tagline(h))}</div>
   <div style="position:absolute;top:1108px;left:0;right:0;text-align:center;font-family:'S';font-size:34px;color:#9db4c4">${esc(h.publisher || '')}  ·  swipe →</div>`);
}

function slideDossier(h, F, year) {
  const fields = [
    ['REAL NAME', h.full_name],
    ['FIRST APPEARANCE', year ? `${h.first_appearance || ''} (${year})`.trim() : h.first_appearance],
    ['RACE', h.race],
    ['ALIGNMENT', h.alignment ? titlecase(h.alignment) : ''],
    ['OCCUPATION', clip(h.occupation, 46)],
    ['TEAMS', clip(h.group_affiliation, 46)],
  ].filter(([, v]) => realVal(v));
  const rows = fields.map(([l, v]) => `<div style="margin-bottom:40px">
      <div style="font-size:30px;letter-spacing:4px;color:${GOLD};margin-bottom:8px">${l}</div>
      <div style="font-family:'S';font-size:52px;color:${CREAM};line-height:1.12">${esc(v)}</div></div>`).join('');
  return slide(F, `<div class="body"><div class="h1">DOSSIER</div>
    <div style="width:100%;max-width:820px;text-align:left">${rows}</div></div>`);
}

function slideNumbers(h, F, year) {
  const tiles = [
    year ? [fmt(YEAR - year), 'YEARS ACTIVE'] : null,
    h.movie_count ? [fmt(h.movie_count), 'FILM APPEARANCES'] : null,
    h.issue_count ? [fmt(h.issue_count), 'COMIC ISSUES'] : null,
    h.wikidata_sitelinks ? [fmt(h.wikidata_sitelinks), 'LANGUAGES'] : null,
  ].filter(Boolean).slice(0, 4);
  const cells = tiles.map((t) => `<div style="width:420px;height:320px;margin:18px;border-radius:40px;border:2px solid rgba(224,168,62,.32);background:rgba(245,235,220,.04);display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div class="pop" style="font-size:120px;color:${CREAM}">${t[0]}</div>
      <div style="font-size:32px;letter-spacing:3px;color:${GOLD};margin-top:10px">${t[1]}</div></div>`).join('');
  return slide(F, `<div class="body"><div class="h1">BY THE NUMBERS</div>
    <div class="full" style="display:flex;flex-wrap:wrap;justify-content:center">${cells}</div></div>`);
}

function slideStats(h, F) {
  const rows = STAT_KEYS.map((k) => {
    const v = h[k] ?? 0;
    return `<div style="margin-bottom:34px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px"><span style="font-size:38px;letter-spacing:3px;color:${GOLD}">${k.toUpperCase()}</span><span class="pop" style="font-size:64px;color:${CREAM}">${v}</span></div>
      <div style="height:36px;border-radius:20px;overflow:hidden;background:#0e2330;border:4px solid rgba(245,235,220,.15)"><div style="width:${v}%;height:100%;background:linear-gradient(90deg, ${O}, ${GOLD})"></div></div></div>`;
  }).join('');
  return slide(F, `<div class="body"><div class="h1">POWER STATS</div><div class="full">${rows}</div></div>`);
}

function slideAbilities(h, F) {
  const powers = (Array.isArray(h.powers) ? h.powers : []).slice(0, 12);
  const chips = powers.map((p) => `<div style="display:inline-block;margin:14px;padding:20px 40px;border-radius:100px;border:2px solid rgba(224,168,62,.42);background:rgba(245,235,220,.05);font-size:48px;color:${CREAM}">${esc(p)}</div>`).join('');
  return slide(F, `<div class="body"><div class="h1">ABILITIES</div><div class="full">${chips}</div></div>`);
}

function thumbRow(label, tone, people) {
  const cells = people.map((p) => `<div style="display:inline-block;width:210px;margin:0 8px;text-align:center;vertical-align:top">
      <div style="width:168px;height:168px;border-radius:50%;overflow:hidden;border:5px solid ${tone};margin:0 auto;box-shadow:0 10px 30px rgba(0,0,0,.5)"><img src="${p.img}" style="width:100%;height:100%;object-fit:cover"></div>
      <div style="font-family:'S';font-size:29px;color:${CREAM};margin-top:14px;line-height:1.05">${esc(clip(p.name, 16))}</div></div>`).join('');
  return `<div style="margin-bottom:60px"><div style="text-align:center;font-size:42px;letter-spacing:5px;color:${tone};margin-bottom:24px">${label}</div><div style="text-align:center;white-space:nowrap">${cells}</div></div>`;
}

function slideAssociates(F, groups) {
  const rows = groups.map((g) => thumbRow(g.label, g.tone, g.people)).join('');
  return slide(F, `<div class="body"><div class="h1">KNOWN ASSOCIATES</div><div class="full">${rows}</div></div>`);
}

function slideFacts(h, F, facts) {
  const items = facts.map((f) => `<div style="display:flex;align-items:flex-start;gap:28px;margin-bottom:52px;text-align:left">
      <div style="color:${GOLD};font-size:56px;line-height:1.05">◆</div>
      <div style="font-family:'S';font-size:54px;color:${CREAM};line-height:1.26">${f}</div></div>`).join('');
  return slide(F, `<div class="body"><div class="h1">DID YOU KNOW</div>
    <div style="width:100%;max-width:860px">${items}</div></div>`);
}

function slideCta(h, F) {
  return slide(F, `<div class="body">
    <div style="font-size:54px;color:${CREAM};margin-bottom:70px">one of <span class="g">34,000+</span> characters</div>
    <div style="font-size:82px;margin-bottom:16px" class="stroke">full profile on <span class="g">mythique.app</span></div>
    <div style="font-family:'S';font-size:42px;color:#9db4c4;margin-bottom:90px">stats · powers · rivalries · every matchup</div>
    <div style="font-size:66px;margin-bottom:16px" class="stroke">follow <span class="g">@mythiqueapp</span></div>
    <div style="font-family:'S';font-size:38px;color:#9db4c4">for daily matchups &amp; character files</div></div>`);
}

function buildFacts(h, year, enemies) {
  const out = [];
  if (year) out.push(`${esc(h.name)} first appeared in <b style="color:${GOLD}">${year}</b>, over <b style="color:${GOLD}">${YEAR - year}</b> years of stories.`);
  const powers = Array.isArray(h.powers) ? h.powers : [];
  if (powers.length) out.push(`Wields <b style="color:${GOLD}">${powers.length}</b> distinct abilities in the catalogue.`);
  if (enemies.length >= 2) out.push(`Has clashed with icons like <b style="color:${GOLD}">${esc(enemies[0].name)}</b> &amp; <b style="color:${GOLD}">${esc(enemies[1].name)}</b>.`);
  if (out.length < 3 && h.fame_score != null) out.push(`Mythique fame score: <b style="color:${GOLD}">${h.fame_score}/100</b>.`);
  return out.slice(0, 3);
}

function caption(h) {
  const tl = titlecase(tagline(h));
  const bits = [h.movie_count && `${h.movie_count} films`, h.issue_count && `${fmt(h.issue_count)} comics`].filter(Boolean).join('  ·  ');
  return [
    `The full file on ${h.name}: ${tl}. 🦸`, ``,
    bits ? `${bits}. Powers, rivalries, and every matchup on mythique.app.` : `Powers, rivalries, and every matchup on mythique.app.`,
    `One of 34,000+ characters.`, ``,
    `#${h.name.replace(/[^a-z0-9]/gi, '')} #${(h.publisher || '').replace(/[^a-z0-9]/gi, '')} #superheroes #comics #anime #marvel #dc #mythique`,
  ].join('\n');
}

async function withThumbs(rows, n) {
  const picked = (rows || []).filter((r) => r.portrait_url || r.image_md_url || r.image_url).slice(0, n);
  const out = [];
  for (const r of picked) {
    const img = await imgDataUri(r.portrait_url || r.image_md_url || r.image_url);
    if (img) out.push({ name: r.name, img });
  }
  return out;
}

async function build(sb, h, F) {
  const [img, year, enemiesRaw, alliesRaw, familyRaw] = await Promise.all([
    portraitDataUri(h),
    getFact(sb, h.id, 'first_appearance_year'),
    getRelated(sb, h.id, 'enemy', 5),
    getRelated(sb, h.id, 'ally', 5),
    getFamily(sb, h.id, 5),
  ]);
  const yr = year ? parseInt(year, 10) : null;
  const [enemies, allies, family] = await Promise.all([withThumbs(enemiesRaw, 4), withThumbs(alliesRaw, 4), withThumbs(familyRaw, 4)]);
  const groups = [
    enemies.length && { label: 'ENEMIES', tone: RED, people: enemies },
    allies.length && { label: 'ALLIES', tone: T, people: allies },
    family.length && { label: 'FAMILY', tone: GOLD, people: family },
  ].filter(Boolean).slice(0, 3);

  const slides = [slideCover(h, img, F), slideDossier(h, F, yr)];
  if (year || h.movie_count || h.issue_count || h.wikidata_sitelinks) slides.push(slideNumbers(h, F, yr));
  slides.push(slideStats(h, F));
  if ((h.powers || []).length) slides.push(slideAbilities(h, F));
  if (groups.length) slides.push(slideAssociates(F, groups));
  const facts = buildFacts(h, yr, enemies);
  if (facts.length) slides.push(slideFacts(h, F, facts));
  slides.push(slideCta(h, F));
  return slides;
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
    heroes = pool.filter((_, i) => i % 3 === 0).slice(0, count);
  }

  console.log(`\n${heroes.length} character(s):`);
  for (const h of heroes) console.log(`  ${h.name} (${h.publisher || '—'}, fame ${h.fame_score})`);
  if (dry) return;

  const F = fonts();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const h of heroes) {
    const slides = await build(sb, h, F);
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
