# Ad-Safe Content Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command generates ~30 ad-safe (franchise-free) reels + carousels a month, publishes them to the command-center Publish tab as a filterable library with video support.

**Architecture:** A pure, seeded variety engine (`plan.mjs`) rotates 4 angles × 2 formats over pre-fetched ad-safe data pools (`data.mjs` — names + stats, never portraits). Two renderers consume the same `PlanEntry`: carousels via `adShell`+`renderPng`, reels via a scene-timeline 9:16 template + `renderVideo`. A render-time safety assertion hard-fails on any portrait reference. `batch-month.mjs` orchestrates and writes a manifest; `publish-posts.mjs` uploads (incl. Cloudinary video) and upserts `social_posts`; the Publish tab gains video cards + angle/format filter chips.

**Tech Stack:** Node ESM scripts (`scripts/social/`), Playwright+ffmpeg (`renderVideo`), Cloudinary, Supabase (MCP migration), React Native Web (Publish tab), node:test + jest.

**Spec:** `docs/superpowers/specs/2026-07-08-ad-safe-content-factory-design.md`

## Global Constraints

- **Ad-safe by construction**: renderers draw from data only — **no portraits ever**; names as text are fine (nominative use). `assertNoPortrait` runs before every asset is written and hard-fails on violation.
- Disclaimer on every asset: `adShell` (carousels) already bakes it; the reel shell must render `DISCLAIMER` from `scripts/social/safety.mjs` too.
- Reels: **exactly 1080×1920**, hook lands in ~1.5s, motion design (reuse `slam/pop/flash/shake/burst/upIn` keyframe vocabulary from `generate-reels.mjs`), ~10–13s total (renderVideo records 13.3s), premium ink/gold brand system.
- Reuse `scripts/social/lib.mjs` (`renderPng`, `renderVideo`, `fonts`, `COLORS`, `grainUri`, `fontFace`, `makeSb`, `loadEnv`) and `ads/shell.mjs` (`adShell`) — do not fork the render pipeline.
- **yarn only.** Social tests: `yarn test:social` (node --test). App tests: `yarn test:ci`. Typecheck: `yarn tsc --noEmit`.
- Migration via `mcp__supabase__apply_migration` (never `supabase db push`), then regenerate `src/types/database.generated.ts` via MCP; mirror the SQL into `supabase/migrations/`.
- Commit directly to `main`; each implementer commits ONLY its exact named files.
- TypeScript no `any`; `StyleSheet.create` for styles; Nunito/Flame fonts per house rules.

---

### Task 1: Migration + regenerated types (`media_type`, `video_url`, `angle`)

**Files:**
- Create: `supabase/migrations/20260708210000_social_posts_media.sql` (mirror)
- Modify: `src/types/database.generated.ts` (regenerated, never hand-edited)

**Interfaces:**
- Produces: `social_posts.media_type text not null default 'image'`, `social_posts.video_url text`, `social_posts.angle text`. `SocialPost` (= `Tables<'social_posts'>` in `src/lib/db/socialPosts.ts`) picks the columns up automatically on regen — later tasks rely on `post.media_type`, `post.video_url`, `post.angle`.

- [ ] **Step 1: Apply the migration via the Supabase MCP tool** (`mcp__supabase__apply_migration`, name `social_posts_media`):

```sql
-- Reels + filterable library support for the social posting queue.
-- media_type: 'image' (default; carousels/stills) | 'video' (reels — image_url
-- holds the poster frame, video_url the MP4).
-- angle: content angle for the Publish tab's filter chips
-- ('matchup'|'ranking'|'guess'|'fact'|null for legacy rows).
alter table social_posts
  add column if not exists media_type text not null default 'image',
  add column if not exists video_url text,
  add column if not exists angle text;
```

- [ ] **Step 2: Mirror the same SQL** into `supabase/migrations/20260708210000_social_posts_media.sql`.

- [ ] **Step 3: Regenerate types** via `mcp__supabase__generate_typescript_types`. The output is JSON `{"types": "..."}` saved to a tool-results file; extract with python and overwrite `src/types/database.generated.ts` (see the pattern used for prior social_posts migrations):

```bash
python3 -c "
import json
data = json.load(open('<tool-results-file>'))
open('src/types/database.generated.ts','w').write(data['types'])
"
grep -c "media_type\|video_url" src/types/database.generated.ts   # expect >= 3
```

- [ ] **Step 4: Verify** `yarn tsc --noEmit` clean, then confirm in DB:

Run `mcp__supabase__execute_sql`: `select column_name from information_schema.columns where table_name='social_posts' and column_name in ('media_type','video_url','angle');`
Expected: 3 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260708210000_social_posts_media.sql src/types/database.generated.ts
git commit -m "feat(social): social_posts media columns — media_type/video_url/angle"
```

---

### Task 2: `safe-assert.mjs` — the render-time portrait guard (TDD)

**Files:**
- Create: `scripts/social/ads/safe-assert.mjs`
- Test: `scripts/social/ads/safe-assert.test.mjs` (runs under `yarn test:social`)

**Interfaces:**
- Produces: `assertNoPortrait(html: string, label?: string): void` — throws `Error` if the HTML contains any remote `<img>` or a known image-host/portrait-field reference; returns silently otherwise. Both renderers call it before writing any asset.

- [ ] **Step 1: Write the failing test** (`scripts/social/ads/safe-assert.test.mjs`):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNoPortrait } from './safe-assert.mjs';

test('passes clean data-only HTML (data: URIs are fine)', () => {
  assertNoPortrait(`<div class="bar" style="background:url(data:image/svg+xml;utf8,x)">Goku 92</div>`);
});

test('throws on a remote <img>', () => {
  assert.throws(() => assertNoPortrait(`<img src="https://example.com/x.jpg">`), /portrait|remote image/i);
});

test('throws on known image hosts even outside <img>', () => {
  assert.throws(() => assertNoPortrait(`background:url(https://res.cloudinary.com/x/y.png)`), /portrait|remote image/i);
  assert.throws(() => assertNoPortrait(`https://comicvine.gamespot.com/a/uploads/scale_small/x.jpg`), /portrait|remote image/i);
});

test('throws on a portrait field leaking into the payload', () => {
  assert.throws(() => assertNoPortrait(`<div data-x='{"portrait_url":"https://x/y.png"}'></div>`), /portrait/i);
});

test('includes the label in the error', () => {
  assert.throws(() => assertNoPortrait(`<img src="http://x/y.png">`, 'reel:matchup'), /reel:matchup/);
});
```

- [ ] **Step 2: Run to verify FAIL**: `yarn test:social` → the new file errors (module not found).

- [ ] **Step 3: Implement** `scripts/social/ads/safe-assert.mjs`:

```js
// The ad-safety hard gate. Every ad renderer passes its final HTML through
// this before writing an asset: if a portrait / remote image sneaks in, the
// render FAILS instead of producing an unsafe creative. Data: URIs (fonts,
// grain, inline SVG) are always fine — only remote imagery is banned.
const RULES = [
  [/<img[^>]+src=["']https?:/i, 'remote image tag'],
  [/res\.cloudinary\.com/i, 'cloudinary image reference'],
  [/comicvine\.gamespot\.com/i, 'comicvine image reference'],
  [/portrait_url|image_md_url/i, 'portrait field reference'],
  [/url\((["']?)https?:/i, 'remote css image'],
];

export function assertNoPortrait(html, label = 'ad asset') {
  for (const [re, why] of RULES) {
    if (re.test(html)) throw new Error(`[safe-assert] ${label}: ${why} — ad creative must be portrait-free`);
  }
}
```

- [ ] **Step 4: Run to verify PASS**: `yarn test:social` → all pass (including the pre-existing 24+).

- [ ] **Step 5: Commit**

```bash
git add scripts/social/ads/safe-assert.mjs scripts/social/ads/safe-assert.test.mjs
git commit -m "feat(ads): assertNoPortrait — render-time ad-safety hard gate (tested)"
```

---

### Task 3: `data.mjs` — ad-safe data selectors (TDD on the pure parts)

**Files:**
- Create: `scripts/social/ads/data.mjs`
- Test: `scripts/social/ads/data.test.mjs`

**Interfaces:**
- Consumes: `makeSb`, `STAT_KEYS`, `RIVALRIES`, `heroByName`, `famousPool`, `statWins` from `../lib.mjs`; `PUBLISHER_TIER, tierOf` from `../safety.mjs`.
- Produces (all async take `(sb, rand)` where `rand()` ∈ [0,1) is the seeded RNG):
  - `fetchPools(sb, rand, { excludeTierS = false }) → { matchups, rankings, guesses, facts }`
  - `SafeHero = { name: string, fame_score: number, stats: Record<statKey, number>, tier: 'S'|'A'|'B'|'C' }` — **no id/portrait/image fields.**
  - `matchups: { a: SafeHero, b: SafeHero, rounds: [label, av, bv][] }[]` (≥ 8)
  - `rankings: { dimension: string, label: string, rows: { name: string, value: number }[] }[]` (≥ 10, top-10 rows each)
  - `guesses: SafeHero[]` (≥ 6, distinctive spread: max−min stat ≥ 30)
  - `facts: { headline: string, detail: string, stat: string }[]` (≥ 6)
  - Pure exported helpers (unit-tested): `toSafeHero(row)`, `distinctive(hero)`, `buildRounds(a, b)`.

- [ ] **Step 1: Write the failing test** (`scripts/social/ads/data.test.mjs`) for the pure helpers:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSafeHero, distinctive, buildRounds } from './data.mjs';

const row = { id: 'h_1', name: 'Goku', publisher: 'Shueisha', fame_score: 97,
  portrait_url: 'https://res.cloudinary.com/x.png', image_url: 'https://x/y.jpg', image_md_url: null,
  intelligence: 56, strength: 90, speed: 95, durability: 90, power: 98, combat: 100 };

test('toSafeHero strips every image/id field and keeps name+stats+tier', () => {
  const h = toSafeHero(row);
  assert.equal(h.name, 'Goku');
  assert.equal(h.tier, 'S'); // Shueisha
  assert.equal(h.stats.speed, 95);
  for (const k of ['id', 'portrait_url', 'image_url', 'image_md_url', 'publisher'])
    assert.ok(!(k in h), `${k} must not leak`);
});

test('distinctive requires a max-min stat spread >= 30', () => {
  assert.equal(distinctive(toSafeHero(row)), true); // 100-56 = 44
  const flat = toSafeHero({ ...row, intelligence: 80, strength: 82, speed: 84, durability: 80, power: 81, combat: 83 });
  assert.equal(distinctive(flat), false);
});

test('buildRounds returns 3-4 contrasting stat rounds with real values', () => {
  const b = toSafeHero({ ...row, name: 'Superman', publisher: 'DC Comics', intelligence: 94, strength: 100, speed: 100, durability: 100, power: 100, combat: 85 });
  const rounds = buildRounds(toSafeHero(row), b);
  assert.ok(rounds.length >= 3 && rounds.length <= 4);
  for (const [label, av, bv] of rounds) {
    assert.equal(typeof label, 'string');
    assert.ok(av > 0 && bv > 0);
  }
});
```

- [ ] **Step 2: Run to verify FAIL**: `yarn test:social`.

- [ ] **Step 3: Implement** `scripts/social/ads/data.mjs`:

```js
// Ad-safe data selectors — everything the content factory renders comes from
// here, and NOTHING here carries a portrait. toSafeHero is the chokepoint:
// name + stats + fame + tier only.
import { STAT_KEYS, RIVALRIES, heroByName, famousPool, statWins } from '../lib.mjs';
import { tierOf } from '../safety.mjs';

export function toSafeHero(row) {
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = row[k] ?? 0;
  return { name: row.name, fame_score: row.fame_score ?? 0, stats, tier: tierOf(row) };
}

export const distinctive = (h) => {
  const v = Object.values(h.stats).filter((n) => n > 0);
  return v.length === STAT_KEYS.length && Math.max(...v) - Math.min(...v) >= 30;
};

/** 3-4 stat rounds picked for contrast (biggest gaps first, mixed winners). */
export function buildRounds(a, b) {
  const LABELS = { intelligence: 'INTELLIGENCE', strength: 'STRENGTH', speed: 'SPEED', durability: 'DURABILITY', power: 'POWER', combat: 'COMBAT' };
  const scored = STAT_KEYS
    .map((k) => ({ k, av: a.stats[k], bv: b.stats[k], gap: Math.abs(a.stats[k] - b.stats[k]) }))
    .filter((s) => s.av > 0 && s.bv > 0)
    .sort((x, y) => y.gap - x.gap);
  const aWins = scored.filter((s) => s.av >= s.bv).slice(0, 2);
  const bWins = scored.filter((s) => s.bv > s.av).slice(0, 2);
  return [...aWins, ...bWins].slice(0, 4).map((s) => [LABELS[s.k], s.av, s.bv]);
}

const RANK_LABELS = { intelligence: 'smartest', strength: 'strongest', speed: 'fastest', durability: 'toughest', power: 'most powerful', combat: 'best fighters', fame_score: 'most famous' };

export async function fetchPools(sb, rand, { excludeTierS = false } = {}) {
  const pool = (await famousPool(sb)).map(toSafeHero).filter((h) => !excludeTierS || h.tier !== 'S');

  // matchups: rivalries that resolve, topped up with contrasting famous pairs
  const matchups = [];
  for (const [an, bn] of RIVALRIES) {
    if (matchups.length >= 10) break;
    const [ar, br] = await Promise.all([heroByName(sb, an), heroByName(sb, bn)]);
    if (!ar || !br) continue;
    const a = toSafeHero(ar), b = toSafeHero(br);
    if (excludeTierS && (a.tier === 'S' || b.tier === 'S')) continue;
    const rounds = buildRounds(a, b);
    if (rounds.length >= 3) matchups.push({ a, b, rounds });
  }
  while (matchups.length < 10 && pool.length > 4) {
    const a = pool[Math.floor(rand() * Math.min(40, pool.length))];
    const b = pool[Math.floor(rand() * Math.min(40, pool.length))];
    if (a === b || matchups.some((m) => m.a.name === a.name && m.b.name === b.name)) continue;
    const rounds = buildRounds(a, b);
    if (rounds.length >= 3) matchups.push({ a, b, rounds });
  }

  // rankings: every dimension, names+values only
  const rankings = [];
  for (const dim of [...STAT_KEYS, 'fame_score']) {
    const rows = await sb.rest(`heroes?select=name,${dim},publisher,fame_score&order=${dim}.desc.nullslast,fame_score.desc&limit=14`);
    const top = rows
      .filter((r) => !excludeTierS || tierOf(r) !== 'S')
      .slice(0, 10)
      .map((r) => ({ name: r.name, value: r[dim] ?? 0 }));
    if (top.length === 10) rankings.push({ dimension: dim, label: RANK_LABELS[dim], rows: top });
  }

  // guesses: distinctive famous heroes (recognizable = guessable)
  const guesses = pool.filter(distinctive).slice(0, 12);

  // facts: computed superlatives from the pools already in hand
  const facts = [];
  const byStat = (k) => [...pool].sort((x, y) => y.stats[k] - x.stats[k])[0];
  const fastest = byStat('speed'), smartest = byStat('intelligence'), strongest = byStat('strength');
  if (fastest) facts.push({ headline: `The fastest character we've ever rated`, detail: `${fastest.name} — speed ${fastest.stats.speed}/100`, stat: `${fastest.stats.speed}` });
  if (smartest) facts.push({ headline: `The highest intelligence on record`, detail: `${smartest.name} — intelligence ${smartest.stats.intelligence}/100`, stat: `${smartest.stats.intelligence}` });
  if (strongest) facts.push({ headline: `Pure strength, ranked`, detail: `${strongest.name} sits at ${strongest.stats.strength}/100`, stat: `${strongest.stats.strength}` });
  const perfect = pool.filter((h) => Object.values(h.stats).some((v) => v >= 100));
  facts.push({ headline: `Only ${perfect.length} characters have a perfect 100 stat`, detail: `Out of 35,000+ rated files`, stat: `${perfect.length}` });
  const famous = [...pool].sort((x, y) => y.fame_score - x.fame_score)[0];
  if (famous) facts.push({ headline: `The most famous character on Mythique`, detail: `${famous.name} — fame ${famous.fame_score}/100`, stat: `${famous.fame_score}` });
  facts.push({ headline: `35,000+ heroes & villains, every one rated`, detail: `powers · matchups · rankings · lore`, stat: '35k+' });

  return { matchups, rankings, guesses, facts };
}
```

Note: `sb.rest` is the query helper `makeSb` returns (see `lib.mjs:47`); verify its exact name (`sb.rest(path)`) by reading `makeSb` and adjust if it differs.

- [ ] **Step 4: Run to verify PASS**: `yarn test:social` → all green.

- [ ] **Step 5: Commit**

```bash
git add scripts/social/ads/data.mjs scripts/social/ads/data.test.mjs
git commit -m "feat(ads): ad-safe data selectors — names+stats only, portrait fields stripped (tested)"
```

---

### Task 4: `plan.mjs` — the seeded variety engine (pure, TDD)

**Files:**
- Create: `scripts/social/ads/plan.mjs`
- Test: `scripts/social/ads/plan.test.mjs`

**Interfaces:**
- Consumes: `suggestMusic(kind, title)` from `../music.mjs`; pools shape from Task 3.
- Produces:
  - `rng(seed: number) → () => number` (the seeded PRNG from `ad-brand.mjs`, re-exported here as the shared one).
  - `buildPlan({ n = 30, seed = 1, mix = { carousel: 18, reel: 12 }, pools }) → PlanEntry[]`
  - `PlanEntry = { ord: number, angle: 'matchup'|'ranking'|'guess'|'fact', format: 'carousel'|'reel', title: string, data: object, caption: string, music: string }`
  - Guarantees (tested): length = n (or pool-limited max), format counts match `mix` (scaled to n), every angle appears in both formats when n ≥ 8, no duplicate `(angle, title)` in a batch, same seed ⇒ identical plan, different seed ⇒ different plan.

- [ ] **Step 1: Write the failing test** (`scripts/social/ads/plan.test.mjs`):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, rng } from './plan.mjs';

const H = (name, over = {}) => ({ name, fame_score: 90, tier: 'A',
  stats: { intelligence: 60, strength: 90, speed: 80, durability: 70, power: 85, combat: 95, ...over } });
const pools = {
  matchups: Array.from({ length: 12 }, (_, i) => ({ a: H(`A${i}`), b: H(`B${i}`), rounds: [['SPEED', 80, 70], ['POWER', 60, 90], ['COMBAT', 95, 50]] })),
  rankings: Array.from({ length: 10 }, (_, i) => ({ dimension: `d${i}`, label: `dim ${i}`, rows: Array.from({ length: 10 }, (_, j) => ({ name: `R${i}-${j}`, value: 100 - j })) })),
  guesses: Array.from({ length: 8 }, (_, i) => H(`G${i}`)),
  facts: Array.from({ length: 8 }, (_, i) => ({ headline: `Fact ${i}`, detail: `detail ${i}`, stat: `${i}` })),
};

test('produces n entries with the requested format mix', () => {
  const plan = buildPlan({ n: 30, seed: 7, mix: { carousel: 18, reel: 12 }, pools });
  assert.equal(plan.length, 30);
  assert.equal(plan.filter((e) => e.format === 'carousel').length, 18);
  assert.equal(plan.filter((e) => e.format === 'reel').length, 12);
});

test('every angle appears in both formats', () => {
  const plan = buildPlan({ n: 30, seed: 7, mix: { carousel: 18, reel: 12 }, pools });
  for (const angle of ['matchup', 'ranking', 'guess', 'fact'])
    for (const format of ['carousel', 'reel'])
      assert.ok(plan.some((e) => e.angle === angle && e.format === format), `${angle}/${format} missing`);
});

test('no duplicate content within a batch', () => {
  const plan = buildPlan({ n: 30, seed: 7, mix: { carousel: 18, reel: 12 }, pools });
  const keys = plan.map((e) => `${e.angle}:${e.title}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('deterministic by seed; different seeds differ', () => {
  const a = buildPlan({ n: 20, seed: 3, mix: { carousel: 12, reel: 8 }, pools });
  const b = buildPlan({ n: 20, seed: 3, mix: { carousel: 12, reel: 8 }, pools });
  const c = buildPlan({ n: 20, seed: 4, mix: { carousel: 12, reel: 8 }, pools });
  assert.deepEqual(a.map((e) => e.title), b.map((e) => e.title));
  assert.notDeepEqual(a.map((e) => e.title), c.map((e) => e.title));
});

test('every entry has ord, caption and music', () => {
  const plan = buildPlan({ n: 12, seed: 1, mix: { carousel: 8, reel: 4 }, pools });
  plan.forEach((e, i) => {
    assert.equal(e.ord, i + 1);
    assert.ok(e.caption.length > 10);
    assert.ok(e.music.length > 10);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**: `yarn test:social`.

- [ ] **Step 3: Implement** `scripts/social/ads/plan.mjs`:

```js
// The variety engine — pure and seeded. Turns pre-fetched ad-safe data pools
// into a mixed batch of PlanEntries (angle × format), no repeats within a
// batch, deterministic per seed so a month can be regenerated identically.
import { suggestMusic } from '../music.mjs';

export function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Per-angle: consume the next unused pool item → { title, data, caption }.
const MAKERS = {
  matchup: (m) => ({
    title: `${m.a.name} vs ${m.b.name}`,
    data: m,
    caption: `${m.a.name} vs ${m.b.name} — who takes it? ⚔️\n\nRound by round, stat by stat. Cast your vote on mythique.app\n\n#whowouldwin #superheroes #comics #mythique`,
  }),
  ranking: (r) => ({
    title: `Top 10 ${r.label}`,
    data: r,
    caption: `The 10 ${r.label} characters, ranked. Who got robbed? 👇\n\nRanked by the Mythique fame & power data — mythique.app\n\n#top10 #superheroes #comics #ranking #mythique`,
  }),
  guess: (g) => ({
    title: `Guess the hero — ${g.name}`,
    data: g,
    caption: `Six stats. One legend. Who is it? 🤔\n\nAnswer in the last slide — 35,000+ more on mythique.app\n\n#guesswho #superheroes #quiz #comics #mythique`,
  }),
  fact: (f) => ({
    title: f.headline,
    data: f,
    caption: `${f.headline}. ${f.detail}\n\nExplore 35,000+ rated files on mythique.app\n\n#didyouknow #superheroes #comics #mythique`,
  }),
};
const ANGLES = ['matchup', 'ranking', 'guess', 'fact'];
const POOL_KEY = { matchup: 'matchups', ranking: 'rankings', guess: 'guesses', fact: 'facts' };
// music.mjs kinds: matchup|ranking|bio|brand|post — map guess/fact to fitting kinds.
const MUSIC_KIND = { matchup: 'matchup', ranking: 'ranking', guess: 'post', fact: 'brand' };

export function buildPlan({ n = 30, seed = 1, mix = { carousel: 18, reel: 12 }, pools }) {
  const rand = rng(seed);
  // shuffle each pool deterministically so different seeds pick different items
  const shuffled = {};
  for (const [k, arr] of Object.entries(pools)) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    shuffled[k] = a;
  }
  const cursors = { matchups: 0, rankings: 0, guesses: 0, facts: 0 };
  const next = (angle) => {
    const key = POOL_KEY[angle];
    const arr = shuffled[key];
    if (cursors[key] >= arr.length) return null; // pool exhausted
    return arr[cursors[key]++];
  };

  // format sequence: scale mix to n, interleave so both formats spread out
  const total = mix.carousel + mix.reel;
  const nCar = Math.round((n * mix.carousel) / total);
  const formats = [];
  let c = 0, r = 0;
  for (let i = 0; i < n; i++) {
    // keep the running ratio close to the target
    if (c * (n - nCar) <= r * nCar && c < nCar) { formats.push('carousel'); c++; }
    else { formats.push('reel'); r++; }
  }

  const entries = [];
  let ai = Math.floor(rand() * ANGLES.length);
  for (let i = 0; i < n; i++) {
    // round-robin angles, skipping exhausted pools
    let item = null, angle = null;
    for (let tries = 0; tries < ANGLES.length && !item; tries++) {
      angle = ANGLES[(ai + tries) % ANGLES.length];
      item = next(angle);
    }
    if (!item) break; // all pools exhausted
    ai = (ANGLES.indexOf(angle) + 1) % ANGLES.length;
    const made = MAKERS[angle](item);
    entries.push({
      ord: entries.length + 1,
      angle,
      format: formats[i],
      title: made.title,
      data: made.data,
      caption: made.caption,
      music: suggestMusic(MUSIC_KIND[angle], made.title),
    });
  }
  return entries;
}
```

- [ ] **Step 4: Run to verify PASS**: `yarn test:social` → all green. If the "every angle in both formats" test is flaky for some seed, fix the interleave (e.g. offset the angle round-robin per format), don't loosen the test.

- [ ] **Step 5: Commit**

```bash
git add scripts/social/ads/plan.mjs scripts/social/ads/plan.test.mjs
git commit -m "feat(ads): seeded variety engine — 4 angles x 2 formats, no repeats, deterministic (tested)"
```

---

### Task 5: `render-carousel.mjs` — multi-slide ad-safe carousels

**Files:**
- Create: `scripts/social/ads/render-carousel.mjs`

**Interfaces:**
- Consumes: `PlanEntry` (Task 4), `adShell` from `./shell.mjs`, `renderPng, fonts, COLORS` from `../lib.mjs`, `assertNoPortrait` from `./safe-assert.mjs`.
- Produces: `renderCarousel(entry, { outDir, F, size = '4x5' }) → Promise<{ dir, slides: string[] }>` — writes `slide-1.png … slide-N.png` + `caption.txt` into `outDir/<ord>-<slug>/`, returns absolute paths. Every slide's HTML passes `assertNoPortrait` before render.

- [ ] **Step 1: Implement.** Slide sets per angle (each slide = `adShell(F, {w,h}, inner)` rendered at 1080×1350 for `4x5`). Use the composition helpers/styling from `ad-brand.mjs` as the visual reference (eyebrow, big Flame headline `class="pop"`, gold/cream/muted palette, centred stage with balanced offsets — same `stage()` math). Concretely:

```js
// Carousel renderer — every angle becomes a 3-5 slide, franchise-free story.
// Slides share the adShell (disclaimer baked in) and the balanced stage math
// from ad-brand.mjs; assertNoPortrait gates every slide.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderPng, COLORS } from '../lib.mjs';
import { adShell } from './shell.mjs';
import { assertNoPortrait } from './safe-assert.mjs';

const GOLD = '#e0a83e', ORANGE = '#e8823a', TEAL = '#4fb3d0', CREAM = '#f6eddd', MUTED = '#9db4c4';
const SIZES = { '4x5': [1080, 1350], '1x1': [1080, 1080] };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const stage = (w, h, inner) =>
  `<div style="position:absolute;left:0;right:0;top:${Math.round(h * 0.055)}px;bottom:${Math.round(h * 0.11)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${Math.round(w * 0.08)}px">${inner}</div>`;
const eyebrow = (h, t, color = GOLD) => `<div style="font-size:${Math.round(h * 0.028)}px;letter-spacing:.24em;color:${color};margin-bottom:${Math.round(h * 0.028)}px">${t}</div>`;
const head = (h, t, size = 0.07) => `<div class="pop" style="font-size:${Math.round(h * size)}px;line-height:1;color:${CREAM}">${t}</div>`;
const sub = (h, t) => `<div style="font-size:${Math.round(h * 0.032)}px;color:${MUTED};margin-top:${Math.round(h * 0.02)}px">${t}</div>`;
const bar = (w, h, pct, color, hh = 0.04) =>
  `<div style="width:100%;height:${Math.round(h * hh)}px;border-radius:999px;background:rgba(255,255,255,.04);box-shadow:inset 0 1px 3px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.07)"><div style="width:${pct}%;height:100%;border-radius:999px;background:linear-gradient(90deg, ${ORANGE}, ${GOLD})"></div></div>`;
const plate = (w, c) => { const p = Math.round(w * 0.26); return `<div style="width:${p}px;height:${p}px;border-radius:26%;background:rgba(255,255,255,.035);border:${Math.max(2, Math.round(p * 0.011))}px solid ${c};display:flex;align-items:center;justify-content:center"><span class="pop" style="font-size:${Math.round(p * 0.5)}px;color:${c}">?</span></div>`; };

const SLIDES = {
  matchup: (e, w, h) => {
    const { a, b, rounds } = e.data;
    const hook = stage(w, h, `${eyebrow(h, 'SETTLE THE ARGUMENT')}
      <div style="display:flex;align-items:center;gap:${Math.round(w * 0.05)}px;margin-bottom:${Math.round(h * 0.05)}px">${plate(w, ORANGE)}<span class="pop" style="font-size:${Math.round(h * 0.07)}px;color:${GOLD}">VS</span>${plate(w, TEAL)}</div>
      ${head(h, `${a.name} vs ${b.name}`, 0.06)}${sub(h, 'Round by round. Swipe →')}`);
    const roundSlides = rounds.map(([label, av, bv], i) => stage(w, h,
      `${eyebrow(h, `ROUND ${i + 1}`)}${head(h, label, 0.075)}
       <div style="width:100%;margin-top:${Math.round(h * 0.05)}px;text-align:left">
         <div style="display:flex;justify-content:space-between;font-size:${Math.round(h * 0.034)}px;margin-bottom:8px"><span style="color:${ORANGE}">${a.name}</span><span class="pop" style="color:${ORANGE}">${av}</span></div>${bar(w, h, av, ORANGE)}
         <div style="display:flex;justify-content:space-between;font-size:${Math.round(h * 0.034)}px;margin:24px 0 8px"><span style="color:${TEAL}">${b.name}</span><span class="pop" style="color:${TEAL}">${bv}</span></div>${bar(w, h, bv, TEAL)}
       </div>
       <div class="pop" style="font-size:${Math.round(h * 0.042)}px;color:${av >= bv ? ORANGE : TEAL};margin-top:${Math.round(h * 0.05)}px">${av >= bv ? a.name : b.name} TAKES IT</div>`));
    const cta = stage(w, h, `${head(h, 'Who’s right?', 0.085)}${sub(h, 'The stats say one thing. The fans say another.')}
      <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">Vote on mythique.app&thinsp;→</div>`);
    return [hook, ...roundSlides, cta];
  },
  ranking: (e, w, h) => {
    const { label, rows } = e.data;
    const hook = stage(w, h, `${eyebrow(h, 'THE RANKINGS')}${head(h, `Top 10 ${label}`, 0.08)}${sub(h, 'Counted down. Swipe →')}`);
    const half = (rs, from) => stage(w, h, `${eyebrow(h, `#${from} → #${from - 4}`)}
      <div style="width:100%">${rs.map((r, i) => `<div style="display:flex;align-items:center;gap:${Math.round(w * 0.03)}px;padding:${Math.round(h * 0.012)}px 0">
        <span class="pop" style="font-size:${Math.round(h * 0.045)}px;color:${GOLD};width:${Math.round(w * 0.1)}px;text-align:left">${from - i}</span>
        <span style="flex:1;text-align:left;font-size:${Math.round(h * 0.036)}px;color:${CREAM}">${r.name}</span>
        <span class="pop" style="font-size:${Math.round(h * 0.036)}px;color:${MUTED}">${r.value}</span></div>
        ${bar(w, h, r.value, GOLD, 0.014)}`).join('')}</div>`);
    const cta = stage(w, h, `${head(h, 'Agree with #1?', 0.075)}${sub(h, 'Argue your case in the comments 👇')}
      <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">Full rankings · mythique.app&thinsp;→</div>`);
    return [hook, half(rows.slice(5, 10).reverse(), 10), half(rows.slice(0, 5).reverse(), 5), cta];
  },
  guess: (e, w, h) => {
    const g = e.data;
    const statRows = Object.entries(g.stats).map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:${Math.round(h * 0.034)}px;padding:${Math.round(h * 0.012)}px 0;border-bottom:1px solid rgba(224,168,62,.14)"><span style="letter-spacing:.14em;color:${MUTED}">${k.toUpperCase()}</span><span class="pop" style="color:${GOLD}">${v}</span></div>`).join('');
    return [
      stage(w, h, `${eyebrow(h, 'GUESS THE HERO')}${head(h, 'Six stats.<br>One legend.', 0.07)}
        <div style="width:100%;margin-top:${Math.round(h * 0.04)}px;background:rgba(13,30,42,.92);border:1px solid rgba(224,168,62,.28);border-radius:${Math.round(h * 0.018)}px;padding:${Math.round(h * 0.025)}px ${Math.round(w * 0.05)}px">${statRows}</div>
        ${sub(h, 'Who is it? Answer next slide →')}`),
      stage(w, h, `${eyebrow(h, 'THE ANSWER')}${head(h, g.name, 0.09)}${sub(h, `Fame ${g.fame_score}/100 · one of 35,000+ rated files`)}
        <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">mythique.app&thinsp;→</div>`),
    ];
  },
  fact: (e, w, h) => {
    const f = e.data;
    return [
      stage(w, h, `${eyebrow(h, 'DID YOU KNOW')}${head(h, f.headline, 0.062)}
        <div class="pop" style="font-size:${Math.round(h * 0.14)}px;color:${GOLD};margin:${Math.round(h * 0.04)}px 0">${f.stat}</div>${sub(h, f.detail)}`),
      stage(w, h, `${head(h, 'There’s a file on everyone.', 0.065)}${sub(h, '35,000+ heroes & villains — powers, matchups, rankings & lore')}
        <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">mythique.app&thinsp;→</div>`),
    ];
  },
};

export async function renderCarousel(entry, { outDir, F, size = '4x5' }) {
  const [w, h] = SIZES[size];
  const dir = join(outDir, `${String(entry.ord).padStart(2, '0')}-${slug(entry.title)}`);
  mkdirSync(dir, { recursive: true });
  const inners = SLIDES[entry.angle](entry, w, h);
  const slides = [];
  for (let i = 0; i < inners.length; i++) {
    const html = adShell(F, { w, h }, inners[i]);
    assertNoPortrait(html, `carousel:${entry.angle}:${entry.title}`);
    const out = join(dir, `slide-${i + 1}.png`);
    await renderPng(html, out, w, h);
    slides.push(out);
  }
  writeFileSync(join(dir, 'caption.txt'), entry.caption);
  return { dir, slides };
}
```

- [ ] **Step 2: Smoke-verify** by rendering one of each angle with a stub entry (a small inline script or `node -e`), then **view the PNGs with the Read tool** — check: balanced vertical composition (no dead bottom third), bars legible, disclaimer footer present. Iterate until they pass that bar.

- [ ] **Step 3: Run** `yarn test:social` (no regressions) and commit:

```bash
git add scripts/social/ads/render-carousel.mjs
git commit -m "feat(ads): ad-safe carousel renderer — 4 angles, safety-gated slides"
```

---

### Task 6: `render-reel.mjs` — face-free 9:16 reels (quality-gated)

**Files:**
- Create: `scripts/social/ads/render-reel.mjs`

**Interfaces:**
- Consumes: `PlanEntry`, `renderVideo, fonts, COLORS, grainUri, fontFace` from `../lib.mjs`, `DISCLAIMER` from `../safety.mjs`, `assertNoPortrait` from `./safe-assert.mjs`, `renderPng` for the poster.
- Produces: `renderReel(entry, { outDir, F }) → Promise<{ dir, mp4, poster }>` — writes `reel.mp4` (1080×1920) + `poster.png` (first-scene still) + `caption.txt`.

**Quality bar (from the spec — acceptance criteria for Step 3's eyeball pass):** exact 1080×1920; hook readable within ~1.5s; staggered motion (reuse the `slam/pop/flash/shake/burst/upIn/drift` keyframes from `generate-reels.mjs`); ink stage + gold + grain (premium brand, not template-y); ends on a comment-bait beat; total ≈ 12s within the 13.3s recording window.

- [ ] **Step 1: Implement the shared reel shell + scene timeline.** Structure: a `reelShell(F, scenes, script)` that emits the 1080×1920 page (same `.root/.dots/.grain` stage as `generate-reels.mjs` `buildHtml`, but **no `<img>` anywhere**) with a scene engine:

```js
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
function reelShell(F, scenes) {
  const grain = grainUri();
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
@keyframes flash{from{opacity:.9}to{opacity:0}}`;
  const body = scenes.map((s) => `<div class="scene" id="${s.id}">${s.html}<div class="flash"></div></div>`).join('');
  const timeline = scenes.map((s) => s.ms);
  const script = `const T=${JSON.stringify(timeline)};const ids=${JSON.stringify(scenes.map((s) => s.id))};let t=300;
ids.forEach((id,i)=>{setTimeout(()=>{document.querySelectorAll('.scene.on').forEach(e=>e.classList.remove('on'));
const sc=document.getElementById(id);sc.classList.add('on');
sc.querySelectorAll('.cnt').forEach(el=>{const to=+el.dataset.to;const t0=performance.now();const step=(now)=>{const p=Math.min(1,(now-t0)/700);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)});
sc.querySelectorAll('.fill').forEach(el=>{requestAnimationFrame(()=>{el.style.width=el.dataset.w+'%'})});
},t);t+=T[i];});`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="root"><div class="dots"></div><div class="grain"></div>${body}<div class="foot"><span class="wm">mythique</span><span class="at">@mythiqueapp</span><div class="disc">${DISCLAIMER}</div></div><script>${script}</script></div></body></html>`;
}
```

Then the 4 scene builders (each returns `scenes` totalling ≈ 12000ms; hook scene first at ~1600ms):

```js
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
      ...e.data.rounds.slice(0, 3).map(round),
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
  const posterHtml = reelShell(F, [{ ...scenes[0], ms: 999999 }]).replace('<script>', '<script>document.querySelector(".scene").classList.add("on");void 0;');
  assertNoPortrait(posterHtml, `poster:${entry.angle}`);
  const poster = join(dir, 'poster.png');
  await renderPng(posterHtml, poster, 1080, 1920);
  writeFileSync(join(dir, 'caption.txt'), `${entry.caption}\n\n♪ ${entry.music}`);
  return { dir, mp4, poster };
}
```

(If the poster `.replace` trick is brittle, add a `still: true` option to `reelShell` that renders scene 0 with `.on` pre-applied — implementer's choice, but the poster must show the hook scene.)

- [ ] **Step 2: Render one reel per angle** with stub entries and verify with ffprobe + eyeball:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of csv=p=0 out/social/<dir>/reel.mp4
# expect: 1080,1920,~13.x
```
Then **watch each MP4** (open in QuickTime) against the quality bar above; view `poster.png` with the Read tool. Iterate on timing/type sizes until they genuinely pass — this eyeball gate is part of the task, not optional.

- [ ] **Step 3: Commit**

```bash
git add scripts/social/ads/render-reel.mjs
git commit -m "feat(ads): face-free reel renderer — 4 scene-timeline templates, 1080x1920, safety-gated"
```

---

### Task 7: `batch-month.mjs` — orchestrator + manifest + gallery

**Files:**
- Create: `scripts/social/ads/batch-month.mjs`

**Interfaces:**
- Consumes: `fetchPools` (T3), `buildPlan, rng` (T4), `renderCarousel` (T5), `renderReel` (T6), `loadEnv, makeSb, fonts, OUT_DIR` from `../lib.mjs`.
- Produces: `out/social/ad-library-YYYY-MM/` containing per-entry dirs, `manifest.json`, and `gallery.html`. Manifest schema (what Task 8's collector reads):

```json
{ "batch": "ad-library-2026-07", "seed": 7, "entries": [
  { "ord": 1, "angle": "matchup", "format": "reel", "title": "Goku vs Superman",
    "caption": "...", "music": "...", "dir": "01-goku-vs-superman",
    "slides": ["slide-1.png"], "mp4": "reel.mp4", "poster": "poster.png" } ] }
```
(`slides` for carousels; `mp4`+`poster` for reels; paths relative to the batch dir.)

- [ ] **Step 1: Implement**:

```js
#!/usr/bin/env node
// One command → a month of ad-safe content. Plan (seeded) → render every
// entry (carousels + reels) → manifest.json + a visual gallery for triage.
//
//   node scripts/social/ads/batch-month.mjs                    # ~30 pieces
//   node scripts/social/ads/batch-month.mjs --n 12 --seed 9
//   node scripts/social/ads/batch-month.mjs --dry-run          # plan only
//   node scripts/social/ads/batch-month.mjs --exclude-tier-s
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR } from '../lib.mjs';
import { fetchPools } from './data.mjs';
import { buildPlan, rng } from './plan.mjs';
import { renderCarousel } from './render-carousel.mjs';
import { renderReel } from './render-reel.mjs';
import { relative } from 'node:path';

function gallery(batch, entries) {
  const cell = (e) => `<div class="c"><div class="k">${e.ord} · ${e.angle} · ${e.format}</div>
    ${e.format === 'reel' ? `<video src="${e.dir}/${e.mp4}" poster="${e.dir}/${e.poster}" controls muted></video>` : `<img src="${e.dir}/${e.slides[0]}" loading="lazy">`}
    <div class="t">${e.title}</div></div>`;
  return `<!doctype html><meta charset="utf-8"><title>${batch}</title><style>body{font:14px -apple-system,sans-serif;background:#0b1820;color:#f5ebdc;padding:24px}h1{margin-bottom:16px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}.c{background:rgba(255,255,255,.04);border-radius:12px;padding:10px}.c img,.c video{width:100%;border-radius:8px}.k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#e0a83e;margin-bottom:8px}.t{margin-top:8px;font-weight:700}</style>
  <h1>${batch} · ${entries.length} pieces</h1><div class="g">${entries.map(cell).join('')}</div>`;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, dv) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : dv; };
  const n = Number(get('--n', 30));
  const seed = Number(get('--seed', Math.floor(Date.now() / 2_592_000_000))); // month-derived default
  const dry = args.includes('--dry-run');
  const excludeTierS = args.includes('--exclude-tier-s');
  const mix = { carousel: Number(get('--carousels', 18)), reel: Number(get('--reels', 12)) };

  const sb = makeSb(loadEnv());
  const rand = rng(seed);
  console.log(`Fetching ad-safe data pools…`);
  const pools = await fetchPools(sb, rand, { excludeTierS });
  const plan = buildPlan({ n, seed, mix, pools });
  console.log(`Plan: ${plan.length} entries (seed ${seed})`);
  for (const e of plan) console.log(`  ${String(e.ord).padStart(2, '0')}  ${e.format.padEnd(8)} ${e.angle.padEnd(8)} ${e.title}`);
  if (dry) return;

  const stamp = new Date().toISOString().slice(0, 7); // YYYY-MM
  const batch = `ad-library-${stamp}`;
  const outDir = join(OUT_DIR, batch);
  mkdirSync(outDir, { recursive: true });
  const F = fonts();
  const manifest = { batch, seed, entries: [] };
  for (const e of plan) {
    console.log(`\n[${e.ord}/${plan.length}] ${e.format} · ${e.title}`);
    if (e.format === 'carousel') {
      const { dir, slides } = await renderCarousel(e, { outDir, F });
      manifest.entries.push({ ord: e.ord, angle: e.angle, format: e.format, title: e.title, caption: e.caption, music: e.music, dir: relative(outDir, dir), slides: slides.map((s) => relative(dir, s)) });
    } else {
      const { dir, mp4, poster } = await renderReel(e, { outDir, F });
      manifest.entries.push({ ord: e.ord, angle: e.angle, format: e.format, title: e.title, caption: e.caption, music: e.music, dir: relative(outDir, dir), mp4: relative(dir, mp4), poster: relative(dir, poster) });
    }
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(outDir, 'gallery.html'), gallery(batch, manifest.entries));
  console.log(`\nLibrary ready → ${outDir}\nOpen the gallery: open "${join(outDir, 'gallery.html')}"\nPublish it:       node scripts/social/publish-posts.mjs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Verify** `--dry-run` prints a 30-entry plan (18/12 split), then run a **small real batch** `--n 6 --seed 2` and check: 6 dirs, `manifest.json` valid (each entry has `slides` or `mp4`+`poster`), `gallery.html` opens.

- [ ] **Step 3: Commit**

```bash
git add scripts/social/ads/batch-month.mjs
git commit -m "feat(ads): batch-month orchestrator — plan, render, manifest + triage gallery"
```

---

### Task 8: Publish the library (video upload + new columns)

**Files:**
- Modify: `scripts/social/publish-posts.mjs`

**Interfaces:**
- Consumes: the Task 7 manifest; existing `collect()`/upload/upsert flow.
- Produces: `social_posts` rows for the newest `ad-library-*` batch with `ad_safety:'ad_safe'`, `angle`, `media_type`, `video_url` (reels), `guide_music`. Existing launch/week/ad-toolkit collection unchanged.

- [ ] **Step 1: Add the collector.** In `collect()`, after `posts.push(...collectAdToolkit());` add `posts.push(...collectAdLibrary());`, and implement:

```js
// The monthly ad-safe library (batch-month.mjs output) — newest batch only.
// Reels carry { video: mp4Path, poster } and upload as Cloudinary video.
function collectAdLibrary() {
  const libs = readdirSync(OUT).filter((d) => /^ad-library-\d{4}-\d{2}$/.test(d)).sort();
  const latest = libs[libs.length - 1];
  if (!latest) return [];
  let manifest;
  try { manifest = JSON.parse(readFileSync(join(OUT, latest, 'manifest.json'), 'utf8')); } catch { return []; }
  return manifest.entries.map((e) => ({
    batch: latest, ord: e.ord, day: null, kind: e.angle, title: e.title,
    dir: join(OUT, latest, e.dir),
    files: e.format === 'carousel' ? e.slides : [e.poster],
    video: e.format === 'reel' ? e.mp4 : null,
    caption: e.caption, where: e.format === 'reel' ? 'Reels · TikTok' : 'IG feed · TikTok photo', when: '',
    adSafety: 'ad_safe', angle: e.angle, music: e.music,
  }));
}
```

- [ ] **Step 2: Extend the upload/row loop.** In `main()`'s per-post loop, after uploading `p.files` (unchanged — poster/slides are images), upload the video when present and include the new columns in the row:

```js
    let videoUrl = null;
    if (p.video) {
      const vid = await cloudinary.uploader.upload(join(p.dir, p.video), {
        public_id: `mythique/social/${p.batch}/${p.ord}-reel`, overwrite: true, resource_type: 'video',
      });
      videoUrl = vid.secure_url;
      process.stdout.write('▶');
    }
    rows.push({
      batch: p.batch, ord: p.ord, day: p.day, kind: p.kind, title: p.title,
      image_url: urls[0], slide_urls: urls, caption: p.caption,
      guide_where: p.where, guide_when: p.when,
      guide_music: p.music ?? suggestMusic(p.kind, p.title),
      ad_safety: p.adSafety ?? 'organic',
      media_type: p.video ? 'video' : 'image',
      video_url: videoUrl,
      angle: p.angle ?? null,
    });
```
(This replaces the existing `rows.push` — keep all existing fields; legacy batches get `media_type:'image'`, `angle:null`.)

- [ ] **Step 3: Verify** `node scripts/social/publish-posts.mjs --dry-run` lists launch + week + ad-toolkit + the ad-library entries. Then a real publish; confirm via `mcp__supabase__execute_sql`:

```sql
select media_type, count(*), count(video_url) from social_posts group by media_type;
```
Expected: `video` rows have `video_url` populated.

- [ ] **Step 4: Commit**

```bash
git add scripts/social/publish-posts.mjs
git commit -m "feat(social): publish the monthly ad-library — manifest collector + Cloudinary video upload"
```

---

### Task 9: Publish tab — video cards + angle/format filter chips

**Files:**
- Modify: `src/components/admin/health/domains/SocialDomain.tsx`

**Interfaces:**
- Consumes: `SocialPost` now including `media_type`, `video_url`, `angle` (Task 1); existing `PostRow` card, `CardGrid`, `batchLabel`; `PillGroup` from `../ui` (check its `PillOption` props in `src/components/admin/health/ui/PillGroup.tsx` and match them).
- Produces: video-aware post cards and a filter row that narrows the whole lane.

- [ ] **Step 1: Filter state + chips.** In `SocialDomain()`, add:

```tsx
type Filter = 'all' | 'matchup' | 'ranking' | 'guess' | 'fact' | 'reel' | 'carousel';
const [filter, setFilter] = useState<Filter>('all');
const matches = (p: SocialPost) =>
  filter === 'all' ? true
  : filter === 'reel' ? p.media_type === 'video'
  : filter === 'carousel' ? p.media_type !== 'video'
  : p.angle === filter;
const posts = (postsQ.data ?? []).filter(matches);
```

Render a `PillGroup` (or a simple pill row matching SubTabs styling if PillGroup's API doesn't fit) above the batches with options All · Matchup · Ranking · Guess · Fact · Reels · Carousels. Batches with zero matching posts are skipped (the existing `batches` derivation already recomputes from the filtered `posts`).

- [ ] **Step 2: Video card.** In `PostRow`, when `post.media_type === 'video' && post.video_url`:
  - The thumbnail Pressable opens `post.video_url` (not `image_url`).
  - Overlay a play badge on the thumb (`▶` in a dark rounded chip, absolutely positioned — StyleSheet, no inline objects).
  - In the actions row add an "Open reel" mini-button (`window.open(post.video_url, '_blank')`) and hide the Slides toggle (a reel has no slides).
  - The title-row badge area gains a small `REEL` chip (navy tint) so format is scannable.

- [ ] **Step 3: Verify** `yarn tsc --noEmit` clean, `yarn test:ci` green, `yarn lint` no new errors. Ask the user to check on device (they screenshot iOS Safari — do NOT start a server): filter chips narrow the library; a reel card shows the poster + play badge; "Open reel" plays the MP4.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/health/domains/SocialDomain.tsx
git commit -m "feat(command-center): Publish tab video cards + angle/format filter chips"
```

---

### Task 10: Full run + end-to-end verification

**Files:** none new (runs + fixes only; any fix commits only the files it touches).

- [ ] **Step 1:** `node scripts/social/ads/batch-month.mjs --n 30` (full render; reels take ~30–60s each — expect several minutes). Spot-check `gallery.html`: every carousel angle + every reel angle looks on-brand; no dead space; disclaimer present.
- [ ] **Step 2:** `node scripts/social/publish-posts.mjs` and verify counts in DB: `select batch, media_type, count(*) from social_posts group by 1,2 order by 1;` — the ad-library batch shows ~18 image + ~12 video rows, all `ad_safe`.
- [ ] **Step 3:** `yarn test:social && yarn test:ci && yarn tsc --noEmit` — all green.
- [ ] **Step 4:** Hand off to the user for device verification (Publish tab: filter to Reels, open one, confirm it plays and is 9:16; pick tomorrow's post).
- [ ] **Step 5:** Commit any final fixes; update the memory file for the social studio with the new `batch-month` flow.

---

## Self-review notes (already applied)

- **Spec coverage:** 4-layer safety (T2 gate + T3 chokepoint + reel shell DISCLAIMER + names-only selectors), tier filter (`--exclude-tier-s`, T3/T7), variety engine + determinism (T4), both renderers with the reel quality bar as explicit step criteria (T5/T6), 18/12 mix + month batch (T7), manifest→publish with video (T8), Publish tab video + filters (T9), tests named in T2/T3/T4.
- **Type consistency:** `PlanEntry` fields (`ord/angle/format/title/data/caption/music`) match between T4 (producer) and T5/T6/T7 (consumers); manifest schema in T7 matches T8's collector; `media_type/video_url/angle` names match T1's migration and T9's usage.
- **Judgment calls:** poster = hook-scene still; ranking reel shows 6 of 10 ranks (pace over completeness); facts are computed superlatives only (no `hero_narrative_facts` dependency — YAGNI); `sb.rest` name flagged for verification in T3.
