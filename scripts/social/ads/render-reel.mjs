// Face-free reel renderer — scene-timeline 9:16 video, zero portraits.
// Visual grammar borrowed from generate-reels.mjs (slam/pop/flash/count-ups)
// on the ink+gold brand stage; DISCLAIMER always visible in the footer.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderVideo, renderPng, COLORS, grainUri, fontFace } from '../lib.mjs';
import { DISCLAIMER } from '../safety.mjs';
import { assertNoPortrait } from './safe-assert.mjs';

const { O, T, GOLD, CREAM, NAVY } = COLORS;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// scenes: [{ id, html, ms }] — the script toggles .on per the timeline and
// runs count-ups for any .cnt[data-to] inside the active scene.
// still=true: render only scenes[0], pre-toggled 'on' with all animations
// and count-ups snapped to their final state — used for the poster frame.
function reelShell(F, scenes, { still = false } = {}) {
  const grain = grainUri();
  const stillCss = still
    ? `.in1,.in2,.in3,.slam{animation:none!important;opacity:1!important;transform:none!important}
.flash{animation:none!important;opacity:0!important}
.fill{transition:none!important}`
    : '';
  const css = `${fontFace(F)}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;background:${NAVY};font-family:'F'}
.root{position:relative;width:1080px;height:1920px;overflow:hidden;background:radial-gradient(60% 44% at 50% 34%, rgba(224,168,62,.12), transparent 62%), radial-gradient(120% 90% at 50% 10%, #12242f, ${NAVY} 70%)}
.dots{position:absolute;inset:0;background-image:radial-gradient(circle, rgba(224,168,62,.10) 1.4px, transparent 2px);background-size:30px;-webkit-mask-image:radial-gradient(130% 100% at 50% 40%, transparent 40%, #000);opacity:.6}
.grain{position:absolute;inset:0;background-image:url("${grain}");background-size:340px;opacity:.05;mix-blend-mode:overlay}
.scene{position:absolute;inset:0;opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 90px}.scene.on{opacity:1}
.eyebrow{font-size:34px;letter-spacing:.26em;color:${GOLD};margin-bottom:34px}
.big{font-size:120px;line-height:1;color:${CREAM};-webkit-text-stroke:10px ${NAVY};paint-order:stroke fill}
.huge{font-size:200px;color:${GOLD};-webkit-text-stroke:12px ${NAVY};paint-order:stroke fill}
.mut{font-size:40px;color:#9db4c4;margin-top:26px}
.gold{color:${GOLD}}.orange{color:${O}}.teal{color:${T}}
.track{width:100%;height:52px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);overflow:hidden;margin-top:16px}
.fill{height:100%;border-radius:999px;background:linear-gradient(90deg, ${O}, ${GOLD});width:0;transition:width .8s cubic-bezier(.16,1,.3,1)}
.flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}.scene.on .flash{animation:flash .4s ease-out both}
.scene.on .in1{animation:upIn .5s cubic-bezier(.16,1,.3,1) both}.scene.on .in2{animation:upIn .5s .15s cubic-bezier(.16,1,.3,1) both}.scene.on .in3{animation:upIn .5s .3s cubic-bezier(.16,1,.3,1) both}
.scene.on .slam{animation:slam .45s cubic-bezier(.2,1.7,.4,1) both}
.foot{position:absolute;bottom:56px;left:0;right:0;text-align:center;opacity:.85}
.foot .wm{font-family:'R';font-size:44px;color:${CREAM}}.foot .at{font-size:30px;color:${GOLD};margin-left:14px}
.foot .disc{font-family:-apple-system,Arial,sans-serif;font-size:24px;color:rgba(245,235,220,.5);margin-top:10px}
@keyframes upIn{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:none}}
@keyframes slam{from{opacity:0;transform:scale(.55)}70%{transform:scale(1.07)}to{opacity:1;transform:scale(1)}}
@keyframes flash{from{opacity:.9}to{opacity:0}}
${stillCss}`;
  const body = scenes
    .map((s, i) => `<div class="scene${still && i === 0 ? ' on' : ''}" id="${s.id}">${s.html}<div class="flash"></div></div>`)
    .join('');
  let script;
  if (still) {
    script = `document.querySelectorAll('.cnt').forEach(el=>{el.textContent=el.dataset.to});
document.querySelectorAll('.fill').forEach(el=>{el.style.width=el.dataset.w+'%'});`;
  } else {
    const timeline = scenes.map((s) => s.ms);
    const ids = scenes.map((s) => s.id);
    script = `const T=${JSON.stringify(timeline)};const ids=${JSON.stringify(ids)};let t=300;
ids.forEach((id,i)=>{setTimeout(()=>{document.querySelectorAll('.scene.on').forEach(e=>e.classList.remove('on'));
const sc=document.getElementById(id);sc.classList.add('on');
sc.querySelectorAll('.cnt').forEach(el=>{const to=+el.dataset.to;const t0=performance.now();const step=(now)=>{const p=Math.min(1,(now-t0)/700);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)});
sc.querySelectorAll('.fill').forEach(el=>{requestAnimationFrame(()=>{el.style.width=el.dataset.w+'%'})});
},t);t+=T[i];});`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="root"><div class="dots"></div><div class="grain"></div>${body}<div class="foot"><span class="wm">mythique</span><span class="at">@mythiqueapp</span><div class="disc">${DISCLAIMER}</div></div><script>${script}</script></div></body></html>`;
}

const SCENES = {
  matchup: (e) => {
    const { a, b, rounds } = e.data;
    const round = (r, i) => ({ id: `r${i}`, ms: 2300, html: `
      <div class="eyebrow in1">ROUND ${i + 1} · ${r[0]}</div>
      <div class="big in2"><span class="orange cnt" data-to="${r[1]}">0</span> <span class="gold">vs</span> <span class="teal cnt" data-to="${r[2]}">0</span></div>
      <div class="track in3"><div class="fill" data-w="${Math.round((r[1] / (r[1] + r[2])) * 100)}"></div></div>
      <div class="mut in3">${r[1] >= r[2] ? a.name : b.name} takes it</div>` });
    return [
      { id: 'hook', ms: 1600, html: `<div class="eyebrow slam">WHO WOULD WIN?</div><div class="big slam">${a.name}<br><span class="gold">vs</span><br>${b.name}</div>` },
      ...rounds.slice(0, 3).map(round),
      { id: 'cta', ms: 3300, html: `<div class="big slam">Who’s right?</div><div class="mut in2">The stats say one thing.<br>The fans say another.</div><div class="mut in3 gold" style="font-size:48px;margin-top:44px">Vote · mythique.app</div>` },
    ];
  },
  ranking: (e) => {
    const { label, rows } = e.data;
    const item = (r, rank, ms) => ({ id: `k${rank}`, ms, html: `
      <div class="eyebrow in1">TOP 10 ${label.toUpperCase()}</div>
      <div class="huge slam">#${rank}</div><div class="big in2" style="font-size:96px">${r.name}</div>
      <div class="track in3" style="width:70%"><div class="fill" data-w="${r.value}"></div></div><div class="mut in3">${r.value}/100</div>` });
    const picks = [rows[9], rows[6], rows[4], rows[2], rows[1], rows[0]]; // 10,7,5,3,2,1
    const ranks = [10, 7, 5, 3, 2, 1];
    return [
      { id: 'hook', ms: 1600, html: `<div class="eyebrow slam">THE COUNTDOWN</div><div class="big slam">Top 10<br><span class="gold">${label}</span></div>` },
      ...picks.map((r, i) => item(r, ranks[i], i === picks.length - 1 ? 2200 : 1500)),
      { id: 'cta', ms: 2400, html: `<div class="big slam">Agree?</div><div class="mut in2 gold" style="font-size:48px;margin-top:40px">Full top 100 · mythique.app</div>` },
    ];
  },
  guess: (e) => {
    const g = e.data;
    const s = Object.entries(g.stats);
    const statLines = s.map(([k, v], i) => `<div class="in${Math.min(3, i + 1)}" style="display:flex;justify-content:space-between;width:100%;font-size:44px;padding:12px 0;border-bottom:1px solid rgba(224,168,62,.14)"><span style="letter-spacing:.14em;color:#9db4c4">${k.toUpperCase()}</span><span class="gold cnt" data-to="${v}">0</span></div>`).join('');
    return [
      { id: 'hook', ms: 1600, html: `<div class="eyebrow slam">GUESS THE HERO</div><div class="big slam">Six stats.<br>One legend.</div>` },
      { id: 'stats', ms: 3600, html: `<div style="width:82%">${statLines}</div><div class="mut in3" style="margin-top:40px">Who is it?</div>` },
      { id: 'c3', ms: 900, html: `<div class="huge slam">3</div>` },
      { id: 'c2', ms: 900, html: `<div class="huge slam">2</div>` },
      { id: 'c1', ms: 900, html: `<div class="huge slam">1</div>` },
      { id: 'reveal', ms: 4100, html: `<div class="eyebrow in1">IT’S</div><div class="big slam" style="font-size:150px">${g.name}</div><div class="mut in3 gold" style="font-size:44px;margin-top:44px">Did you get it? · mythique.app</div>` },
    ];
  },
  fact: (e) => {
    const f = e.data;
    return [
      { id: 'hook', ms: 1800, html: `<div class="eyebrow slam">DID YOU KNOW</div><div class="big slam" style="font-size:92px">${f.headline}</div>` },
      { id: 'stat', ms: 3600, html: `<div class="huge slam">${f.stat}</div><div class="mut in2" style="font-size:48px">${f.detail}</div>` },
      { id: 'cta', ms: 3200, html: `<div class="big slam" style="font-size:88px">There’s a file<br>on everyone.</div><div class="mut in3 gold" style="font-size:48px;margin-top:44px">35,000+ files · mythique.app</div>` },
    ];
  },
};

export async function renderReel(entry, { outDir, F }) {
  const dir = join(outDir, `${String(entry.ord).padStart(2, '0')}-${slug(entry.title)}`);
  mkdirSync(dir, { recursive: true });
  const scenes = SCENES[entry.angle](entry);
  const html = reelShell(F, scenes);
  assertNoPortrait(html, `reel:${entry.angle}:${entry.title}`);
  const mp4 = join(dir, 'reel.mp4');
  await renderVideo(html, mp4, dir);
  // Poster = the hook scene as a still (for the Publish tab thumbnail).
  const posterHtml = reelShell(F, [scenes[0]], { still: true });
  assertNoPortrait(posterHtml, `poster:${entry.angle}`);
  const poster = join(dir, 'poster.png');
  await renderPng(posterHtml, poster, 1080, 1920);
  writeFileSync(join(dir, 'caption.txt'), `${entry.caption}\n\n♪ ${entry.music}`);
  return { dir, mp4, poster };
}
