#!/usr/bin/env node
// Hand-directed "what is trending this week" cards. Same chrome as the organic
// pack (adShell + plates + portraitCard), but the subject and the copy come
// from a spec here rather than a random rotation, because the point of these
// is to ride a spike (a show episode, a countdown, a reveal) while it is live.
//
//   node scripts/social/hot-cards.mjs --out week-2026-09-15-hot
//
// Reads portraits over the public key like organic-pack does.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, ROOT, OUT_DIR, COLORS, fonts, renderPng } from './lib.mjs';
import { adShell } from './ads/shell.mjs';

const { O, T, GOLD, CREAM } = COLORS;
const INK = '#0b1820';
const MUT = '#9db4c4';
const STATC = {
  intelligence: '#15A1AB',
  strength: '#B5302B',
  speed: '#F9B222',
  durability: '#63A936',
  power: '#E77333',
  combat: '#8a4a2b',
};
const STAT_KEYS = Object.keys(STATC);
const W = 1080;
const H = 1350;
const plateUri = (k) =>
  `data:image/png;base64,${readFileSync(join(ROOT, `scripts/social/plates/${k}.png`)).toString('base64')}`;

async function art(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`art ${res.status}: ${url.slice(0, 80)}`);
  const mime = res.headers.get('content-type') ?? 'image/jpeg';
  return `data:${mime};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}
async function hero(sb, name) {
  const rows = await sb.rest(
    `heroes?select=id,name,publisher,portrait_url,fame_score,${STAT_KEYS.join(',')}&name=eq.${encodeURIComponent(name)}&portrait_url=not.is.null&order=fame_score.desc.nullslast&limit=1`,
  );
  if (!rows[0]) throw new Error(`no portrait row for ${name}`);
  const r = rows[0];
  return {
    ...r,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, r[k] ?? 0])),
    art: await art(r.portrait_url),
  };
}

const eyebrow = (t, px = 24) =>
  `<div style="font-family:'S';font-size:${px}px;letter-spacing:.34em;color:${GOLD};text-shadow:0 2px 10px rgba(5,12,17,.95)">${t}</div>`;
const glowBehind = (x, y, w, h, color) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:radial-gradient(50% 50% at 50% 50%, ${color}4d, transparent 70%);filter:blur(30px)"></div>`;
const portraitCard = (uri, name, sub, color, { w = 400, h = 500, flip = false } = {}) => `
  <div style="position:relative;width:${w}px;height:${h}px;border-radius:34px;border:5px solid ${color};overflow:hidden;box-shadow:0 40px 80px -30px rgba(0,0,0,.8), 0 0 60px -18px ${color}66">
    <img src="${uri}" style="width:100%;height:100%;object-fit:cover;object-position:center top;${flip ? 'transform:scaleX(-1)' : ''}">
    <div style="position:absolute;inset:0;background:linear-gradient(200deg, ${color}30, rgba(11,24,32,.16) 60%);mix-blend-mode:soft-light"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:140px;background:linear-gradient(180deg,transparent,rgba(5,12,17,.92))"></div>
    <div style="position:absolute;left:24px;right:24px;bottom:18px;text-align:left">
      <div style="font-family:'S';font-size:15px;letter-spacing:.22em;color:${color}">${sub}</div>
      <div class="pop" style="font-size:40px;color:${CREAM}">${name}</div>
    </div>
  </div>`;

// 1. Doom: a countdown card. One portrait, the countdown as the eyebrow, the
//    dare as the headline, the receipt (his speed stat) as the kicker.
function hookSlide(h, eye, head, kicker) {
  return `
    ${glowBehind(290, 90, 500, 620, GOLD)}
    <div style="position:absolute;left:50%;top:90px;transform:translateX(-50%);width:640px;height:760px;overflow:hidden">
      <img src="${h.art}" style="width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:38px;-webkit-mask-image:linear-gradient(180deg,#000 66%,transparent 98%)">
    </div>
    <div style="position:absolute;left:0;right:0;top:812px;text-align:center">
      ${eyebrow(eye)}
      <div class="pop" style="font-size:76px;line-height:1.08;color:${CREAM};margin-top:22px;padding:0 60px">${head}</div>
      <div style="font-family:'S';font-size:28px;color:${MUT};margin-top:22px">${kicker}</div>
    </div>`;
}

// 2. Lanterns: four Earth Lanterns in a 2x2, the show's pick vs the comics'.
function lanternsSlide(hs) {
  const cw = 420;
  const ch = 430;
  const pos = [
    [96, 140],
    [564, 140],
    [96, 600],
    [564, 600],
  ];
  const colors = [T, O, GOLD, '#63A936'];
  return `
    ${glowBehind(240, 200, 600, 700, '#63A936')}
    <div style="position:absolute;left:0;right:0;top:74px;text-align:center">${eyebrow('EARTH HAS FOUR OF THEM')}</div>
    ${hs
      .map(
        (h, i) =>
          `<div style="position:absolute;left:${pos[i][0]}px;top:${pos[i][1]}px">${portraitCard(h.art, h.name, h.sub, colors[i], { w: cw, h: ch, flip: i % 2 === 1 })}</div>`,
      )
      .join('')}
    <div style="position:absolute;left:60px;right:60px;top:1062px;text-align:center">
      <div class="pop" style="font-size:60px;line-height:1.06;color:${CREAM}">Which one is THE Green Lantern?</div>
    </div>`;
}

// 3. Deku's file next to All Might's numbers, for the 10th-anniversary reveal.
function dekuSlide(d, a) {
  const bar = (k) => `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:13px">
      <div style="width:54px;font-family:'S';font-size:16px;letter-spacing:.12em;color:${MUT};text-align:right">${k.slice(0, 3).toUpperCase()}</div>
      <div class="pop" style="width:56px;font-size:28px;color:${STATC[k]};text-align:right">${d.stats[k]}</div>
      <div style="flex:1;height:10px;border-radius:99px;background:rgba(255,255,255,.09);position:relative">
        <div style="width:${d.stats[k]}%;height:10px;border-radius:99px;background:${STATC[k]}"></div>
        <div style="position:absolute;top:-6px;left:${a.stats[k]}%;width:3px;height:22px;background:${CREAM};opacity:.9"></div>
      </div>
      <div class="pop" style="width:56px;font-size:24px;color:${CREAM};opacity:.7">${a.stats[k]}</div>
    </div>`;
  return `
    ${glowBehind(280, 130, 520, 600, GOLD)}
    <div style="position:absolute;left:0;right:0;top:74px;text-align:center">${eyebrow('TEN YEARS OF PLUS ULTRA')}</div>
    <div style="position:absolute;left:50%;top:150px;transform:translateX(-50%)">${portraitCard(d.art, d.name, 'SHUEISHA', GOLD, { w: 440, h: 530 })}</div>
    <div style="position:absolute;left:110px;right:110px;top:730px">
      <div style="display:flex;justify-content:space-between;margin-bottom:18px;padding:0 4px">
        ${eyebrow('DEKU', 18)}<div style="font-family:'S';font-size:18px;letter-spacing:.34em;color:${CREAM};opacity:.7">| ALL MIGHT</div>
      </div>
      ${STAT_KEYS.map(bar).join('')}
    </div>
    <div class="pop" style="position:absolute;left:0;right:0;bottom:116px;text-align:center;font-size:30px;color:${CREAM}">Did he pass him yet? <span style="color:${GOLD}">The file says almost.</span></div>`;
}

async function main() {
  const args = process.argv.slice(2);
  const outName = args[args.indexOf('--out') + 1] || 'hot-cards';
  const out = join(OUT_DIR, outName);
  mkdirSync(out, { recursive: true });
  const sb = makeSb(loadEnv());
  const F = fonts();
  const doomDays = Math.round((Date.UTC(2026, 11, 18) - Date.UTC(2026, 8, 17)) / 86400000);

  const [doom, hal, john, guy, kyle, deku, allMight, logan, kirby, sinister] = await Promise.all([
    hero(sb, 'Doctor Doom'),
    hero(sb, 'Hal Jordan'),
    hero(sb, 'John Stewart'),
    hero(sb, 'Guy Gardner'),
    hero(sb, 'Kyle Rayner'),
    hero(sb, 'Izuku Midoriya'),
    hero(sb, 'All Might'),
    hero(sb, 'Wolverine'),
    hero(sb, 'Kirby'),
    hero(sb, 'Mister Sinister'),
  ]);

  const cards = [
    { dir: '03-thu-doom', plate: 'throne', inner: hookSlide(doom, `${doomDays} DAYS UNTIL DOOMSDAY`, 'Name the Avenger<br>who actually beats Doom.', `Speed ${doom.stats.speed}/100. He has never needed to run.`) },
    { dir: '02-wed-wolverine', plate: 'clash', inner: hookSlide(logan, "MARVEL'S WOLVERINE · OUT TODAY", 'Spider-Man got a 90.<br>Logan got a 77.', `Durability ${logan.stats.durability}/100. Explain that score to his face.`) },
    { dir: '04b-fri-kirby', plate: 'sky', inner: hookSlide(kirby, 'NINTENDO JUST GAVE HIM AN OPEN WORLD', 'Kirby is a top five threat<br>and you laughed.', `Speed ${kirby.stats.speed}. Durability ${kirby.stats.durability}. He has eaten gods.`) },
    {
      dir: '07-mon-lanterns',
      plate: 'sky',
      inner: lanternsSlide([
        { ...hal, sub: 'THE ORIGINAL · 1959' },
        { ...john, sub: 'THE SHOW PICKED HIM' },
        { ...guy, sub: 'THE PROBLEM' },
        { ...kyle, sub: 'THE 90S KID' },
      ]),
    },
    { dir: '05b-sat-deku', plate: 'arena', inner: dekuSlide(deku, allMight) },
    { dir: '08-tue-sinister', plate: 'vault', inner: hookSlide(sinister, 'ADAM DRIVER IS MISTER SINISTER', 'Intelligence 100.<br>Combat 50.', `1,999 comics. He has never needed to throw a punch.`) },
  ];
  for (const c of cards) {
    const dir = join(out, c.dir);
    mkdirSync(dir, { recursive: true });
    const html = adShell(F, { w: W, h: H }, c.inner, '', { plate: plateUri(c.plate) });
    await renderPng(html, join(dir, 'slide-1.png'), W, H);
    console.log('rendered', c.dir);
  }
  writeFileSync(join(out, 'doom-days.txt'), String(doomDays));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
