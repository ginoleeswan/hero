// Brand asset kit — the venue system (see docs/brand/design-language.md and
// memory: the brand is the venue, not a character). Painted plates carry the
// atmosphere, code carries every letter. One dominant element per frame,
// generous air, scrims only under type.
//
//   yarn node scripts/social/brand-pack.mjs [--only profile,overview,announce,marks,copy,screenshots]
//
// Output: out/social/brand-kit/ — organized by USE, with a playbook README.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderPng, COLORS, grainUri, fontFace, fonts, ROOT } from './lib.mjs';

const { O, T, GOLD, CREAM } = COLORS;
const INK = '#0b1820';
const PAPER = '#f5ebdc';
const INKMUT = '#93a8b6';
const PAPERMUT = '#8a7a63';
const OUT = join(ROOT, 'out/social/brand-kit');
const TAGLINE = 'The fan encyclopedia of heroes & villains';

const pngUri = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const svgUri = (s) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
const logoRaw = readFileSync(join(ROOT, 'assets/mythique-logo.svg'), 'utf8');
const BRAND = {
  logo: svgUri(logoRaw),
  logoGold: svgUri(logoRaw.replace('#ECECDE', GOLD)),
  logoInk: svgUri(logoRaw.replace('#ECECDE', '#1d2c33')),
  wordmark: pngUri(join(ROOT, 'public/brand/wordmark-cream.png')),
  wordmarkNavy: pngUri(join(ROOT, 'public/brand/wordmark-navy.png')),
};
const plate = (k) => pngUri(join(ROOT, `scripts/social/plates/${k}.png`));

const css = (w, h) => `<style>${fontFace(fonts())}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${w}px;height:${h}px;overflow:hidden;font-family:'FR';-webkit-font-smoothing:antialiased}
.s{font-family:'S'}
</style>`;
const grain = (op = 0.045) => `<div style="position:absolute;inset:0;background-image:url('${grainUri()}');background-size:340px;opacity:${op};mix-blend-mode:overlay;pointer-events:none"></div>`;

// A plate as a full-bleed backdrop with type-band scrims only.
// pos: vertical focus of the 9:16 master inside the frame (0 top … 1 bottom).
function stage(key, w, h, { pos = 0.5, dim = 0, topScrim = 0.8, bottomScrim = 0.9 } = {}) {
  const ph = Math.round(w * 16 / 9) < h ? h : Math.round(w * 16 / 9);
  const pw = Math.round(ph * 9 / 16) < w ? w : Math.round(ph * 9 / 16);
  const top = Math.round((h - ph) * pos);
  return `
  <img src="${plate(key)}" style="position:absolute;left:${Math.round((w - pw) / 2)}px;top:${top}px;width:${pw}px;height:${ph}px;object-fit:cover">
  ${dim ? `<div style="position:absolute;inset:0;background:rgba(11,24,32,${dim})"></div>` : ''}
  <div style="position:absolute;left:0;right:0;top:0;height:${Math.round(h * 0.2)}px;background:linear-gradient(180deg, rgba(11,24,32,${topScrim}), rgba(11,24,32,0))"></div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(h * 0.46)}px;background:linear-gradient(0deg, rgba(11,24,32,${bottomScrim}) 46%, rgba(11,24,32,0))"></div>`;
}
const masthead = (w, folioText, wmH = 32) => `
  <div style="position:absolute;top:56px;left:84px;right:84px;display:flex;justify-content:space-between;align-items:center;z-index:5">
    <img src="${BRAND.wordmark}" style="height:${wmH}px">
    <div class="s" style="font-size:19px;letter-spacing:.3em;color:${INKMUT}">${folioText}</div>
  </div>`;
const footer = (main, sub = null) => `
  <div style="position:absolute;left:0;right:0;bottom:56px;text-align:center;z-index:5">
    ${sub ? `<div class="s" style="font-size:20px;letter-spacing:.26em;color:${INKMUT};margin-bottom:14px">${sub}</div>` : ''}
    <div style="font-size:38px;color:${GOLD}">${main}</div>
  </div>`;

async function render(html, file, w, h) { await renderPng(html, file, w, h); process.stdout.write('.'); }

// ── 01-profile/ — dress every account ─────────────────────────────────────────
async function profile() {
  const dir = join(OUT, '01-profile'); mkdirSync(dir, { recursive: true });
  // Avatar: the seal — mask on quiet ink. Must read at 40px, so nothing else.
  await render(`${css(1080, 1080)}
    <div style="position:relative;width:1080px;height:1080px;background:radial-gradient(120% 95% at 50% 18%, #14293a, ${INK} 76%);overflow:hidden;display:flex;align-items:center;justify-content:center">
      <img src="${BRAND.logo}" style="width:640px;filter:drop-shadow(0 0 90px rgba(224,168,62,.28))">
      ${grain()}
    </div>`, join(dir, 'avatar-1080.png'), 1080, 1080);
  // Banners: the vault, wordmark lockup dead-center (mobile-crop safe).
  const banner = (w, h, wmH, tagPx) => `${css(w, h)}
    <div style="position:relative;width:${w}px;height:${h}px;background:${INK};overflow:hidden">
      <img src="${plate('vault')}" style="position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);width:${Math.max(w, Math.round(h * 2.2))}px;opacity:.85">
      <div style="position:absolute;inset:0;background:radial-gradient(60% 90% at 50% 50%, rgba(11,24,32,.55), rgba(11,24,32,.82))"></div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(tagPx * 0.9)}px">
        <img src="${BRAND.wordmark}" style="height:${wmH}px;filter:drop-shadow(0 6px 30px rgba(0,0,0,.6))">
        <div class="s" style="font-size:${tagPx}px;letter-spacing:.24em;color:${INKMUT}">${TAGLINE.toUpperCase()}</div>
      </div>
      ${grain()}
    </div>`;
  await render(banner(1500, 500, 88, 20), join(dir, 'banner-x-1500x500.png'), 1500, 500);
  await render(banner(1584, 396, 74, 18), join(dir, 'banner-linkedin-1584x396.png'), 1584, 396);
  await render(banner(2560, 1440, 170, 42), join(dir, 'banner-youtube-2560x1440.png'), 2560, 1440);
  console.log(' ✓ 01-profile/');
}

// ── 02-overview/ — the "what is Mythique" set ────────────────────────────────
async function overview() {
  const dir = join(OUT, '02-overview'); mkdirSync(dir, { recursive: true });

  // 1 · the premise — vault, one line
  await render(`${css(1080, 1080)}
    <div style="position:relative;width:1080px;height:1080px;background:${INK};color:${CREAM};overflow:hidden">
      ${stage('vault', 1080, 1080, { pos: 0.35, dim: 0.12 })}
      ${masthead(1080, 'VOL. I')}
      <div style="position:absolute;left:0;right:0;top:592px;text-align:center;z-index:5">
        <div class="s" style="font-size:23px;letter-spacing:.4em;color:${GOLD};margin-bottom:30px;text-shadow:0 3px 26px rgba(5,12,17,.9)">MEET MYTHIQUE</div>
        <div style="font-size:96px;line-height:1.06;text-shadow:0 6px 40px rgba(5,12,17,.75)">Every hero.<br>Every villain.<br>One archive.</div>
      </div>
      ${footer('mythique.app')}
      ${grain()}
    </div>`, join(dir, 'slide-1-1080.png'), 1080, 1080);

  // 2 · the catalogue — sky, the number
  await render(`${css(1080, 1080)}
    <div style="position:relative;width:1080px;height:1080px;background:${INK};color:${CREAM};overflow:hidden">
      ${stage('sky', 1080, 1080, { pos: 0.4 })}
      ${masthead(1080, 'THE CATALOGUE')}
      <div style="position:absolute;left:0;right:0;top:330px;text-align:center;z-index:5">
        <div class="s" style="font-size:24px;letter-spacing:.42em;color:${GOLD}">POPULATION</div>
        <div style="font-size:300px;line-height:1.05;color:${GOLD};text-shadow:0 30px 80px rgba(0,0,0,.6)">35,000</div>
        <div style="font-size:58px;margin-top:6px">heroes &amp; villains. Every one rated.</div>
      </div>
      ${footer('mythique.app', 'SIX POWER STATS · FAME SCORES · FULL DOSSIERS')}
      ${grain()}
    </div>`, join(dir, 'slide-2-1080.png'), 1080, 1080);

  // 3 · the arena — arena plate, one line, the coin
  await render(`${css(1080, 1080)}
    <div style="position:relative;width:1080px;height:1080px;background:${INK};color:${CREAM};overflow:hidden">
      ${stage('arena', 1080, 1080, { pos: 0.3 })}
      ${masthead(1080, 'THE ARENA')}
      <div style="position:absolute;left:50%;top:400px;transform:translate(-50%,-50%) rotate(45deg);width:110px;height:110px;background:${INK};border:5px solid ${GOLD};border-radius:16px;box-shadow:0 0 70px rgba(224,168,62,.6);z-index:5"></div>
      <div style="position:absolute;left:50%;top:400px;transform:translate(-50%,-50%);font-size:44px;color:${GOLD};z-index:6">VS</div>
      <div style="position:absolute;left:0;right:0;top:600px;text-align:center;z-index:5">
        <div class="s" style="font-size:23px;letter-spacing:.4em;color:${GOLD};margin-bottom:28px;text-shadow:0 3px 26px rgba(5,12,17,.9)">★ DAILY SHOWDOWNS ★</div>
        <div style="font-size:96px;line-height:1.06;text-shadow:0 6px 40px rgba(5,12,17,.75)">Settle the<br>debates.</div>
      </div>
      ${footer('mythique.app', 'REAL STATS · YOUR VOTE DECIDES')}
      ${grain()}
    </div>`, join(dir, 'slide-3-1080.png'), 1080, 1080);

  // 4 · the lore — throne, one line
  await render(`${css(1080, 1080)}
    <div style="position:relative;width:1080px;height:1080px;background:${INK};color:${CREAM};overflow:hidden">
      ${stage('throne', 1080, 1080, { pos: 0.35, dim: 0.1 })}
      ${masthead(1080, 'THE LORE')}
      <div style="position:absolute;left:0;right:0;top:576px;text-align:center;z-index:5">
        <div class="s" style="font-size:23px;letter-spacing:.4em;color:${GOLD};margin-bottom:28px;text-shadow:0 3px 26px rgba(5,12,17,.9)">646,000 CONNECTIONS, MAPPED</div>
        <div style="font-size:92px;line-height:1.08;text-shadow:0 6px 40px rgba(5,12,17,.75)">Bloodlines.<br>Rivalries.<br>Alliances.</div>
      </div>
      ${footer('mythique.app')}
      ${grain()}
    </div>`, join(dir, 'slide-4-1080.png'), 1080, 1080);

  // 5 · the invitation — dawn, paper-warm CTA
  await render(`${css(1080, 1080)}
    <div style="position:relative;width:1080px;height:1080px;background:${INK};color:${CREAM};overflow:hidden">
      ${stage('dawn', 1080, 1080, { pos: 0.45, dim: 0.22, topScrim: 0.7, bottomScrim: 0.9 })}
      ${masthead(1080, 'FREE · ON THE WEB')}
      <div style="position:absolute;left:0;right:0;top:600px;text-align:center;z-index:5">
        <div class="s" style="font-size:23px;letter-spacing:.4em;color:${GOLD};margin-bottom:28px;text-shadow:0 3px 26px rgba(5,12,17,.9)">START EXPLORING</div>
        <div style="font-size:104px;line-height:1.05;text-shadow:0 6px 40px rgba(5,12,17,.75)">The archive<br>is open.</div>
      </div>
      ${footer('mythique.app', 'NO INSTALL · NO PAYWALL')}
      ${grain()}
    </div>`, join(dir, 'slide-5-1080.png'), 1080, 1080);

  // link card + story
  await render(`${css(1200, 627)}
    <div style="position:relative;width:1200px;height:627px;background:${INK};color:${CREAM};overflow:hidden">
      <img src="${plate('vault')}" style="position:absolute;right:-160px;top:50%;transform:translateY(-50%);width:700px;opacity:.9;-webkit-mask-image:linear-gradient(90deg,transparent,#000 30%)">
      <div style="position:absolute;inset:0;background:linear-gradient(90deg, rgba(11,24,32,.96) 42%, rgba(11,24,32,.2))"></div>
      <div style="position:absolute;left:90px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;gap:24px">
        <img src="${BRAND.wordmark}" style="height:34px;align-self:flex-start">
        <div style="font-size:66px;line-height:1.08;margin-top:8px">Every hero.<br>Every villain.<br>One archive.</div>
        <div class="s" style="font-size:23px;color:${INKMUT}">35,000 legends · battles · lore &nbsp;·&nbsp; <span style="color:${GOLD}">mythique.app</span></div>
      </div>
      ${grain()}
    </div>`, join(dir, 'overview-card-1200x627.png'), 1200, 627);

  await render(`${css(1080, 1920)}
    <div style="position:relative;width:1080px;height:1920px;background:${INK};color:${CREAM};overflow:hidden">
      ${stage('vault', 1080, 1920, { pos: 0.5, dim: 0.1, bottomScrim: 0.94 })}
      <div style="position:absolute;left:0;right:0;top:150px;display:flex;justify-content:center"><img src="${BRAND.wordmark}" style="height:42px"></div>
      <div style="position:absolute;left:0;right:0;top:1180px;text-align:center;z-index:5">
        <div class="s" style="font-size:26px;letter-spacing:.4em;color:${GOLD};margin-bottom:34px">MEET MYTHIQUE</div>
        <div style="font-size:108px;line-height:1.06">Every hero.<br>Every villain.<br>One archive.</div>
        <div class="s" style="font-size:34px;color:${INKMUT};margin-top:38px;line-height:1.5">35,000 legends — rated, ranked,<br>battled &amp; mapped.</div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:150px;text-align:center;z-index:5"><div style="font-size:54px;color:${GOLD}">mythique.app</div></div>
      ${grain()}
    </div>`, join(dir, 'overview-story-1080x1920.png'), 1080, 1920);
  console.log(' ✓ 02-overview/');
}

// ── 03-announce/ — retextable moments ─────────────────────────────────────────
async function announce() {
  const dir = join(OUT, '03-announce'); mkdirSync(dir, { recursive: true });
  const moment = (file, plateKey, folioText, eyebrow, head, sub, opts = {}) => render(`${css(1080, 1080)}
    <div style="position:relative;width:1080px;height:1080px;background:${INK};color:${CREAM};overflow:hidden">
      ${stage(plateKey, 1080, 1080, { pos: opts.pos ?? 0.4, dim: opts.dim ?? 0 })}
      ${masthead(1080, folioText)}
      <div style="position:absolute;left:0;right:0;top:${opts.top ?? 600}px;text-align:center;z-index:5">
        <div class="s" style="font-size:24px;letter-spacing:.42em;color:${GOLD};margin-bottom:30px;text-shadow:0 3px 26px rgba(5,12,17,.9)">${eyebrow}</div>
        <div style="font-size:104px;line-height:1.05;text-shadow:0 6px 40px rgba(5,12,17,.75)">${head}</div>
      </div>
      ${footer('mythique.app', sub)}
      ${grain()}
    </div>`, join(dir, file), 1080, 1080);
  await moment('launch-1080.png', 'dawn', 'BULLETIN · №1', 'NOW LIVE', 'The archive<br>is open.', '35,000 LEGENDS · FREE ON THE WEB', { dim: 0.22 });
  await moment('milestone-1080.png', 'sky', 'MILESTONE', 'THE ARCHIVE REACHES', '35,000<br>legends.', 'AND COUNTING', { pos: 0.35 });
  await moment('feature-1080.png', 'throne', 'BULLETIN · №2', 'NEW ON MYTHIQUE', 'Family trees<br>just landed.', 'TRACE THE BLOODLINES', { dim: 0.1 });
  console.log(' ✓ 03-announce/');
}

// ── 04-marks/ ────────────────────────────────────────────────────────────────
function marks() {
  const dir = join(OUT, '04-marks'); mkdirSync(dir, { recursive: true });
  copyFileSync(join(ROOT, 'assets/mythique-logo.svg'), join(dir, 'logo.svg'));
  copyFileSync(join(ROOT, 'public/brand/wordmark-cream.png'), join(dir, 'wordmark-cream.png'));
  copyFileSync(join(ROOT, 'public/brand/wordmark-navy.png'), join(dir, 'wordmark-navy.png'));
  copyFileSync(join(ROOT, 'public/brand/mascot-bust.png'), join(dir, 'mascot-bust.png'));
  console.log(' ✓ 04-marks/');
}

// ── copy + playbook ───────────────────────────────────────────────────────────
const PLAYBOOK = `# Mythique brand kit — what to use, when

The system: painted plates carry atmosphere, code carries type. Two lanes —
ORGANIC may show real characters (our painted portraits); PAID ADS use real
names as text only. Everything in this kit is lane-safe for BOTH (no character
imagery anywhere).

## 01-profile/ — set once
- avatar-1080 → profile picture everywhere (X, IG, TikTok, LinkedIn, YouTube)
- banner-x / banner-linkedin / banner-youtube → the matching header slots

## 02-overview/ — the pinned introduction
- slide-1…5 → post as an IG/LinkedIn carousel and PIN it. It answers "what is this app?"
- overview-card-1200x627 → attach when sharing the link on LinkedIn/X posts
- overview-story-1080x1920 → IG/TikTok story version; also fine as a Reel cover

## 03-announce/ — moments (retextable templates)
- launch → the "we're live" post; boost-safe
- milestone → any big number moment (users, votes, entries)
- feature → any feature drop; ask Claude to retext headline + folio per drop

## 04-marks/ — raw ingredients
- logo.svg, wordmarks, mascot — for anything bespoke (press, embeds, partners)

## copy/captions.md — per-channel text
One-liner, LinkedIn post, X post, IG/TikTok bio + captions, Reddit, press
boilerplate, and the ad disclaimer. Copy-paste per channel.

## Rules of thumb
- Daily content comes from the Publish tab (matchups/rankings/lore), not this kit.
- Anything you BOOST must be from the ad_safe lane (names as text, no portraits).
- Never post a screenshot of franchise art as an AD; organic is fine.
`;
const CAPTIONS = `# Mythique — channel copy pack

## One-liner
${TAGLINE} — 35,000 legends, rated, ranked, battled & mapped. mythique.app

## LinkedIn (personal launch post)
I've been building something for fans: **Mythique** — a free encyclopedia of 35,000+ heroes and villains.

Every character gets a full dossier: six power stats, fame scores, first appearances, galleries. You can pit any two against each other in the Arena and vote, trace family trees and rivalries across universes, and fall down the lore rabbit hole for hours.

It's live on the web → mythique.app

I'd love feedback — and your hottest "who wins" take.

## X / Threads
35,000 heroes & villains. Every one rated. Every rivalry mapped.

The archive is open → mythique.app

## Instagram / TikTok bio
⚡ ${TAGLINE}
📊 35,000+ legends · rated & ranked
⚔️ Battles · lore · family trees
👉 mythique.app

## Instagram caption (overview carousel)
Every hero. Every villain. One archive. 📖⚡
Swipe for what's inside — then come settle a debate at mythique.app (link in bio).
#superheroes #villains #comics #anime #gaming #popculture

## Reddit (no marketing voice)
I built a fan encyclopedia of 35,000+ heroes & villains — stats, head-to-head battles, and a mapped relationship graph (family trees, rivalries, teams). Free, on the web, no install. Happy to answer anything about the data pipeline. mythique.app

## Press boilerplate
Mythique is a free web encyclopedia of more than 35,000 heroes and villains across comics, film, games, and anime. Each character carries a full dossier — power ratings, fame scores, first appearances, and imagery — connected by a relationship graph of families, rivalries, and teams. Fans settle debates in the Arena, where head-to-head matchups combine real stats with community votes. Mythique is an unofficial fan work; all characters remain © their respective owners.

## Disclaimer (append to anything boosted as an ad)
Unofficial fan encyclopedia. Characters © their respective owners.
`;
function copyPack() {
  const dir = join(OUT, 'copy'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'captions.md'), CAPTIONS);
  writeFileSync(join(OUT, 'README.md'), PLAYBOOK);
  writeFileSync(join(OUT, '01-profile', 'caption.txt'), `Profile kit — avatar + banners (X / LinkedIn / YouTube).\n\nBio: ⚡ ${TAGLINE} · 📊 35,000+ legends, rated & ranked · ⚔️ Battles, lore, family trees · 👉 mythique.app`);
  writeFileSync(join(OUT, '02-overview', 'caption.txt'), `Every hero. Every villain. One archive. 📖⚡\nSwipe for what's inside — then come settle a debate at mythique.app (link in bio).\n#superheroes #villains #comics #anime #gaming #popculture`);
  writeFileSync(join(OUT, '03-announce', 'caption.txt'), `The archive is open.\n\n35,000 heroes & villains — every one rated, every rivalry mapped.\n\nmythique.app`);
  writeFileSync(join(OUT, '04-marks', 'caption.txt'), `Raw marks — logo SVG, cream/navy wordmarks, mascot.`);
  console.log(' ✓ copy/ + README');
}
function screenshots() {
  const dir = join(OUT, '05-screenshots'); mkdirSync(dir, { recursive: true });
  for (const f of ['home.PNG', 'search.PNG', 'search-page.png']) {
    try { copyFileSync(join(ROOT, 'assets/images/screenshots', f), join(dir, f)); } catch { /* optional */ }
  }
  console.log(' ✓ 05-screenshots/');
}

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',')
  : ['profile', 'overview', 'announce', 'marks', 'copy', 'screenshots'];
mkdirSync(OUT, { recursive: true });
if (only.includes('profile')) await profile();
if (only.includes('overview')) await overview();
if (only.includes('announce')) await announce();
if (only.includes('marks')) marks();
if (only.includes('copy')) copyPack();
if (only.includes('screenshots')) screenshots();
console.log(`done → ${OUT}`);
