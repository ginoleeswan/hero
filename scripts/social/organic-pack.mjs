// Organic recognition pack — the lane where REAL characters carry the post:
// painted portraits, ComicVine covers, TMDB posters, bloodlines and lore.
// Organic-only (franchise imagery is tier-gated in paid ads; the Publish tab
// labels these ORGANIC ONLY).
//
//   yarn node scripts/social/organic-pack.mjs [--n 12] [--seed 7] [--month YYYY-MM]
//
// Formats (rotated): showdown (REAL rivals face off — pairs come from the
// curated rivalry list + the enemy graph, never random) · covers (the many
// faces carousel) · didyouknow (a real narrative fact fronted by the portrait)
// · bloodline (family reveal — two portraits joined by the link) · onscreen
// (movie-poster carousel) · legend (shareable dossier card).
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, renderPng, COLORS, OUT_DIR, ROOT, RIVALRIES } from './lib.mjs';
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
const W = 1080,
  H = 1350;
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
const plateUri = (k) =>
  `data:image/png;base64,${readFileSync(join(ROOT, `scripts/social/plates/${k}.png`)).toString('base64')}`;
const HERO_COLS = 'id,name,publisher,portrait_url,fame_score,movie_count,' + STAT_KEYS.join(',');
const shape = (r) => ({
  id: r.id,
  name: r.name,
  publisher: r.publisher,
  portrait_url: r.portrait_url,
  fame_score: r.fame_score ?? 0,
  movie_count: r.movie_count ?? 0,
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, r[k] ?? 0])),
});

// Remote art → data URI (Playwright pages must not depend on live CDNs mid-render).
async function art(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`art ${res.status}: ${url.slice(0, 80)}`);
  const mime = res.headers.get('content-type') ?? 'image/jpeg';
  return `data:${mime};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

// ── shared chrome (integration rules: washes, motivated glow, mask fades) ────
const eyebrow = (t, px = 24) =>
  `<div style="font-family:'S';font-size:${px}px;letter-spacing:.34em;color:${GOLD};text-shadow:0 2px 10px rgba(5,12,17,.95)">${t}</div>`;
const headline = (t, px = 92) =>
  `<div class="pop" style="font-size:${px}px;line-height:1.06;color:${CREAM}">${t}</div>`;
const stack = (inner, top = 0.06) =>
  `<div style="position:absolute;left:84px;right:84px;top:${Math.round(H * top)}px;bottom:${Math.round(H * 0.085)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:26px">${inner}</div>`;
// Soft glow behind a card so the scene lights it (never a floating rectangle).
const glowBehind = (x, y, w, h, color) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:radial-gradient(50% 50% at 50% 50%, ${color}4d, transparent 70%);filter:blur(30px)"></div>`;

const portraitCard = (uri, name, sub, color, { w = 400, h = 500, flip = false } = {}) => `
  <div style="position:relative;width:${w}px;height:${h}px;border-radius:34px;border:5px solid ${color};overflow:hidden;box-shadow:0 40px 80px -30px rgba(0,0,0,.8), 0 0 60px -18px ${color}66">
    <img src="${uri}" style="width:100%;height:100%;object-fit:cover;${flip ? 'transform:scaleX(-1)' : ''}">
    <div style="position:absolute;inset:0;background:linear-gradient(200deg, ${color}30, rgba(11,24,32,.16) 60%);mix-blend-mode:soft-light"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:140px;background:linear-gradient(180deg,transparent,rgba(5,12,17,.92))"></div>
    <div style="position:absolute;left:24px;right:24px;bottom:18px;text-align:left">
      <div style="font-family:'S';font-size:15px;letter-spacing:.22em;color:${color}">${sub}</div>
      <div class="pop" style="font-size:40px;color:${CREAM}">${name}</div>
    </div>
  </div>`;

// ── formats ───────────────────────────────────────────────────────────────────
function showdownSlides(a, b) {
  const bars = STAT_KEYS.filter((k) => a.stats[k] > 0 && b.stats[k] > 0)
    .map((k) => ({ k, gap: Math.abs(a.stats[k] - b.stats[k]) }))
    .sort((x, y) => y.gap - x.gap)
    .slice(0, 3);
  const row = ({ k }) => `
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:14px">
      <div class="pop" style="width:60px;font-size:32px;color:${O};text-align:right">${a.stats[k]}</div>
      <div style="flex:1;height:9px;border-radius:99px;background:rgba(255,255,255,.1);position:relative"><div style="position:absolute;right:0;top:0;height:9px;border-radius:99px;background:${O};width:${a.stats[k]}%"></div></div>
      <div style="width:56px;text-align:center;font-family:'S';font-size:16px;letter-spacing:.12em;color:${MUT}">${k.slice(0, 3).toUpperCase()}</div>
      <div style="flex:1;height:9px;border-radius:99px;background:rgba(255,255,255,.1)"><div style="height:9px;border-radius:99px;background:${T};width:${b.stats[k]}%"></div></div>
      <div class="pop" style="width:60px;font-size:32px;color:${T}">${b.stats[k]}</div>
    </div>`;
  return [
    `
    ${glowBehind(64, 140, 460, 560, O)}${glowBehind(556, 140, 460, 560, T)}
    <div style="position:absolute;left:0;right:0;top:78px;text-align:center">${eyebrow('★ THE ETERNAL RIVALRY ★')}</div>
    <div style="position:absolute;left:84px;top:160px">${portraitCard(a.art, a.name, a.publisher?.toUpperCase() ?? '', O, { w: 420, h: 520 })}</div>
    <div style="position:absolute;right:84px;top:160px">${portraitCard(b.art, b.name, b.publisher?.toUpperCase() ?? '', T, { w: 420, h: 520, flip: true })}</div>
    <div style="position:absolute;left:50%;top:420px;transform:translate(-50%,-50%) rotate(45deg);width:100px;height:100px;background:${INK};border:5px solid ${GOLD};border-radius:16px;box-shadow:0 0 60px rgba(224,168,62,.6)"></div>
    <div class="pop" style="position:absolute;left:50%;top:420px;transform:translate(-50%,-50%);font-size:40px;color:${GOLD}">VS</div>
    <div style="position:absolute;left:110px;right:110px;top:766px">
      <div style="text-align:center;margin-bottom:22px">${eyebrow('HEAD TO HEAD', 18)}</div>
      ${bars.map(row).join('')}
    </div>
    <div class="pop" style="position:absolute;left:0;right:0;bottom:118px;text-align:center;font-size:34px;color:${CREAM}">Who takes it? <span style="color:${GOLD}">Vote · mythique.app</span></div>`,
  ];
}

function coversSlides(h, covers) {
  const hook = stack(`
    ${eyebrow('FROM THE ARCHIVE')}
    <div style="position:relative">${glowBehind(-40, -20, 460, 520, GOLD)}${portraitCard(h.art, h.name, h.publisher?.toUpperCase() ?? '', GOLD, { w: 380, h: 470 })}</div>
    ${headline(`The many faces<br>of ${h.name}.`, 76)}
    <div style="font-family:'S';font-size:26px;color:${MUT}">Swipe through the covers &rarr;</div>`);
  const coverSlide = (c, i) => `
    <img src="${c.art}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(6,18,26,.55), transparent 24%, transparent 64%, rgba(6,18,26,.92) 90%)"></div>
    <div style="position:absolute;top:64px;left:84px;right:84px;display:flex;justify-content:space-between">
      ${eyebrow(h.name.toUpperCase(), 20)}<div style="font-family:'S';font-size:20px;letter-spacing:.3em;color:${CREAM};text-shadow:0 2px 10px rgba(5,12,17,.9)">${String(i + 1).padStart(2, '0')} / ${String(covers.length).padStart(2, '0')}</div>
    </div>
    ${c.caption ? `<div class="pop" style="position:absolute;left:84px;bottom:130px;font-size:40px;color:${CREAM}">${c.caption}</div>` : ''}`;
  const cta = stack(`
    ${eyebrow('EVERY COVER · EVERY ERA')}
    ${headline('The whole gallery<br>is in the archive.', 78)}
    <div class="pop" style="font-size:40px;color:${GOLD};margin-top:10px">mythique.app</div>`);
  return [hook, ...covers.map(coverSlide), cta];
}

// A real narrative fact, fronted by the portrait fading into the scene.
function didYouKnowSlides(h, fact) {
  const len = fact.length;
  const factPx = len > 260 ? 36 : len > 180 ? 42 : len > 110 ? 50 : 58;
  const hook = `
    ${glowBehind(290, 90, 500, 600, GOLD)}
    <div style="position:absolute;left:50%;top:110px;transform:translateX(-50%);width:520px;height:640px;overflow:hidden">
      <img src="${h.art}" style="width:100%;height:100%;object-fit:cover;border-radius:38px;-webkit-mask-image:linear-gradient(180deg,#000 68%,transparent 98%)">
    </div>
    <div style="position:absolute;left:0;right:0;top:730px;text-align:center">
      ${eyebrow('DID YOU KNOW')}
      <div class="pop" style="font-size:64px;line-height:1.1;color:${CREAM};margin-top:24px;padding:0 90px">${h.name} has a<br>secret in the file.</div>
      <div style="font-family:'S';font-size:26px;color:${MUT};margin-top:26px">Swipe for the truth &rarr;</div>
    </div>`;
  const reveal = stack(`
    ${eyebrow(`${h.name.toUpperCase()} — FROM THE FILE`, 20)}
    <div class="pop" style="font-size:${factPx}px;line-height:1.35;color:${CREAM};padding:0 20px">${fact}</div>
    <div class="pop" style="font-size:36px;color:${GOLD};margin-top:16px">More lore · mythique.app</div>`);
  return [hook, reveal];
}

// Family reveal — the relative owns the relation ("VADER is the father of LUKE").
function bloodlineSlides(rel, hero, relationText) {
  const hook = stack(`
    ${eyebrow('SAME BLOOD')}
    ${headline('One family.<br>Two legends.', 88)}
    <div style="font-family:'S';font-size:26px;color:${MUT}">Swipe for the reveal &rarr;</div>`);
  const reveal = `
    ${glowBehind(70, 120, 440, 500, O)}${glowBehind(570, 470, 440, 500, T)}
    <div style="position:absolute;left:84px;top:130px">${portraitCard(rel.art, rel.name, rel.publisher?.toUpperCase() ?? '', O, { w: 400, h: 470 })}</div>
    <div style="position:absolute;right:84px;top:480px">${portraitCard(hero.art, hero.name, hero.publisher?.toUpperCase() ?? '', T, { w: 400, h: 470, flip: true })}</div>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0">
      <line x1="490" y1="480" x2="600" y2="600" stroke="${GOLD}" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity=".9"/>
    </svg>
    <div style="position:absolute;left:50%;top:540px;transform:translate(-50%,-50%);width:96px;height:96px;border-radius:50%;background:${INK};border:4px solid ${GOLD};display:flex;align-items:center;justify-content:center;box-shadow:0 0 50px rgba(224,168,62,.5)">
      <div class="pop" style="font-size:34px;color:${GOLD}">&#9829;</div>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:150px;text-align:center;padding:0 90px">
      <div class="pop" style="font-size:56px;line-height:1.15;color:${CREAM}">${rel.name} is<br>${relationText} <span style="color:${GOLD}">${hero.name}</span>.</div>
      <div style="font-family:'S';font-size:24px;color:${MUT};margin-top:20px">The whole family tree · mythique.app</div>
    </div>`;
  return [hook, reveal];
}

function onscreenSlides(h, films) {
  const hook = stack(`
    ${eyebrow('ON SCREEN')}
    <div style="position:relative">${glowBehind(-40, -20, 460, 520, GOLD)}${portraitCard(h.art, h.name, `${h.movie_count} SCREEN APPEARANCES`, GOLD, { w: 380, h: 470 })}</div>
    ${headline(`${h.name},<br>on screen.`, 78)}
    <div style="font-family:'S';font-size:26px;color:${MUT}">The films that built the legend &rarr;</div>`);
  const posterSlide = (f) => `
    <img src="${f.art}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(6,18,26,.5), transparent 24%, transparent 62%, rgba(6,18,26,.92) 90%)"></div>
    <div style="position:absolute;top:64px;left:84px">${eyebrow(h.name.toUpperCase(), 20)}</div>
    <div style="position:absolute;left:84px;right:84px;bottom:124px">
      <div class="pop" style="font-size:46px;color:${CREAM}">${f.title}</div>
      <div style="font-family:'S';font-size:22px;color:${MUT};margin-top:8px">${f.year ?? ''}${f.vote ? ` · ★ ${f.vote.toFixed(1)}` : ''}</div>
    </div>`;
  const cta = stack(`
    ${eyebrow('EVERY FILM · EVERY SHOW')}
    ${headline(`All ${h.movie_count} appearances,<br>catalogued.`, 72)}
    <div class="pop" style="font-size:40px;color:${GOLD};margin-top:10px">mythique.app</div>`);
  return [hook, ...films.map(posterSlide), cta];
}

function legendSlides(h) {
  const bar = (k) => `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:15px">
      <div style="width:54px;font-family:'S';font-size:16px;letter-spacing:.12em;color:${MUT};text-align:right">${k.slice(0, 3).toUpperCase()}</div>
      <div style="flex:1;height:10px;border-radius:99px;background:rgba(255,255,255,.09)"><div style="width:${h.stats[k]}%;height:10px;border-radius:99px;background:${STATC[k]}"></div></div>
      <div class="pop" style="width:64px;font-size:30px;color:${STATC[k]}">${h.stats[k]}</div>
    </div>`;
  return [
    `
    ${glowBehind(280, 130, 520, 600, GOLD)}
    <div style="position:absolute;left:0;right:0;top:74px;text-align:center">${eyebrow('ENTRY — FILED UNDER LEGEND')}</div>
    <div style="position:absolute;left:50%;top:150px;transform:translateX(-50%)">${portraitCard(h.art, h.name, h.publisher?.toUpperCase() ?? '', GOLD, { w: 460, h: 560 })}</div>
    <div style="position:absolute;left:120px;right:120px;top:772px">
      <div style="text-align:center;margin-bottom:20px">${eyebrow('POWER PROFILE', 18)}</div>
      ${STAT_KEYS.filter((k) => h.stats[k] > 0)
        .map(bar)
        .join('')}
    </div>
    <div class="pop" style="position:absolute;left:0;right:0;bottom:116px;text-align:center;font-size:32px;color:${CREAM}">Fame ${h.fame_score}/100 · <span style="color:${GOLD}">the full file — mythique.app</span></div>`,
  ];
}

// ── data ──────────────────────────────────────────────────────────────────────
async function pool(sb) {
  const rows = await sb.rest(
    `heroes?select=${HERO_COLS}&portrait_url=not.is.null&order=fame_score.desc.nullslast&limit=60`,
  );
  return rows.map(shape);
}
// Showdown pairs that MEAN something: the curated rivalry list first, then the
// enemy graph (famous, both with portraits). Never random.
async function rivalPool(sb) {
  const pairs = [];
  for (const [an, bn] of RIVALRIES) {
    const rows = await sb
      .rest(
        `heroes?select=${HERO_COLS}&name=in.("${encodeURIComponent(an)}","${encodeURIComponent(bn)}")&portrait_url=not.is.null&order=fame_score.desc.nullslast&limit=4`,
      )
      .catch(() => []);
    const a = rows.find((r) => r.name === an),
      b = rows.find((r) => r.name === bn);
    if (a && b) pairs.push([shape(a), shape(b)]);
  }
  const edges = await sb
    .rest(
      `hero_relationships?select=a:heroes!hero_id(${HERO_COLS}),b:heroes!related_id(${HERO_COLS})&kind=eq.enemy&limit=500`,
    )
    .catch(() => []);
  for (const e of edges) {
    if (!e.a?.portrait_url || !e.b?.portrait_url) continue;
    if ((e.a.fame_score ?? 0) < 45 || (e.b.fame_score ?? 0) < 45) continue;
    pairs.push([shape(e.a), shape(e.b)]);
  }
  return pairs;
}
// Family pairs with portraits; the RELATIVE owns the relation label.
async function familyPool(sb) {
  const rows = await sb
    .rest(
      `hero_relatives?select=relation,heroes!hero_id(${HERO_COLS}),related:heroes!related_hero_id(${HERO_COLS})&related_hero_id=not.is.null&limit=600`,
    )
    .catch(() => []);
  const PHRASE = {
    parent: 'the parent of',
    child: 'the child of',
    sibling: 'the sibling of',
    grandparent: 'the grandparent of',
    cousin: 'the cousin of',
    clone: 'a clone of',
    aunt_uncle: 'the aunt/uncle of',
  };
  return rows
    .filter(
      (r) =>
        r.heroes?.portrait_url &&
        r.related?.portrait_url &&
        (r.heroes.fame_score ?? 0) >= 30 &&
        (r.related.fame_score ?? 0) >= 30 &&
        PHRASE[r.relation],
    )
    .map((r) => ({ hero: shape(r.heroes), rel: shape(r.related), text: PHRASE[r.relation] }));
}
async function factPool(sb) {
  const rows = await sb
    .rest(
      `hero_narrative_facts?select=content,heroes!inner(${HERO_COLS})&kind=eq.did_you_know&needs_review=eq.false&heroes.fame_score=gte.30&heroes.portrait_url=not.is.null&limit=300`,
    )
    .catch(() => []);
  return rows
    .filter((r) => r.content && r.content.length > 50)
    .map((r) => ({ hero: shape(r.heroes), fact: r.content.trim() }));
}
const heroCovers = (sb, id) =>
  sb.rest(
    `hero_images?select=url,caption&hero_id=eq.${id}&source=eq.comicvine_cover&order=sort_order&limit=5`,
  );
async function heroFilms(sb, id) {
  const rows = await sb.rest(
    `hero_media_appearances?select=titles(title,year,poster_url,vote_average,popularity)&hero_id=eq.${id}&media_type=eq.movie&limit=30`,
  );
  return rows
    .map((r) => r.titles)
    .filter((t) => t?.poster_url)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 4)
    .map((t) => ({ title: t.title, year: t.year, vote: t.vote_average, poster_url: t.poster_url }));
}

const CAPTIONS = {
  showdown: (e) =>
    `${e.a} vs ${e.b} — the rivalry that never dies 👊\nReal stats. Your vote settles it (link in bio).\n#${slug(e.a).replace(/-/g, '')} #${slug(e.b).replace(/-/g, '')} #whowouldwin #versus #comics #anime`,
  covers: (e) =>
    `The many faces of ${e.a} 📚 — decades of covers, one thread.\nWhich era wins? The whole gallery lives at mythique.app (link in bio).\n#${slug(e.a).replace(/-/g, '')} #comiccovers #comics #comicart`,
  didyouknow: (e) =>
    `Did you know this about ${e.a}? 🤯\nThe file runs deep — full lore at mythique.app (link in bio).\n#${slug(e.a).replace(/-/g, '')} #didyouknow #comics #lore`,
  bloodline: (e) =>
    `Same blood: ${e.a} & ${e.b} 🩸\nThe family tree tells the whole story — mythique.app (link in bio).\n#${slug(e.a).replace(/-/g, '')} #${slug(e.b).replace(/-/g, '')} #familytree #lore #comics`,
  onscreen: (e) =>
    `${e.a}, on screen 🎬 — the films that built the legend.\nEvery appearance is catalogued at mythique.app (link in bio).\n#${slug(e.a).replace(/-/g, '')} #movies #popculture`,
  legend: (e) =>
    `The file on ${e.a} 📇 — six stats, one legend.\nAgree with the ratings? Argue your case 👇\n#${slug(e.a).replace(/-/g, '')} #comics #powerlevels`,
};

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const get = (f, dv) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : dv;
  };
  const n = Number(get('--n', 12));
  let seed = Number(get('--seed', 7));
  const month = get('--month', new Date().toISOString().slice(0, 7));
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const sb = makeSb(loadEnv());
  const F = fonts();
  console.log('Building pools…');
  const [heroes, rivals, families, facts] = await Promise.all([
    pool(sb),
    rivalPool(sb),
    familyPool(sb),
    factPool(sb),
  ]);
  console.log(
    `pools: ${heroes.length} heroes · ${rivals.length} rival pairs · ${families.length} family pairs · ${facts.length} facts`,
  );
  shuffle(rivals);
  shuffle(families);
  shuffle(facts);

  const out = join(OUT_DIR, `organic-${month}`);
  if (existsSync(out)) rmSync(out, { recursive: true });
  mkdirSync(out, { recursive: true });

  const FORMATS = ['showdown', 'covers', 'didyouknow', 'bloodline', 'onscreen', 'legend'];
  const used = new Set();
  const pick = () => {
    for (let i = 0; i < 100; i++) {
      const h = heroes[Math.floor(rand() * Math.min(40, heroes.length))];
      if (!used.has(h.id)) {
        used.add(h.id);
        return h;
      }
    }
    return heroes[Math.floor(rand() * heroes.length)];
  };

  const entries = [];
  let fi = 0,
    cursor = { showdown: 0, bloodline: 0, didyouknow: 0 };
  while (entries.length < n && fi < n * 4) {
    const format = FORMATS[fi % FORMATS.length];
    fi++;
    try {
      let slides, meta;
      if (format === 'showdown') {
        const pair = rivals[cursor.showdown++];
        if (!pair) continue;
        const [a, b] = pair;
        const [aArt, bArt] = await Promise.all([art(a.portrait_url), art(b.portrait_url)]);
        slides = showdownSlides({ ...a, art: aArt }, { ...b, art: bArt });
        meta = { a: a.name, b: b.name, title: `${a.name} vs ${b.name}` };
      } else if (format === 'covers') {
        const h = pick();
        const covers = await heroCovers(sb, h.id);
        if (covers.length < 2) {
          used.delete(h.id);
          continue;
        }
        const withArt = [];
        for (const c of covers) withArt.push({ ...c, art: await art(c.url) });
        slides = coversSlides({ ...h, art: await art(h.portrait_url) }, withArt);
        meta = { a: h.name, title: `Covers — ${h.name}` };
      } else if (format === 'didyouknow') {
        const f = facts[cursor.didyouknow++];
        if (!f) continue;
        slides = didYouKnowSlides({ ...f.hero, art: await art(f.hero.portrait_url) }, f.fact);
        meta = { a: f.hero.name, title: `Did you know — ${f.hero.name}` };
      } else if (format === 'bloodline') {
        const fam = families[cursor.bloodline++];
        if (!fam) continue;
        const [rArt, hArt] = await Promise.all([
          art(fam.rel.portrait_url),
          art(fam.hero.portrait_url),
        ]);
        slides = bloodlineSlides({ ...fam.rel, art: rArt }, { ...fam.hero, art: hArt }, fam.text);
        meta = {
          a: fam.rel.name,
          b: fam.hero.name,
          title: `Bloodline — ${fam.rel.name} & ${fam.hero.name}`,
        };
      } else if (format === 'onscreen') {
        const h = pick();
        const films = await heroFilms(sb, h.id);
        if (films.length < 2) {
          used.delete(h.id);
          continue;
        }
        const withArt = [];
        for (const f of films) withArt.push({ ...f, art: await art(f.poster_url) });
        slides = onscreenSlides({ ...h, art: await art(h.portrait_url) }, withArt);
        meta = { a: h.name, title: `On screen — ${h.name}` };
      } else {
        const h = pick();
        slides = legendSlides({ ...h, art: await art(h.portrait_url) });
        meta = { a: h.name, title: `Legend file — ${h.name}` };
      }
      const dir = join(
        out,
        `${String(entries.length + 1).padStart(2, '0')}-${format}-${slug(meta.title)}`,
      );
      mkdirSync(dir, { recursive: true });
      const plate = {
        showdown: 'arena',
        covers: 'vault',
        didyouknow: 'sky',
        bloodline: 'throne',
        onscreen: 'sky',
        legend: 'throne',
      }[format];
      const files = [];
      for (let i = 0; i < slides.length; i++) {
        const html = adShell(F, { w: W, h: H }, slides[i], '', { plate: plateUri(plate) });
        const file = join(dir, `slide-${i + 1}.png`);
        await renderPng(html, file, W, H);
        files.push(`slide-${i + 1}.png`);
      }
      const caption = CAPTIONS[format](meta);
      writeFileSync(join(dir, 'caption.txt'), caption);
      entries.push({
        ord: entries.length + 1,
        format,
        angle: format,
        title: meta.title,
        dir: dir.split('/').pop(),
        slides: files,
        caption,
      });
      console.log(`[${entries.length}/${n}] ${format} · ${meta.title}`);
    } catch (e) {
      console.warn(`  skip ${format}: ${e instanceof Error ? e.message : e}`);
    }
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ month, entries }, null, 2));
  console.log(`Organic pack ready → ${out}`);
  console.log('Publish: node scripts/social/publish-posts.mjs --batch organic-' + month);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
