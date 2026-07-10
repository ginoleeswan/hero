// Face-free reel renderer — scene-timeline 9:16 video, zero franchise IP.
// Brand kit is IN the frame: the Mythique logo mark rides top-center on every
// scene, the real wordmark PNG anchors the footer, and the Mythique mascot
// (original IP — the one character face allowed in ads) fronts every hook as
// the recurring series face. Design language: a LIVING stage (drifting
// constellation + breathing gold bloom), soft crossfades (no white strobe),
// persistent anchors (plates, pips, ring), data-graphics (tug-of-war bars,
// rank bars, the hexagonal stat radar), and spectacle where it counts —
// rotating light rays + rising sparks behind the big reveals. Display type is
// Flame-Regular ('FR') — never Flame-Bold — with FlameSans ('S') support.
// DISCLAIMER always in the footer.
import { mkdirSync, writeFileSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderVideo, renderPng, COLORS, grainUri, fontFace, ROOT } from '../lib.mjs';
import { DISCLAIMER } from '../safety.mjs';
import { assertNoPortrait } from './safe-assert.mjs';
import { rng } from './plan.mjs';
import { silhouette, SILHOUETTE_KINDS } from './silhouettes.mjs';

const { O, T, GOLD, CREAM, NAVY } = COLORS;
const MUT = '#9db4c4';
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
// Platform safe zones (1080x1920) — the union of TikTok / Reels / Shorts UI
// overlays. Nothing legible may sit in the top band (status bar + Dynamic
// Island + platform tabs) or the bottom band (caption + handle + music +
// progress + nav). Every critical element lives between these.
const SAFE = { top: 210, bottom: 470, side: 76, markTop: 226, contentBottom: 576, footBottom: 490 };
// Beat grid — all scene durations snap to musical beats (130 BPM) so cuts land
// on the beat of whatever trending audio gets added in-app.
const BEAT = 60000 / 130; // ≈ 461.5ms
const beats = (n) => Math.round(BEAT * n);

// ── Brand kit (local files → data URIs; the safety gate allows data:) ─────────
const pngUri = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const svgUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
const BRAND = {
  logo: svgUri(readFileSync(join(ROOT, 'assets/mythique-logo.svg'), 'utf8')),
  wordmark: pngUri(join(ROOT, 'public/brand/wordmark-cream.png')),
  mascot: pngUri(join(ROOT, 'public/brand/mascot-bust.png')),
};

// ── Ambient constellation (two parallax layers, slow drift) ──────────────────
function ambientSvg(seed, w = 1400, h = 2300) {
  const r = rng(seed);
  const N = 26;
  let out = '';
  for (let i = 0; i < N; i++) {
    const x = (r() * w).toFixed(0), y = (r() * h).toFixed(0);
    const big = r() > 0.8;
    const c = r() > 0.88 ? T : r() > 0.72 ? O : GOLD;
    if (big) out += `<circle cx="${x}" cy="${y}" r="16" fill="${c}" opacity="0.10"/>`;
    out += `<circle cx="${x}" cy="${y}" r="${big ? 6 : 2.6 + r() * 2}" fill="${c}" opacity="${(0.25 + r() * 0.4).toFixed(2)}"/>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
}

// ── Hexagonal stat radar (guess angle) — draws itself in ─────────────────────
function radarSvg(stats, width = 660) {
  const KEYS = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'];
  const LAB = ['INT', 'STR', 'SPD', 'DUR', 'PWR', 'CMB'];
  const R = width * 0.3, cx = width / 2, LR = 1.22;
  const pad = width * 0.09, cy = R * LR + pad, H = Math.round(cy + R * LR + pad);
  const ang = (i) => ((-90 + 60 * i) * Math.PI) / 180;
  const pt = (i, rr) => [cx + rr * Math.cos(ang(i)), cy + rr * Math.sin(ang(i))];
  const poly = (rr) => KEYS.map((_, i) => pt(i, rr).map((n) => n.toFixed(1)).join(',')).join(' ');
  let rings = '';
  for (const f of [0.33, 0.66, 1]) rings += `<polygon points="${poly(R * f)}" fill="none" stroke="rgba(246,237,221,0.10)" stroke-width="2"/>`;
  const dp = KEYS.map((k, i) => pt(i, (R * (stats[k] ?? 0)) / 100).map((n) => n.toFixed(1)).join(',')).join(' ');
  const dots = KEYS.map((k, i) => { const [x, y] = pt(i, (R * (stats[k] ?? 0)) / 100); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${GOLD}"/>`; }).join('');
  const labs = KEYS.map((k, i) => {
    const [x, y] = pt(i, R * LR);
    const anchor = Math.abs(x - cx) < width * 0.04 ? 'middle' : x > cx ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" style="font-family:'S';font-size:${Math.round(width * 0.045)}px;letter-spacing:.08em;fill:${MUT}">${LAB[i]} <tspan fill="${GOLD}">${stats[k] ?? 0}</tspan></text>`;
  }).join('');
  // Horizontal margin so the side labels (end/start-anchored text) never clip
  // at the SVG bounds.
  const mx = Math.round(width * 0.2);
  return `<svg width="${width + mx * 2}" height="${H}" viewBox="-${mx} 0 ${width + mx * 2} ${H}"><polygon points="${dp}" fill="rgba(224,168,62,0.16)" stroke="${GOLD}" stroke-width="5" stroke-linejoin="round"/>${rings}${dots}${labs}</svg>`;
}

// ── Shared fragments ──────────────────────────────────────────────────────────
// Editorial hook layout — the mascot bust gazes viewer-left, so he anchors the
// RIGHT of the frame with the copy block sitting in his gaze line on the left.
// The bust gets a slow push-in + a soft visor-glow pulse so it reads as video,
// never as a pasted still.
const hookLayout = (title, sub, { mascotH = 900 } = {}) => `
  <div class="hook">
    <div class="mwrap" style="height:${mascotH}px">
      <div class="mglow"></div>
      <img class="mascot" src="${BRAND.mascot}" style="height:${mascotH}px">
      <div class="visor"></div>
    </div>
    <div class="hcopy">
      <div class="in1">${title}</div>
      ${sub ? `<div class="mut in2" style="margin-top:22px">${sub}</div>` : ''}
    </div>
  </div>`;
const plates = (aName, bName, glow = null) => `
  <div class="plates">
    <div class="pcol"><div class="plate po ${glow === 'a' ? 'lit' : ''}">${silhouette('spikes', { size: 230, rim: O })}</div><div class="pname" style="color:${O}">${aName}</div></div>
    <div class="vscoin">VS</div>
    <div class="pcol"><div class="plate pt ${glow === 'b' ? 'lit' : ''}">${silhouette('cowl', { size: 230, rim: T })}</div><div class="pname" style="color:${T}">${bName}</div></div>
  </div>`;
const pips = (total, lit) => `<div class="pips">${Array.from({ length: total }, (_, i) => `<span class="pip ${i < lit ? 'lit' : ''}"></span>`).join('')}</div>`;
const ring = (n) => `
  <div class="ringwrap"><svg width="420" height="420" viewBox="0 0 420 420">
    <circle cx="210" cy="210" r="180" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="14"/>
    <circle class="sweep" cx="210" cy="210" r="180" fill="none" stroke="${GOLD}" stroke-width="14" stroke-linecap="round" stroke-dasharray="1131" stroke-dashoffset="1131" transform="rotate(-90 210 210)"/>
  </svg><div class="ringnum">${n}</div></div>`;
// Reveal spectacle: rotating light rays + rising sparks (used with bloom).
const rays = `<div class="rays"></div>`;
const sparks = `<div class="sparks">${Array.from({ length: 10 }, (_, i) => `<span class="spark s${i}"></span>`).join('')}</div>`;

// scenes: [{ id, html, ms, bloom? }] — the driver crossfades scenes (fade out
// old, 180ms breath on the living stage, slide-fade the next in) and runs
// count-ups (.cnt[data-to]) + bar fills (.fill/.fa/.fb[data-w]) per scene.
function reelShell(F, scenes, { still = false, seed = 11, guide = false } = {}) {
  const grain = grainUri();
  const amb1 = svgUri(ambientSvg(seed));
  const amb2 = svgUri(ambientSvg(seed + 5));
  const stillCss = still
    ? `.in1,.in2,.in3,.in4,.rise,.sweep,.plate,.vscoin,.mwrap{animation:none!important;opacity:1!important;transform:none!important}
.scene{transition:none!important}.fill{transition:none!important}`
    : '';
  const sparkCss = Array.from({ length: 10 }, (_, i) => {
    const x = 8 + ((i * 97) % 84), d = 2.6 + ((i * 37) % 20) / 10, dl = ((i * 53) % 14) / 10, sz = 6 + ((i * 31) % 10);
    return `.spark.s${i}{left:${x}%;width:${sz}px;height:${sz}px;animation-duration:${d}s;animation-delay:${dl}s}`;
  }).join('');
  const css = `${fontFace(F)}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;background:${NAVY};font-family:'FR'}
.root{position:relative;width:1080px;height:1920px;overflow:hidden;background:radial-gradient(120% 90% at 50% 8%, #12242f, ${NAVY} 72%)}
.amb{position:absolute;inset:-190px;background-image:url("${amb1}");background-size:1400px 2300px;animation:drift1 46s linear infinite alternate;opacity:.9}
.amb2{position:absolute;inset:-190px;background-image:url("${amb2}");background-size:1400px 2300px;animation:drift2 34s linear infinite alternate;opacity:.55}
.bloom{position:absolute;left:50%;top:30%;width:1400px;height:1400px;transform:translate(-50%,-50%);background:radial-gradient(circle, rgba(224,168,62,.16), transparent 60%);animation:breathe 7s ease-in-out infinite alternate}
.grain{position:absolute;inset:0;background-image:url("${grain}");background-size:340px;opacity:.05;mix-blend-mode:overlay}
.mark{position:absolute;top:${SAFE.markTop}px;left:${SAFE.side}px;width:150px;opacity:.92;z-index:6;filter:drop-shadow(0 4px 18px rgba(0,0,0,.55))}
.scene{position:absolute;top:${SAFE.top}px;bottom:${SAFE.contentBottom}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${SAFE.side}px;opacity:0;transform:translateY(26px);transition:opacity .42s ease,transform .6s cubic-bezier(.16,1,.3,1);pointer-events:none}
.scene.on{opacity:1;transform:none}
.eyebrow{font-family:'S';font-size:35px;letter-spacing:.26em;color:${GOLD};margin-bottom:36px}
.big{font-size:118px;line-height:1.04;color:${CREAM};-webkit-text-stroke:7px ${NAVY};paint-order:stroke fill}
.huge{font-size:210px;color:${GOLD};-webkit-text-stroke:9px ${NAVY};paint-order:stroke fill}
.mut{font-family:'S';font-size:40px;color:${MUT};margin-top:28px;line-height:1.35}
.gold{color:${GOLD}}.orange{color:${O}}.teal{color:${T}}
.scene.on .in1{animation:upIn .55s cubic-bezier(.16,1,.3,1) both}.scene.on .in2{animation:upIn .55s .14s cubic-bezier(.16,1,.3,1) both}
.scene.on .in3{animation:upIn .55s .28s cubic-bezier(.16,1,.3,1) both}.scene.on .in4{animation:upIn .55s .42s cubic-bezier(.16,1,.3,1) both}
.scene.on .rise{animation:rise .7s cubic-bezier(.2,1.4,.35,1) both}
.hook{position:absolute;inset:0}
.hcopy{position:absolute;left:${SAFE.side}px;right:400px;top:372px;text-align:left;z-index:4}
.hcopy .in1{font-size:108px;line-height:1.04;color:${CREAM};-webkit-text-stroke:7px ${NAVY};paint-order:stroke fill}
.hcopy .mut{margin-top:22px;text-align:left}
.mwrap{position:absolute;right:-110px;bottom:0;z-index:2}
.scene.on .mwrap{animation:mIn .9s cubic-bezier(.2,1.2,.3,1) both}
.mascot{position:relative;z-index:2;filter:drop-shadow(0 0 60px rgba(232,130,58,.35)) drop-shadow(0 24px 50px rgba(0,0,0,.6));animation:mPush 3.2s ease-out both;-webkit-mask-image:linear-gradient(180deg, #000 66%, rgba(0,0,0,.55) 82%, transparent 97%);mask-image:linear-gradient(180deg, #000 66%, rgba(0,0,0,.55) 82%, transparent 97%)}
.visor{position:absolute;left:34%;top:33%;width:34%;height:9%;z-index:3;background:radial-gradient(50% 50% at 50% 50%, rgba(240,160,90,.55), transparent 70%);mix-blend-mode:screen;animation:visorPulse 2.4s ease-in-out infinite alternate}
.mglow{position:absolute;left:50%;top:52%;width:1000px;height:1000px;transform:translate(-50%,-50%);background:radial-gradient(circle, rgba(232,130,58,.30), rgba(224,168,62,.10) 45%, transparent 65%);z-index:1}
/* Equal fixed-width columns: the VS coin stays dead-center no matter how the
   two names differ in length (a name-width pcol shifts the coin off axis). */
.plates{display:flex;align-items:flex-start;justify-content:center;gap:36px;margin-bottom:52px;width:100%}
.pcol{display:flex;flex-direction:column;align-items:center;gap:18px;width:330px;flex:none}
.plates .vscoin{margin-top:72px}
.plate{width:290px;height:290px;border-radius:26%;background:rgba(255,255,255,.035);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;box-shadow:0 26px 60px -22px rgba(0,0,0,.75);transition:box-shadow .5s}
.plate svg{margin-bottom:-6px}
.po{border:9px solid ${O};color:${O}}.pt{border:9px solid ${T};color:${T}}
.po.lit{box-shadow:0 0 90px -6px rgba(232,130,58,.75), 0 26px 60px -22px rgba(0,0,0,.75)}
.pt.lit{box-shadow:0 0 90px -6px rgba(79,179,208,.75), 0 26px 60px -22px rgba(0,0,0,.75)}
.scene.on .plate{animation:rise .6s cubic-bezier(.2,1.4,.35,1) both}
.pname{font-size:46px;line-height:1.12;-webkit-text-stroke:6px ${NAVY};paint-order:stroke fill}
.vscoin{width:146px;height:146px;border-radius:50%;background:${NAVY};border:6px solid ${GOLD};color:${GOLD};display:flex;align-items:center;justify-content:center;font-size:62px;box-shadow:0 0 56px rgba(224,168,62,.55);flex:none}
.scene.on .vscoin{animation:pop .5s .2s cubic-bezier(.2,1.7,.4,1) both}
.pips{display:flex;gap:14px;margin-bottom:40px}
.pip{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.12)}
.pip.lit{background:${GOLD};box-shadow:0 0 14px rgba(224,168,62,.7)}
.tug{width:100%;height:60px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);overflow:hidden;position:relative;margin-top:20px}
.tug .fa{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg, ${O}, #f0a05c);width:0;transition:width .9s cubic-bezier(.16,1,.3,1)}
.tug .fb{position:absolute;right:0;top:0;bottom:0;background:linear-gradient(270deg, ${T}, #7cc7dd);width:0;transition:width .9s cubic-bezier(.16,1,.3,1)}
.tug .notch{position:absolute;left:50%;top:-6px;bottom:-6px;width:4px;background:rgba(245,235,220,.5);transform:translateX(-50%)}
.track{width:100%;height:54px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);overflow:hidden;margin-top:18px}
.fill{height:100%;border-radius:999px;background:linear-gradient(90deg, ${O}, ${GOLD});width:0;transition:width .9s cubic-bezier(.16,1,.3,1);box-shadow:0 0 26px rgba(224,168,62,.5)}
.ringwrap{position:relative;width:420px;height:420px;display:flex;align-items:center;justify-content:center}
.ringnum{position:absolute;font-size:170px;color:${CREAM};-webkit-text-stroke:8px ${NAVY};paint-order:stroke fill}
.scene.on .sweep{animation:sweep .85s cubic-bezier(.4,0,.3,1) both}
.radar .in2 svg{filter:drop-shadow(0 0 34px rgba(224,168,62,.35))}
.rays{position:absolute;left:50%;top:44%;width:1700px;height:1700px;transform:translate(-50%,-50%);border-radius:50%;background:repeating-conic-gradient(from 0deg, rgba(224,168,62,.12) 0 7deg, transparent 7deg 16deg);-webkit-mask-image:radial-gradient(circle, #000 18%, transparent 62%);animation:spin 16s linear infinite;z-index:0}
.sparks{position:absolute;inset:0;pointer-events:none;z-index:1}
.spark{position:absolute;bottom:16%;border-radius:50%;background:${GOLD};box-shadow:0 0 14px rgba(224,168,62,.9);opacity:0;animation-name:sparkUp;animation-timing-function:ease-out;animation-iteration-count:infinite}
${sparkCss}
.bloomhit{position:absolute;inset:0;background:radial-gradient(70% 55% at 50% 42%, rgba(224,168,62,.4), transparent 70%);opacity:0;pointer-events:none}
.scene.on .bloomhit{animation:bloomhit 1s ease-out both}
.sideglow{position:absolute;inset:0;opacity:0;pointer-events:none}
.scene.on .sideglow{animation:sideIn .7s .5s ease-out both}
/* Winner glow: radius sized so the visible falloff completes INSIDE the frame
   (a wider ellipse clips flat against the edge). */
.sideglow.a{background:radial-gradient(30% 26% at 26% 36%, rgba(232,130,58,.30), transparent 70%)}
.sideglow.b{background:radial-gradient(30% 26% at 74% 36%, rgba(79,179,208,.30), transparent 70%)}
.foot{position:absolute;bottom:${SAFE.footBottom}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:10px;opacity:.9;z-index:5}
.foot .wmimg{height:52px}
.foot .disc{font-family:-apple-system,Arial,sans-serif;font-size:24px;color:rgba(245,235,220,.5)}
.esc1,.esc2,.esc3{display:flex;flex-direction:column;align-items:center;width:100%}
.esc1{transform:scale(1)}.esc2{transform:scale(1.04)}.esc3{transform:scale(1.08)}
.scene.on .shake{animation:shake .5s .9s cubic-bezier(.36,.07,.19,.97) both}
.ghosts{position:absolute;left:${SAFE.side}px;top:236px;text-align:left;z-index:1;opacity:.5}
.ghosts div{font-family:'S';font-size:34px;color:${MUT};margin-bottom:10px}
.ghosts b{color:${GOLD};font-family:'FR';margin-right:14px}
@keyframes shake{10%,90%{transform:translateX(-6px)}20%,80%{transform:translateX(8px)}30%,50%,70%{transform:translateX(-12px)}40%,60%{transform:translateX(12px)}}
@keyframes mPush{from{transform:scale(1)}to{transform:scale(1.06)}}
@keyframes visorPulse{from{opacity:.35}to{opacity:.95}}
@keyframes upIn{from{opacity:0;transform:translateY(38px)}to{opacity:1;transform:none}}
@keyframes rise{from{opacity:0;transform:translateY(60px) scale(.92)}to{opacity:1;transform:none}}
@keyframes mIn{from{opacity:0;transform:translateY(90px) scale(.94)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}
@keyframes sweep{from{stroke-dashoffset:1131}to{stroke-dashoffset:0}}
@keyframes bloomhit{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
@keyframes sideIn{from{opacity:0}to{opacity:1}}
@keyframes spin{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes sparkUp{0%{opacity:0;transform:translateY(0) scale(1)}12%{opacity:1}100%{opacity:0;transform:translateY(-620px) scale(.4)}}
@keyframes drift1{from{transform:translate(0,0) scale(1)}to{transform:translate(-120px,-90px) scale(1.06)}}
@keyframes drift2{from{transform:translate(0,0)}to{transform:translate(90px,-130px)}}
@keyframes breathe{from{opacity:.7;transform:translate(-50%,-50%) scale(1)}to{opacity:1;transform:translate(-50%,-50%) scale(1.12)}}
${stillCss}
.safeguide{position:absolute;inset:0;z-index:99;pointer-events:none}
.safeguide .z{position:absolute;left:0;right:0;background:rgba(230,60,60,.28);border:2px dashed rgba(255,120,120,.8)}
.safeguide .zt{top:0;height:${SAFE.top}px}
.safeguide .zb{bottom:0;height:${SAFE.bottom}px}
.safeguide .zr{position:absolute;right:0;bottom:${SAFE.bottom}px;width:150px;height:760px;background:rgba(230,60,60,.20);border:2px dashed rgba(255,120,120,.6)}
.safeguide .lbl{position:absolute;left:20px;color:#fff;font-family:-apple-system,Arial,sans-serif;font-size:26px;font-weight:800;text-shadow:0 1px 3px #000}`;
  const body = scenes
    .map((s, i) => `<div class="scene${still && i === 0 ? ' on' : ''}" id="${s.id}">${s.bloom ? `${rays}${sparks}<div class="bloomhit"></div>` : ''}${s.html}</div>`)
    .join('');
  let script;
  if (still) {
    script = `document.querySelectorAll('.cnt').forEach(el=>{el.textContent=el.dataset.to});
document.querySelectorAll('.fill').forEach(el=>{el.style.width=el.dataset.w+'%'});
document.querySelectorAll('.fa').forEach(el=>{el.style.width=el.dataset.w+'%'});
document.querySelectorAll('.fb').forEach(el=>{el.style.width=(100-el.dataset.w)+'%'});`;
  } else {
    const timeline = scenes.map((s) => s.ms);
    const ids = scenes.map((s) => s.id);
    // Crossfade driver: fade the old scene out, give the living stage a 180ms
    // breath, then slide the next in and start its counters/fills.
    script = `const T=${JSON.stringify(timeline)};const ids=${JSON.stringify(ids)};let t=300;
ids.forEach((id,i)=>{setTimeout(()=>{
document.querySelectorAll('.scene.on').forEach(e=>e.classList.remove('on'));
setTimeout(()=>{const sc=document.getElementById(id);sc.classList.add('on');
sc.querySelectorAll('.cnt').forEach(el=>{const to=+el.dataset.to;const t0=performance.now();const step=(now)=>{const p=Math.min(1,(now-t0)/750);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)});
sc.querySelectorAll('.fill').forEach(el=>{requestAnimationFrame(()=>{el.style.width=el.dataset.w+'%'})});
sc.querySelectorAll('.fa').forEach(el=>{requestAnimationFrame(()=>{el.style.width=el.dataset.w+'%'})});
sc.querySelectorAll('.fb').forEach(el=>{requestAnimationFrame(()=>{el.style.width=(100-el.dataset.w)+'%'})});
}, i===0?0:180);
},t);t+=T[i];});`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="root"><div class="amb"></div><div class="amb2"></div><div class="bloom"></div><div class="grain"></div><img class="mark" src="${BRAND.logo}">${guide ? `<div class="safeguide"><div class="z zt"></div><span class="lbl" style="top:16px">TOP UI</span><div class="z zb"></div><span class="lbl" style="bottom:16px">CAPTION / NAV</span><div class="zr"></div></div>` : ''}${body}<div class="foot"><img class="wmimg" src="${BRAND.wordmark}"><div class="disc">${DISCLAIMER}</div></div><script>${script}</script></div></body></html>`;
}

const SCENES = {
  // Mascot fronts the hook; the plates persist through the rounds (identical
  // DOM/position ⇒ continuous composition), rounds resolve beneath them.
  matchup: (e) => {
    const { a, b, rounds } = e.data;
    const n = Math.min(3, rounds.length);
    const round = (r, i) => {
      const pct = Math.round((r[1] / (r[1] + r[2])) * 100);
      const aw = r[1] >= r[2];
      const last = i === n - 1;
      return { id: `r${i}`, ms: beats(5), html: `
      <div class="esc${i + 1}">
      ${plates(a.name, b.name, aw ? 'a' : 'b')}
      <div class="sideglow ${aw ? 'a' : 'b'}"></div>
      ${pips(n, i + 1)}
      <div class="eyebrow in1">ROUND ${i + 1} — ${r[0]}</div>
      <div class="big in2" style="font-size:104px"><span class="orange cnt" data-to="${r[1]}">0</span><span class="gold" style="font-size:64px"> · </span><span class="teal cnt" data-to="${r[2]}">0</span></div>
      <div class="tug in3 ${last ? 'shake' : ''}" style="width:88%"><div class="fa" data-w="${pct}"></div><div class="fb" data-w="${pct}"></div><div class="notch"></div></div>
      <div class="mut in4" style="color:${aw ? O : T}">${aw ? a.name : b.name} takes it</div>
      </div>` };
    };
    return [
      { id: 'hook', ms: beats(4), html: hookLayout(`${a.name}<br><span class="gold">vs</span> ${b.name}`, `${n} rounds. Real stats.<br>You decide.`) },
      ...rounds.slice(0, n).map(round),
      { id: 'cta', ms: beats(8), bloom: true, html: `${plates(a.name, b.name)}<div class="big rise" style="font-size:108px">Who’s right?</div><div class="mut in3">The stats say one thing.<br>The fans say another.</div><div class="mut in4 gold" style="font-size:46px;margin-top:40px">Vote · mythique.app</div>` },
    ];
  },
  // Countdown with momentum: lit pips track progress; each rank keeps the same
  // composition so the crossfade reads as the number ticking down.
  ranking: (e) => {
    const { label, rows } = e.data;
    const picks = [rows[9], rows[6], rows[4], rows[2], rows[1]];
    const ranks = [10, 7, 5, 3, 2];
    const ghost = (idx) => idx === 0 ? '' : `<div class="ghosts">${picks.slice(0, idx).map((g, j) => `<div><b>#${ranks[j]}</b>${g.name}</div>`).join('')}</div>`;
    const item = (r, rank, idx) => ({ id: `k${rank}`, ms: beats(3), html: `
      ${ghost(idx)}
      ${pips(6, idx + 1)}
      <div class="eyebrow in1">TOP 10 ${label.toUpperCase()}</div>
      <div class="huge rise" style="font-size:230px">#${rank}</div>
      <div class="big in2" style="font-size:100px">${r.name}</div>
      <div class="track in3" style="width:78%"><div class="fill" data-w="${r.value}"></div></div>
      <div class="mut in3"><span class="cnt" data-to="${r.value}">0</span>/100</div>` });
    return [
      { id: 'hook', ms: beats(4), html: hookLayout(`Top 10<br><span class="gold">${label}</span>`, `#10 → #1. Hold on.`) },
      ...picks.map((r, i) => item(r, ranks[i], i)),
      { id: 'k1', ms: beats(6), bloom: true, html: `
        ${ghost(5)}
        ${pips(6, 6)}
        <div class="eyebrow in1">TOP 10 ${label.toUpperCase()}</div>
        <div class="huge rise" style="font-size:250px">#1</div>
        <div class="big in2" style="font-size:104px;color:${GOLD};-webkit-text-stroke:8px ${NAVY}">${rows[0].name}</div>
        <div class="track in3" style="width:78%"><div class="fill" data-w="${rows[0].value}"></div></div>
        <div class="mut in3"><span class="cnt" data-to="${rows[0].value}">0</span>/100</div>` },
      { id: 'cta', ms: beats(4), html: `<div class="big rise">Agree?</div><div class="mut in2">Argue your case 👇</div><div class="mut in3 gold" style="font-size:46px;margin-top:40px">Full top 100 · mythique.app</div>` },
    ];
  },
  // The mascot poses the riddle; the radar draws itself; ring-sweep 3·2·1
  // (same position each beat) → name reveal under rays + sparks.
  guess: (e) => {
    const g = e.data;
    return [
      { id: 'hook', ms: beats(4), html: hookLayout(`Six stats.<br>One legend.`, `Can you read the grid?`) },
      { id: 'radar', ms: beats(7), html: `<div class="radar"><div class="eyebrow in1">READ THE GRID</div><div class="in2 rise">${radarSvg(g.stats)}</div><div class="mut in3">Who is it?</div></div>` },
      { id: 'c3', ms: beats(2), html: ring(3) },
      { id: 'c2', ms: beats(2), html: ring(2) },
      { id: 'c1', ms: beats(2), html: ring(1) },
      { id: 'reveal', ms: beats(8), bloom: true, html: `<div class="rise" style="margin-bottom:8px">${silhouette('cowl', { size: 300, rim: GOLD })}</div><div class="eyebrow in1">IT’S</div><div class="big in2" style="font-size:140px;color:${GOLD};-webkit-text-stroke:9px ${NAVY}">${g.name}</div><div class="mut in3">Fame ${g.fame_score}/100 · did you get it?</div><div class="mut in4 gold" style="font-size:44px;margin-top:36px">mythique.app</div>` },
    ];
  },
  // Mascot delivers the hook; big odometer stat under rays; dossier close.
  fact: (e) => {
    const f = e.data;
    const statNum = f.stat && /^\d/.test(f.stat);
    // Real narrative facts run much longer than the old computed one-liners —
    // shrink the body so long lore still lands inside the safe band instead
    // of colliding with the top-left brand mark or bleeding past the footer.
    const len = f.detail.length;
    const bodySize = len > 260 ? 40 : len > 180 ? 46 : len > 110 ? 54 : 64;
    return [
      { id: 'hook', ms: beats(5), html: hookLayout(`<span class="eyebrow" style="display:block;margin-bottom:26px">DID YOU KNOW</span>${f.headline}`, null) },
      statNum
        ? { id: 'stat', ms: beats(9), bloom: true, html: `<div class="huge rise"><span class="cnt" data-to="${f.stat}">0</span></div><div class="mut in2" style="font-size:46px">${f.detail}</div>` }
        : { id: 'stat', ms: beats(10), bloom: true, html: `<div class="big rise" style="font-size:${bodySize}px;line-height:1.3">${f.detail}</div>` },
      { id: 'cta', ms: beats(8), html: `<div class="big rise" style="font-size:92px">There’s a file<br>on everyone.</div><div class="mut in2">35,000+ heroes &amp; villains — rated &amp; ranked</div><div class="mut in3 gold" style="font-size:46px;margin-top:40px">mythique.app</div>` },
    ];
  },
};

export async function renderReel(entry, { outDir, F }) {
  const dir = join(outDir, `${String(entry.ord).padStart(2, '0')}-${slug(entry.title)}`);
  mkdirSync(dir, { recursive: true });
  // renderVideo encodes the FIRST .webm it finds in the work dir — purge stale
  // recordings from previous runs or a re-render silently ships the old video.
  for (const f of readdirSync(dir)) if (f.endsWith('.webm')) rmSync(join(dir, f));
  const scenes = SCENES[entry.angle](entry);
  const html = reelShell(F, scenes, { seed: 11 + entry.ord });
  assertNoPortrait(html, `reel:${entry.angle}:${entry.title}`);
  const mp4 = join(dir, 'reel.mp4');
  await renderVideo(html, mp4, dir);
  // Poster = the hook scene as a still (for the Publish tab thumbnail).
  const posterHtml = reelShell(F, [scenes[0]], { still: true, seed: 11 + entry.ord });
  assertNoPortrait(posterHtml, `poster:${entry.angle}`);
  const poster = join(dir, 'poster.png');
  await renderPng(posterHtml, poster, 1080, 1920);
  writeFileSync(join(dir, 'caption.txt'), `${entry.caption}\n\n♪ ${entry.music}`);
  return { dir, mp4, poster };
}
