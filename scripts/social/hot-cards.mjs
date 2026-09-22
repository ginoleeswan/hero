#!/usr/bin/env node
// Hand-directed "what is trending this week" cards. Same chrome as the organic
// pack (adShell + plates + portraitCard), but the subject and the copy come
// from a spec here rather than a random rotation, because the point of these
// is to ride a spike (a show episode, a countdown, a reveal) while it is live.
//
//   node scripts/social/hot-cards.mjs --set sep23 [--out hot-sep23]
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
const TALL_H = 1920;
const TALL_OFFSET = 140;
const TALL_CSS = `.foot{bottom:490px}.foot .seal{height:30px}.foot .wm{font-size:35px}.foot .at{font-size:24px}.foot .disc{font-size:19px}.pop{-webkit-text-stroke:8px #0b1820}`;
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
// Framing for one portrait: sources are not all composed alike, so a card can
// override the crop anchor (pos) and zoom in past a baked-in white border.
const frame = (h = {}, flip = false) =>
  `object-fit:cover;object-position:${h.pos ?? 'center top'};transform:${flip ? 'scaleX(-1) ' : ''}scale(${h.zoom ?? 1});transform-origin:center ${h.pos ? h.pos.split(' ')[1] : 'top'}`;
const portraitCard = (uri, name, sub, color, { w = 400, h = 500, flip = false, f = {} } = {}) => `
  <div style="position:relative;width:${w}px;height:${h}px;border-radius:34px;border:5px solid ${color};overflow:hidden;box-shadow:0 40px 80px -30px rgba(0,0,0,.8), 0 0 60px -18px ${color}66">
    <img src="${uri}" style="width:100%;height:100%;${frame(f, flip)}">
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
    <div style="position:absolute;left:50%;top:90px;transform:translateX(-50%);width:640px;height:760px;overflow:hidden;border-radius:38px">
      <img src="${h.art}" style="width:100%;height:100%;${frame(h)};border-radius:38px;-webkit-mask-image:linear-gradient(180deg,#000 66%,transparent 98%)">
    </div>
    <div style="position:absolute;left:0;right:0;top:790px;height:330px;background:radial-gradient(60% 55% at 50% 50%, rgba(5,12,17,.72), transparent 100%)"></div>
    <div style="position:absolute;left:140px;right:140px;top:812px;text-align:center">
      ${eyebrow(eye, 20)}
      <div class="pop" style="font-size:70px;line-height:1.08;color:${CREAM};margin-top:20px">${head}</div>
      <div style="font-family:'S';font-size:27px;color:${MUT};margin-top:20px;text-shadow:0 2px 12px rgba(5,12,17,.95)">${kicker}</div>
    </div>`;
}

// 2. A 2x2 grid of four faces with a shared question. Portraits are cropped
//    from the top so every head sits inside its frame whatever the source ratio.
function gridSlide(hs, eyebrowText, headline, colors = [T, O, GOLD, '#63A936'], glow = '#63A936') {
  const cw = 420;
  const ch = 430;
  const pos = [
    [96, 140],
    [564, 140],
    [96, 600],
    [564, 600],
  ];
  return `
    ${glowBehind(240, 200, 600, 700, glow)}
    <div style="position:absolute;left:0;right:0;top:74px;text-align:center">${eyebrow(eyebrowText)}</div>
    ${hs
      .map(
        (h, i) =>
          `<div style="position:absolute;left:${pos[i][0]}px;top:${pos[i][1]}px">${portraitCard(h.art, h.name, h.sub, colors[i], { w: cw, h: ch, flip: i % 2 === 1, f: h })}</div>`,
      )
      .join('')}
    <div style="position:absolute;left:140px;right:140px;top:1050px;text-align:center">
      <div class="pop" style="font-size:56px;line-height:1.06;color:${CREAM}">${headline}</div>
    </div>`;
}
const lanternsSlide = (hs) => gridSlide(hs, 'EARTH HAS FOUR OF THEM', 'Which one is THE Green Lantern?');

// 2b. This-or-that: two full-bleed halves facing each other, one question.
function versusSlide(a, b, eyebrowText, question) {
  const side = (h, color, flip, left) => `
    <div style="position:absolute;${left ? 'left:0' : 'right:0'};top:0;width:540px;height:900px;overflow:hidden">
      <img src="${h.art}" style="width:100%;height:100%;${frame(h, flip)}">
      <div style="position:absolute;inset:0;background:linear-gradient(${left ? '200deg' : '160deg'}, ${color}33, rgba(11,24,32,.18) 60%);mix-blend-mode:soft-light"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:220px;background:linear-gradient(180deg,transparent,rgba(5,12,17,.95))"></div>
      <div style="position:absolute;left:${left ? 36 : 44}px;bottom:26px;text-align:left">
        <div style="font-family:'S';font-size:16px;letter-spacing:.22em;color:${color}">${h.sub ?? ''}</div>
        <div class="pop" style="font-size:48px;color:${CREAM}">${h.name}</div>
      </div>
    </div>`;
  return `
    ${side(a, O, false, true)}
    ${side(b, T, true, false)}
    <div style="position:absolute;left:538px;top:0;width:4px;height:900px;background:linear-gradient(180deg, transparent, ${GOLD} 20%, ${GOLD} 80%, transparent)"></div>
    <div style="position:absolute;left:50%;top:450px;transform:translate(-50%,-50%);width:104px;height:104px;border-radius:50%;background:${INK};border:5px solid ${GOLD};display:flex;align-items:center;justify-content:center;box-shadow:0 0 70px rgba(224,168,62,.7)"><div class="pop" style="font-size:32px;color:${GOLD}">VS</div></div>
    <div style="position:absolute;left:140px;right:140px;top:950px;text-align:center">
      ${eyebrow(eyebrowText, 20)}
      <div class="pop" style="font-size:72px;line-height:1.06;color:${CREAM};margin-top:20px">${question}</div>
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

// Each set is one week of trend cards. Add a new set per week rather than
// editing an old one, so past weeks can be re-rendered exactly.
const SETS = {
  async sep15(sb) {
    const doomDays = Math.round((Date.UTC(2026, 11, 18) - Date.UTC(2026, 8, 17)) / 86400000);
    const [doom, hal, john, guy, kyle, deku, allMight, logan, kirby, sinister] = await Promise.all(
      ['Doctor Doom', 'Hal Jordan', 'John Stewart', 'Guy Gardner', 'Kyle Rayner', 'Izuku Midoriya', 'All Might', 'Wolverine', 'Kirby', 'Mister Sinister'].map((n) => hero(sb, n)),
    );
    return [
      { dir: '03-thu-doom', plate: 'throne', inner: hookSlide(doom, `${doomDays} DAYS UNTIL DOOMSDAY`, 'Name the Avenger<br>who actually beats Doom.', `Speed ${doom.stats.speed}/100. He has never needed to run.`) },
      { dir: '02-wed-wolverine', plate: 'clash', inner: hookSlide(logan, "MARVEL'S WOLVERINE · OUT TODAY", 'Spider-Man got a 90.<br>Logan got a 77.', `Durability ${logan.stats.durability}/100. Explain that score to his face.`) },
      { dir: '04b-fri-kirby', plate: 'sky', inner: hookSlide(kirby, 'NINTENDO JUST GAVE HIM AN OPEN WORLD', 'Kirby is a top five threat<br>and you laughed.', `Speed ${kirby.stats.speed}. Durability ${kirby.stats.durability}. He has eaten gods.`) },
      { dir: '07-mon-lanterns', plate: 'sky', inner: lanternsSlide([{ ...hal, sub: 'THE ORIGINAL · 1959' }, { ...john, sub: 'THE SHOW PICKED HIM' }, { ...guy, sub: 'THE PROBLEM' }, { ...kyle, sub: 'THE 90S KID' }]) },
      { dir: '05b-sat-deku', plate: 'arena', inner: dekuSlide(deku, allMight) },
      { dir: '08-tue-sinister', plate: 'vault', inner: hookSlide(sinister, 'ADAM DRIVER IS MISTER SINISTER', 'Intelligence 100.<br>Combat 50.', '1,999 comics. He has never needed to throw a punch.') },
    ];
  },

  // Week of 23 Sep 2026. Drivers: Resident Evil film (16 Sep) has the whole
  // cast at 6-7x; Gerwig's Narnia first look (Meryl Streep as Aslan) 13x;
  // Endgame: Encore back in cinemas 25 Sep with a Doomsday look (RDJ is Doom);
  // X-Men casting wave (Sabretooth 8x, Apocalypse 7x); horror icons climbing
  // into October.
  async sep23(sb) {
    const [chris, aslan, tony, doom, logan, sabre, freddy, jason, penny, pin, apoc, leon, myers] = await Promise.all(
      ['Chris Redfield', 'Aslan', 'Iron Man', 'Doctor Doom', 'Wolverine', 'Sabretooth', 'Freddy Krueger', 'Jason Voorhees', 'Pennywise', 'Pinhead', 'Apocalypse', 'Leon S. Kennedy', 'Michael Myers'].map((n) => hero(sb, n)),
    );
    return [
      { dir: '01-wed-chris', plate: 'clash', inner: hookSlide(chris, 'ALL OF RESIDENT EVIL IS TRENDING', 'He punched a boulder<br>in 2009.', 'The internet has not moved on. Neither have we.') },
      { dir: '02-thu-aslan', plate: 'dawn', inner: hookSlide(aslan, 'MERYL STREEP IS ASLAN NOW', 'The lion got<br>a Bowie makeover.', `Power ${aslan.stats.power}/100. The voice is also 100.`) },
      { dir: '03-fri-tony-doom', plate: 'arena', inner: versusSlide({ ...tony, sub: 'ENDGAME · 2019' }, { ...doom, sub: 'DOOMSDAY · DEC 18', pos: 'center 50%', zoom: 1.12 }, 'ENDGAME IS BACK IN CINEMAS', 'Same actor.<br>Who wins?') },
      { dir: '04-sat-logan-sabre', plate: 'clash', inner: versusSlide({ ...logan, sub: `COMBAT ${logan.stats.combat}` }, { ...sabre, sub: `COMBAT ${sabre.stats.combat}` }, 'FORTY YEARS OF THIS', 'Ten points.<br>Never closed.') },
      { dir: '05-sun-horror', plate: 'dusk', inner: gridSlide([{ ...freddy, sub: 'YOUR DREAMS' }, { ...jason, sub: 'THE LAKE' }, { ...penny, sub: 'THE SEWERS', pos: 'center 62%', zoom: 1.06 }, { ...pin, sub: 'THE PUZZLE BOX', pos: 'center 38%' }], 'HALLOWEEN SEASON IS OPEN', 'You are locked in with one. Pick.', ['#B5302B', '#63A936', O, T], '#B5302B') },
      { dir: '06-mon-apocalypse', plate: 'throne', inner: hookSlide(apoc, 'FIVE THOUSAND YEARS UNDEFEATED*', 'Four stats at 100.<br>Still loses to the X-Men.', '*Excluding every X-Men comic since 1986.') },
      { dir: '07-tue-leon', plate: 'vault', inner: hookSlide(leon, 'RESIDENT EVIL WEEK, PART TWO', 'Strength 18.<br>Suplexes anyway.', `Durability ${leon.stats.durability}. Survived every outbreak with perfect hair.`) },
      { dir: '08-wed-myers', plate: 'dusk', inner: hookSlide(myers, 'ONE MONTH TO HALLOWEEN', 'Horror\'s scariest mask<br>is Captain Kirk.', 'A cheap Shatner mask, spray-painted white in 1978.') },
    ];
  },
};

async function main() {
  const args = process.argv.slice(2);
  const arg = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
  const setName = arg('--set', 'sep23');
  const out = join(OUT_DIR, arg('--out', `hot-${setName}`));
  mkdirSync(out, { recursive: true });
  if (!SETS[setName]) throw new Error(`unknown --set ${setName}; have ${Object.keys(SETS).join(', ')}`);
  const sb = makeSb(loadEnv());
  const F = fonts();
  const cards = await SETS[setName](sb);
  for (const c of cards) {
    const dir = join(out, c.dir);
    mkdirSync(dir, { recursive: true });
    const html = adShell(F, { w: W, h: H }, c.inner, '', { plate: plateUri(c.plate) });
    await renderPng(html, join(dir, 'slide-1.png'), W, H);
    // TikTok is full-screen 9:16. Same composition, dropped TALL_OFFSET down a
    // 1080x1920 canvas, with the footer lifted into the safe zone and sized as
    // on the 4:5 card (the shell scales type from the canvas height). Safe
    // zones match render-reel.mjs: no text in the top 210px (status bar, tabs)
    // or bottom 470px (caption, username, nav), nor under the right-hand rail.
    const tall = adShell(
      F,
      { w: W, h: TALL_H },
      `<div style="position:absolute;left:0;top:${TALL_OFFSET}px;width:${W}px;height:${H}px">${c.inner}</div>`,
      TALL_CSS,
      { plate: plateUri(c.plate) },
    );
    await renderPng(tall, join(dir, 'tiktok-9x16.png'), W, TALL_H);
    console.log('rendered', c.dir);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
