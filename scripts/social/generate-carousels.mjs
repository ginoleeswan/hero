#!/usr/bin/env node
// Mythique carousel generator — 4:5 (1080x1350) Instagram carousel slides for
// a matchup, from real data, styled like the app. Outputs a swipe set of PNGs
// plus a caption.
//
//   node scripts/social/generate-carousels.mjs --count 6
//   node scripts/social/generate-carousels.mjs --matchup "Goku,Superman"
//   node scripts/social/generate-carousels.mjs --count 6 --dry-run
//
// Slides: 1) cover / hook  2) tale of the tape  3) verdict + winner
//         4) fan vote + CTA.  See ./README.md.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadEnv, makeSb, selectMatchups, resolveManual, hydrate, fonts, slugFor,
  OUT_DIR, renderPng, COLORS, slide, STAT_KEYS,
} from './lib.mjs';

const { O, T, GOLD, CREAM, NAVY } = COLORS;
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const STAT_TITLE = 'HEAD TO HEAD'; // stat comparison slide heading
const page = (F, inner, extra = '') => slide(F, inner, extra);

function slideCover(M, F) {
  const inner = `
   <div style="position:absolute;top:96px;left:60px;right:60px;text-align:center;font-size:88px" class="stroke"><span class="o">${M.a.name}</span> <span class="g">vs</span> <span class="t">${M.b.name}</span></div>
   <div class="sqc" style="position:absolute;top:400px;left:70px;width:420px;height:540px;border:7px solid ${O};box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 60px -12px ${O}"><img src="${M.a.img}"><div class="glare"></div></div>
   <div class="sqc" style="position:absolute;top:400px;right:70px;width:420px;height:540px;border:7px solid ${T};box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 60px -12px ${T}"><img class="flip" src="${M.b.img}"><div class="glare"></div></div>
   <div style="position:absolute;top:640px;left:50%;transform:translateX(-50%);width:150px;height:150px;border-radius:50%;background:${NAVY};border:6px solid ${GOLD};color:${GOLD};display:flex;align-items:center;justify-content:center;font-size:66px;box-shadow:0 0 0 9px ${NAVY},0 0 60px rgba(224,168,62,.7);z-index:5">VS</div>
   <div style="position:absolute;top:1010px;left:0;right:0;text-align:center;font-size:96px" class="stroke">WHO WOULD <span class="g">WIN?</span></div>
   <div style="position:absolute;top:1150px;left:0;right:0;text-align:center;font-family:'S';font-size:38px;color:#9db4c4">swipe to find out →</div>`;
  return page(F, inner);
}

function slideTape(M, F) {
  const rows = STAT_KEYS.map((k) => {
    const av = M.stats[k], bv = M.stats2[k];
    const pa = Math.round((av / (av + bv || 1)) * 100);
    const ca = bv > av ? '#64757f' : O; // strict loser goes muted; ties stay full colour
    const cb = av > bv ? '#64757f' : T;
    return `<div style="margin:0 0 22px 0">
      <div style="text-align:center;font-size:31px;letter-spacing:3px;color:${GOLD};margin-bottom:8px">${k.toUpperCase()}</div>
      <div style="display:flex;align-items:center;gap:24px;padding:0 70px">
        <span class="pop" style="width:150px;text-align:right;font-size:62px;color:${ca}">${av}</span>
        <div style="flex:1;height:32px;border-radius:20px;overflow:hidden;display:flex;border:4px solid rgba(245,235,220,.15);background:#0e2330"><div style="width:${pa}%;background:${O}"></div><div style="flex:1;background:${T}"></div></div>
        <span class="pop" style="width:150px;text-align:left;font-size:62px;color:${cb}">${bv}</span>
      </div></div>`;
  }).join('');
  const inner = `
   <div style="position:absolute;top:76px;left:0;right:0;text-align:center;font-size:64px;letter-spacing:4px;color:${GOLD}" class="stroke">${STAT_TITLE}</div>
   <div style="position:absolute;top:180px;left:70px;right:70px;display:flex;justify-content:space-between;font-size:52px" class="stroke"><span class="o">${M.a.name}</span><span class="t">${M.b.name}</span></div>
   <div style="position:absolute;top:276px;left:0;right:0">${rows}</div>`;
  return page(F, inner);
}

function slideVerdict(M, F) {
  const win = M[M.winner];
  const inner = `
   <div style="position:absolute;top:96px;left:0;right:0;text-align:center;font-size:52px;letter-spacing:6px;color:${GOLD}">WINNER</div>
   <div style="position:absolute;top:150px;left:50%;transform:translateX(-50%);width:220px;height:8px;background:${GOLD};border-radius:6px"></div>
   <div class="sqc" style="position:absolute;top:230px;left:50%;transform:translateX(-50%);width:470px;height:600px;border:8px solid ${GOLD};box-shadow:0 0 120px 8px rgba(224,168,62,.75)"><img class="${win.flip ? 'flip' : ''}" src="${win.img}"><div class="glare"></div></div>
   <div style="position:absolute;top:836px;left:0;right:0;text-align:center;font-size:96px;color:${GOLD}" class="pop">${win.name} WINS</div>
   <div style="position:absolute;top:964px;left:90px;right:90px;text-align:center;font-family:'R';font-size:46px;line-height:1.32;color:${CREAM}"><span style="color:${GOLD};font-size:76px;vertical-align:-16px">&ldquo;</span>${M.verdict}<span style="color:${GOLD};font-size:76px;vertical-align:-16px">&rdquo;</span></div>`;
  return page(F, inner);
}

function slideVote(M, F) {
  const lead = M.voteA >= M.voteB ? M.a.name : M.b.name;
  const inner = `
   <div style="position:absolute;top:150px;left:0;right:0;text-align:center;font-size:80px" class="stroke">BUT THE <span class="g">FANS</span><br>DISAGREE</div>
   <div style="position:absolute;top:560px;left:90px;right:90px;height:80px;border-radius:44px;overflow:hidden;display:flex;border:6px solid rgba(245,235,220,.2)"><div style="width:${M.voteA}%;background:${O}"></div><div style="flex:1;background:${T}"></div></div>
   <div style="position:absolute;top:680px;left:90px;right:90px;display:flex;justify-content:space-between;font-size:96px" class="pop"><span class="o">${M.voteA}%</span><span class="t">${M.voteB}%</span></div>
   <div style="position:absolute;top:840px;left:0;right:0;text-align:center;font-family:'S';font-size:44px;color:#9db4c4">${lead} is winning the vote</div>
   <div style="position:absolute;top:990px;left:0;right:0;text-align:center;font-size:76px" class="stroke">who's <span class="g">YOUR</span> pick?</div>
   <div style="position:absolute;top:1110px;left:0;right:0;text-align:center;font-family:'S';font-size:40px;color:${CREAM}">comment below 👇  ·  vote on mythique.app</div>`;
  return page(F, inner);
}

function buildSlides(M, F) {
  return [slideCover(M, F), slideTape(M, F), slideVerdict(M, F), slideVote(M, F)];
}

function buildMatchup(h) {
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, h.ka[k] ?? 0]));
  const stats2 = Object.fromEntries(STAT_KEYS.map((k) => [k, h.kb[k] ?? 0]));
  return {
    a: { name: h.ka.name.toUpperCase(), img: h.portraitA, flip: false },
    b: { name: h.kb.name.toUpperCase(), img: h.portraitB, flip: true },
    winner: h.winner, verdict: h.verdict, voteA: h.voteA, voteB: h.voteB, stats, stats2,
  };
}

function caption(M) {
  const a = M.a.name, b = M.b.name, w = M[M.winner].name;
  const lead = M.voteA >= M.voteB ? a : b;
  return [
    `${cap1(a.toLowerCase())} vs ${cap1(b.toLowerCase())} — who would win? Swipe for the tale of the tape 🥊`, ``,
    `Our model gives it to ${cap1(w.toLowerCase())}, but the fans have ${cap1(lead.toLowerCase())} ahead ${Math.max(M.voteA, M.voteB)}/${Math.min(M.voteA, M.voteB)}.`,
    `Who's right? Drop your pick 👇`, ``,
    `Explore 34,000+ characters and settle any matchup on mythique.app`, ``,
    `#whowouldwin #${a.replace(/[^a-z0-9]/gi, '')} #${b.replace(/[^a-z0-9]/gi, '')} #superheroes #anime #marvel #dc #comics #powerscaling #mythique`,
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const dry = args.includes('--dry-run');
  const count = parseInt(get('--count', '6'), 10);
  const manual = get('--matchup', null);

  const sb = makeSb(loadEnv());
  const selections = manual ? [await resolveManual(sb, manual)] : (console.log(`Selecting ${count} popular, close-vote matchups...`), await selectMatchups(sb, count));

  console.log(`\n${selections.length} matchup(s):`);
  for (const s of selections) console.log(`  ${s.ka.name} vs ${s.kb.name}  —  ${s.pctA}/${s.pctB}  (${s.total} votes)`);
  if (dry) return;

  const F = fonts();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const s of selections) {
    const M = buildMatchup(await hydrate(sb, s));
    const dir = join(OUT_DIR, slugFor(s), 'carousel');
    mkdirSync(dir, { recursive: true });
    const slides = buildSlides(M, F);
    console.log(`Rendering ${slugFor(s)} carousel (${slides.length} slides)...`);
    for (let i = 0; i < slides.length; i++) {
      await renderPng(slides[i], join(dir, `slide-${i + 1}.png`), 1080, 1350);
    }
    writeFileSync(join(dir, 'caption.txt'), caption(M));
    console.log(`  -> ${dir}`);
  }
  console.log('\nDone. Upload slides in order as an Instagram carousel.');
}

main().catch((e) => { console.error(e); process.exit(1); });
