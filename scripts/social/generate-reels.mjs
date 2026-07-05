#!/usr/bin/env node
// Mythique reel generator — fast-cut 9:16 "who would win" videos for
// TikTok / Reels / Shorts, from real matchup data, styled like the app.
//
//   node scripts/social/generate-reels.mjs --count 8
//   node scripts/social/generate-reels.mjs --matchup "Goku,Superman"
//   node scripts/social/generate-reels.mjs --count 10 --dry-run
//
// See ./README.md for setup. Shared data layer lives in ./lib.mjs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadEnv, makeSb, selectMatchups, resolveManual, hydrate, fonts, slugFor,
  OUT_DIR, renderVideo, COLORS, grainUri, fontFace,
} from './lib.mjs';

function buildHtml(M, F) {
  const { O, T, GOLD, CREAM, NAVY } = COLORS;
  const grain = grainUri();
  const card = (c) => `<div class="sqin ${c.dim ? 'loser' : ''}"><img class="${c.flip ? 'flip' : ''}" src="${c.img}"><div class="glare"></div></div><div class="pname" style="color:${c.col}">${c.name}</div>`;
  const a = M.a, b = M.b;
  const stats = M.stats.map((s, i) => {
    const aw = s[1] >= s[2];
    return `<div class="scene stat" id="s_stat${i}">
      <div class="rlabel">ROUND ${i + 1}</div><div class="statname">${s[0]}</div>
      <div class="snums"><span class="na cnt" data-to="${s[1]}">0</span><span class="vs2">vs</span><span class="nb cnt" data-to="${s[2]}">0</span></div>
      <div class="track"><div class="fa" style="width:${Math.round((s[1] / (s[1] + s[2])) * 100)}%"></div><div class="fb"></div></div>
      <div class="wlabel" style="color:${aw ? O : T}">${aw ? a.name : b.name} TAKES IT</div></div>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace(F)}
*{margin:0;padding:0;box-sizing:border-box;}html,body{width:1080px;height:1920px;overflow:hidden;background:${NAVY};font-family:'F';}
.root{position:relative;width:1080px;height:1920px;overflow:hidden;background:radial-gradient(60% 44% at 50% 34%, rgba(224,168,62,.12), transparent 62%), radial-gradient(120% 90% at 50% 10%, #12242f, ${NAVY} 70%);}
.dots{position:absolute;inset:0;background-image:radial-gradient(circle, rgba(224,168,62,.10) 1.4px, transparent 2px);background-size:30px;-webkit-mask-image:radial-gradient(130% 100% at 50% 40%, transparent 40%, #000);opacity:.6;}
.grain{position:absolute;inset:0;background-image:url("${grain}");background-size:340px;opacity:.05;mix-blend-mode:overlay;}
.scene{position:absolute;inset:0;opacity:0;}.scene.on{opacity:1;}
.sq{position:absolute;top:520px;width:452px;}.sq.l{left:60px;}.sq.r{right:60px;}
.sqin{position:relative;width:452px;height:600px;border-radius:23%/17%;overflow:hidden;border:7px solid var(--tc);box-shadow:0 30px 70px rgba(0,0,0,.6),0 0 60px -10px var(--tc);animation:drift 7s ease-in-out infinite alternate;}
.sqin img{width:100%;height:100%;object-fit:cover;}.sqin img.flip{transform:scaleX(-1);}.sqin.loser{filter:grayscale(1) brightness(.42);}
.glare{position:absolute;inset:0;background:linear-gradient(120deg, rgba(255,255,255,.14), transparent 40%);}
.pname{text-align:center;font-size:60px;margin-top:20px;-webkit-text-stroke:8px ${NAVY};paint-order:stroke fill;}
.scene.on .sq.l{animation:inL .5s cubic-bezier(.16,1,.3,1) both;}.scene.on .sq.r{animation:inR .5s cubic-bezier(.16,1,.3,1) both;}
.vs{position:absolute;top:770px;left:50%;transform:translateX(-50%);width:172px;height:172px;border-radius:50%;background:${NAVY};border:6px solid ${GOLD};color:${GOLD};display:flex;align-items:center;justify-content:center;font-size:78px;box-shadow:0 0 0 10px ${NAVY},0 0 70px rgba(224,168,62,.7);z-index:5;}
.scene.on .vs{animation:pop .45s .25s cubic-bezier(.2,1.7,.4,1) both;}
.flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;}.scene.on .flash{animation:flash .4s ease-out both;}
.cap{position:absolute;left:60px;right:60px;text-align:center;color:${CREAM};-webkit-text-stroke:9px ${NAVY};paint-order:stroke fill;text-shadow:0 8px 26px rgba(0,0,0,.6);}
.scene.on .cap{animation:slam .3s cubic-bezier(.2,1.5,.4,1) both;}
.title{top:170px;font-size:92px;}.title .o{color:${O}}.title .t{color:${T}}.g{color:${GOLD}}
.subq{top:1270px;font-size:74px;}
.rlabel{position:absolute;top:470px;left:0;right:0;text-align:center;font-size:44px;letter-spacing:8px;color:${GOLD};opacity:.85;}
.statname{position:absolute;top:560px;left:0;right:0;text-align:center;font-size:104px;color:${GOLD};-webkit-text-stroke:9px ${NAVY};paint-order:stroke fill;}
.snums{position:absolute;top:760px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:60px;font-size:230px;-webkit-text-stroke:12px ${NAVY};paint-order:stroke fill;}
.snums .na{color:${O}}.snums .nb{color:${T}}.snums .vs2{color:${CREAM};font-size:96px;}
.track{position:absolute;top:1120px;left:120px;right:120px;height:52px;border-radius:30px;overflow:hidden;display:flex;border:5px solid rgba(245,235,220,.18);background:#0e2330;}
.track .fa{background:${O};}.track .fb{background:${T};flex:1;}
.wlabel{position:absolute;top:1230px;left:0;right:0;text-align:center;font-size:60px;-webkit-text-stroke:7px ${NAVY};paint-order:stroke fill;opacity:0;}
.scene.on .statname{animation:slam .26s cubic-bezier(.2,1.5,.4,1) both;}.scene.on .snums{animation:slam .3s .04s cubic-bezier(.2,1.4,.4,1) both;}
.qbig{top:780px;font-size:150px;}
.winnerlbl{position:absolute;top:360px;left:0;right:0;text-align:center;font-size:64px;color:${GOLD};letter-spacing:4px;-webkit-text-stroke:6px ${NAVY};paint-order:stroke fill;}
.winnerlbl .u{display:block;width:220px;height:8px;background:${GOLD};margin:14px auto 0;border-radius:6px;}
.wglow{position:absolute;top:520px;width:452px;height:600px;border-radius:23%/17%;box-shadow:0 0 130px 12px rgba(224,168,62,.85);}
#s_win .pname{display:none;}#s_win.on{animation:shake .5s cubic-bezier(.36,.07,.19,.97) both;}.scene.on .wglow{animation:burst .55s .12s both;}#s_win .flash{background:radial-gradient(circle at 50% 42%, rgba(255,233,194,.95), #fff 55%);}
.xmark{position:absolute;top:640px;font-size:300px;color:#e2402f;z-index:6;-webkit-text-stroke:14px ${NAVY};paint-order:stroke fill;opacity:0;}
.scene.on .xmark{animation:xin .4s .25s cubic-bezier(.2,1.6,.4,1) both;}
.bigwin{position:absolute;top:1200px;left:0;right:0;text-align:center;font-size:112px;color:${GOLD};-webkit-text-stroke:11px ${NAVY};paint-order:stroke fill;}
.scene.on .winnerlbl,.scene.on .bigwin{animation:slam .32s .1s cubic-bezier(.2,1.5,.4,1) both;}
.vlabel{position:absolute;top:560px;left:0;right:0;text-align:center;font-size:44px;letter-spacing:6px;color:${GOLD};}
.vquote{position:absolute;top:720px;left:90px;right:90px;text-align:center;font-family:'R';font-size:64px;line-height:1.32;color:${CREAM};}
.vquote .mark{color:${GOLD};font-size:120px;line-height:0;vertical-align:-30px;}
.scene.on .vquote{animation:upIn .5s .1s both;}
.vbar{position:absolute;top:1040px;left:90px;right:90px;height:74px;border-radius:40px;overflow:hidden;display:flex;border:6px solid rgba(245,235,220,.2);}
.vbar .a{background:${O};}.vbar .b{background:${T};flex:1;}
.vpc{position:absolute;top:1150px;left:90px;right:90px;display:flex;justify-content:space-between;font-size:108px;-webkit-text-stroke:9px ${NAVY};paint-order:stroke fill;}
.vpc .pa{color:${O}}.vpc .pb{color:${T}}
.ctaq{top:430px;font-size:118px;}.ctabig{position:absolute;top:1120px;left:0;right:0;text-align:center;font-family:'R';font-size:120px;color:${CREAM};}
.ctah{position:absolute;top:1280px;left:0;right:0;text-align:center;font-size:52px;color:${GOLD};}
@keyframes slam{from{opacity:0;transform:scale(.6)}70%{transform:scale(1.07)}to{opacity:1;transform:scale(1)}}
@keyframes inL{from{opacity:0;transform:translateX(-120px)}to{opacity:1;transform:none}}@keyframes inR{from{opacity:0;transform:translateX(120px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:translateX(-50%) scale(.2)}to{opacity:1;transform:translateX(-50%) scale(1)}}
@keyframes flash{from{opacity:.92}to{opacity:0}}@keyframes xin{from{opacity:0;transform:scale(2) rotate(-18deg)}to{opacity:1;transform:scale(1) rotate(-10deg)}}
@keyframes drift{from{transform:scale(1)}to{transform:scale(1.05)}}
@keyframes shake{10%,90%{transform:translateX(-7px)}20%,80%{transform:translateX(9px)}30%,50%,70%{transform:translateX(-15px)}40%,60%{transform:translateX(15px)}}
@keyframes burst{0%{opacity:0;transform:scale(.5)}60%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
@keyframes upIn{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:none}}
</style></head><body>
<div class="root"><div class="dots"></div><div class="grain"></div>
 <div class="scene" id="s_hook"><div class="cap title"><span class=o>${a.name}</span> <span class="g">vs</span> <span class=t>${b.name}</span></div>
  <div class="sq l" style="--tc:${O}">${card({ ...a, col: O })}</div><div class="sq r" style="--tc:${T}">${card({ ...b, col: T })}</div>
  <div class="vs">VS</div><div class="cap subq">who <span class="g">actually</span> wins?</div><div class="flash"></div></div>
 ${stats}
 <div class="scene" id="s_sus"><div class="cap qbig">SO WHO<br>WINS<span class="g">?</span></div></div>
 <div class="scene" id="s_win"><div class="winnerlbl">WINNER<span class="u"></span></div>
  <div class="sq l" style="--tc:${O}">${card({ ...a, col: O, dim: M.winner === 'b' })}</div>
  <div class="sq r" style="--tc:${T}">${card({ ...b, col: T, dim: M.winner === 'a' })}</div>
  <div class="wglow" style="${M.winner === 'b' ? 'right:60px;left:auto' : 'left:60px'}"></div>
  <div class="xmark" style="${M.winner === 'b' ? 'left:150px' : 'right:150px'}">X</div>
  <div class="bigwin">${M[M.winner].name} WINS</div><div class="flash"></div></div>
 <div class="scene" id="s_verdict"><div class="vlabel">THE VERDICT</div><div class="vquote"><span class="mark">&ldquo;</span>${M.verdict}<span class="mark">&rdquo;</span></div></div>
 <div class="scene" id="s_twist"><div class="cap title">BUT FANS<br><span class="g">DISAGREE</span></div>
  <div class="vbar"><div class="a" style="width:${M.voteA}%"></div><div class="b"></div></div>
  <div class="vpc"><span class="pa">${M.voteA}%</span><span class="pb">${M.voteB}%</span></div>
  <div class="cap" style="top:1330px;font-size:60px">${M.voteA >= M.voteB ? a.name : b.name} is <span class="g">winning the vote</span></div></div>
 <div class="scene" id="s_cta"><div class="cap ctaq">who's <span class="g">YOUR</span><br>pick?</div><div class="ctabig">mythique</div><div class="ctah">@mythiqueapp  ·  34,000+ characters</div></div>
</div>
<script>
function cu(el,to,d){var t0=null;function s(ts){if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/d);el.textContent=Math.round(k*to);if(k<1)requestAnimationFrame(s);}requestAnimationFrame(s);}
var tl=[['s_hook',0,1900],['s_stat0',1900,950],['s_stat1',2850,950],['s_stat2',3800,950],['s_sus',4750,850],['s_win',5600,1900],['s_verdict',7500,1900],['s_twist',9400,1800],['s_cta',11200,1900]];
tl.forEach(function(t){setTimeout(function(){var el=document.getElementById(t[0]);if(!el)return;el.classList.add('on');el.querySelectorAll('.cnt').forEach(function(c){cu(c,parseInt(c.dataset.to),420);});var w=el.querySelector('.wlabel');if(w)setTimeout(function(){w.style.transition='opacity .2s';w.style.opacity=1;},430);},t[1]);setTimeout(function(){var el=document.getElementById(t[0]);if(el)el.classList.remove('on');},t[1]+t[2]);});
</script></body></html>`;
}

function buildMatchup(h) {
  return {
    a: { name: h.ka.name.toUpperCase(), img: h.portraitA, flip: false },
    b: { name: h.kb.name.toUpperCase(), img: h.portraitB, flip: true },
    winner: h.winner, verdict: h.verdict, voteA: h.voteA, voteB: h.voteB,
    stats: [
      ['COMBAT', h.ka.combat ?? 0, h.kb.combat ?? 0],
      ['SPEED', h.ka.speed ?? 0, h.kb.speed ?? 0],
      ['INTELLIGENCE', h.ka.intelligence ?? 0, h.kb.intelligence ?? 0],
    ],
  };
}

function caption(M) {
  const a = M.a.name, b = M.b.name, w = M[M.winner].name;
  const lead = M.voteA >= M.voteB ? a : b;
  return [
    `${a} vs ${b}: who actually wins? 🥊`, ``,
    `Our model says ${w}. But the fans have ${lead} ahead ${Math.max(M.voteA, M.voteB)}/${Math.min(M.voteA, M.voteB)} 👀`,
    `"${M.verdict}"`, ``,
    `Who's your pick? Settle it on mythique.app`, ``,
    `#whowouldwin #${a.replace(/[^a-z0-9]/gi, '')} #${b.replace(/[^a-z0-9]/gi, '')} #superheroes #anime #marvel #dc #powerscaling #mythique`,
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
    const dir = join(OUT_DIR, slugFor(s));
    mkdirSync(dir, { recursive: true });
    const mp4 = join(dir, 'video.mp4');
    console.log(`Rendering ${slugFor(s)} ...`);
    await renderVideo(buildHtml(M, F), mp4, dir);
    writeFileSync(join(dir, 'caption.txt'), caption(M));
    console.log(`  -> ${mp4}\n  -> ${join(dir, 'caption.txt')}`);
  }
  console.log('\nDone. Add a trending sound in-app when you upload.');
}

main().catch((e) => { console.error(e); process.exit(1); });
