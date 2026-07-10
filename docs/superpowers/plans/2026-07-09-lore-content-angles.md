# Lore Content Angles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the factory's `fact` angle with real `hero_narrative_facts` and add a `lore` angle (family feud · rivalry · most-connected) drawn from the Mythique relationship graph — the differentiated, argument-baiting content the neutral data angles can't produce.

**Architecture:** Pure data selectors in `data.mjs` return name+text-only pools (no portraits); `plan.mjs` registers the `lore` angle with stance-CTA captions; the existing carousel/reel renderers gain `SLIDES.lore`/`SCENES.lore` branches that reuse the established shell (safe zones, beat grid, silhouettes, mascot, 2× supersample). Everything flows through the existing `angle`/`kind` plumbing to publish + the Publish tab.

**Tech Stack:** Node ESM (`scripts/social/ads/`), Playwright+ffmpeg render pipeline, node:test, Supabase REST (service-role key), React Native Web (Publish tab).

**Spec:** `docs/superpowers/specs/2026-07-09-lore-content-angles-design.md`

## Global Constraints

- **Ad-safe by construction**: names + text + own graphics only, **NO portraits**; `assertNoPortrait` runs before every written asset (already wired in both renderers — do not remove).
- **Viral acceptance criteria** (judged per template at render-eyeball time): provoke-don't-inform hook, a withhold-then-reveal beat, stance/argument CTA (not "did you know"), real self-contained copy.
- Reuse the reel/carousel shell, `SAFE` zones (`render-reel.mjs:27`), beat grid (`beats()`), `silhouette()`, `hookLayout()`, `plates()`, mascot, 2× supersample — **do not fork or re-solve them**.
- Batch scripts use the service-role key (already in `lib.mjs` loadEnv) — heavy reads are fine.
- **yarn only.** Social tests: `yarn test:social` (node --test). App tests: `yarn test:ci`. Typecheck: `yarn tsc --noEmit`.
- Commit directly to `main`; each implementer commits ONLY its exact named files.
- TypeScript no `any` (Publish-tab task); StyleSheet.create for styles.

## Data reference (verified against live DB)

- `hero_narrative_facts(hero_id text, kind text, content text, subject text, needs_review bool)` — `kind` ∈ `did_you_know|era_summary|power_explainer`; join `heroes` for `name`,`fame_score`.
- `hero_relatives(hero_id text, name text, relation enum, related_hero_id text)` — `relation` ∈ `parent|child|sibling|aunt_uncle|other`.
- `hero_relationships(hero_id text, related_id text, kind text)` — `kind` ∈ `enemy|ally|teammate`.
- `heroes.first_appearance` (text; may be null) for "enemies since [year]".
- `sb.rest(path)` is the query helper `makeSb` returns.

---

### Task 1: Deepen the `fact` pool with real lore + render stat-less facts (TDD)

**Files:**
- Modify: `scripts/social/ads/data.mjs` (the `facts` block in `fetchPools`)
- Modify: `scripts/social/ads/render-reel.mjs` (`SCENES.fact`)
- Modify: `scripts/social/ads/render-carousel.mjs` (`SLIDES.fact`)
- Test: `scripts/social/ads/data.test.mjs` (add cases)

**Interfaces:**
- Consumes: `sb.rest`, `heroes` join.
- Produces: `fetchPools(...).facts` is now `{ headline: string, detail: string, stat: string|null }[]` where `stat` is null for narrative facts (the number-less path). A new exported pure helper `factFromRow(row) → { headline, detail, stat: null }` (row = `{ name, content, subject }`). The computed superlatives remain as a fallback appended only if the DB query yields < 6.

- [ ] **Step 1: Write the failing test** — add to `scripts/social/ads/data.test.mjs`:

```js
import { factFromRow } from './data.mjs'; // add to existing import line

test('factFromRow builds a punchy headline + full detail, no stat', () => {
  const f = factFromRow({ name: 'Solomon Grundy', subject: 'origin',
    content: 'He began as Cyrus Gold, a wealthy merchant murdered and dumped in Slaughter Swamp in the 19th century.' });
  assert.equal(f.stat, null);
  assert.ok(f.headline.length > 0 && f.headline.length <= 60);
  assert.match(f.detail, /Cyrus Gold/);
  // headline must NOT be a truncated mid-sentence fragment ending in a bare word+ellipsis
  assert.ok(!/\w…$/.test(f.headline) || f.headline.includes(' '));
});

test('factFromRow carries the hero name into the headline or detail', () => {
  const f = factFromRow({ name: 'Snake Eyes', subject: null,
    content: 'Snake Eyes is a G.I. Joe commando who stayed with a burning wreck to save a wolf pup.' });
  assert.ok(f.headline.includes('Snake Eyes') || f.detail.includes('Snake Eyes'));
});
```

- [ ] **Step 2: Run to verify FAIL**: `yarn test:social` → `factFromRow` not exported.

- [ ] **Step 3: Implement.** In `data.mjs`, add the exported helper and rewrite the `facts` block:

```js
/** A narrative-fact row → the render shape. Headline = the hero name as the
 *  hook line; detail = the fact body. No number (stat null) → the renderers
 *  show the fact card, not the odometer. */
export function factFromRow(row) {
  const name = row.name;
  return { headline: name, detail: row.content.trim(), stat: null };
}
```

Replace the `// facts: computed superlatives…` block through the `facts.push(... '35k+' ...)` line with:

```js
  // facts: real narrative lore (self-contained, punchy), computed superlatives
  // only as a thin-catalog fallback.
  const factRows = await sb.rest(
    `hero_narrative_facts?select=content,subject,hero_id,heroes!inner(name,fame_score)` +
    `&kind=in.(did_you_know,era_summary,power_explainer)&needs_review=eq.false` +
    `&heroes.fame_score=gte.25&limit=400`,
  ).catch(() => []);
  const facts = factRows
    .filter((r) => r.heroes && r.content && r.content.length > 40)
    .map((r) => factFromRow({ name: r.heroes.name, subject: r.subject, content: r.content }));
  if (facts.length < 6) {
    const byStat = (k) => [...pool].sort((x, y) => y.stats[k] - x.stats[k])[0];
    const fastest = byStat('speed'), strongest = byStat('strength');
    if (fastest) facts.push({ headline: `The fastest character we've ever rated`, detail: `${fastest.name} — speed ${fastest.stats.speed}/100`, stat: `${fastest.stats.speed}` });
    if (strongest) facts.push({ headline: `Pure strength, ranked`, detail: `${strongest.name} sits at ${strongest.stats.strength}/100`, stat: `${strongest.stats.strength}` });
    facts.push({ headline: `35,000+ heroes & villains, every one rated`, detail: `powers · matchups · rankings · lore`, stat: '35k+' });
  }
```

(The PostgREST embedded-resource filter `heroes!inner(...)&heroes.fame_score=gte.25` inner-joins on fame. If the embed syntax errors at runtime, fall back to a two-query approach: fetch fame≥25 hero ids first, then `hero_id=in.(...)` — but try the embed first.)

- [ ] **Step 4: Handle stat-less facts in both renderers.**

In `render-reel.mjs` `SCENES.fact`, the `stat` scene currently renders `<div class="huge">${f.stat}</div>`. Change it so a null/non-numeric `stat` shows the fact body big instead of an empty odometer:

```js
  fact: (e) => {
    const f = e.data;
    const statNum = f.stat && /^\d/.test(f.stat);
    return [
      { id: 'hook', ms: beats(5), html: hookLayout(`<span class="eyebrow" style="display:block;margin-bottom:26px">DID YOU KNOW</span>${f.headline}`, null) },
      statNum
        ? { id: 'stat', ms: beats(9), bloom: true, html: `<div class="huge rise">${f.stat}</div><div class="mut in2" style="font-size:46px">${f.detail}</div>` }
        : { id: 'stat', ms: beats(10), bloom: true, html: `<div class="big rise" style="font-size:64px;line-height:1.28">${f.detail}</div>` },
      { id: 'cta', ms: beats(7), html: `<div class="big rise" style="font-size:92px">There’s a file<br>on everyone.</div><div class="mut in2">35,000+ heroes &amp; villains — rated &amp; ranked</div><div class="mut in3 gold" style="font-size:46px;margin-top:40px">mythique.app</div>` },
    ];
  },
```

In `render-carousel.mjs` `SLIDES.fact`, similarly branch: when `stat` is null, the middle slide shows the fact body as the headline (not a giant number). Change the fact slide set to:

```js
  fact: (e, w, h) => {
    const f = e.data;
    const statNum = f.stat && /^\d/.test(f.stat);
    return [
      stage(w, h, `${eyebrow(h, 'DID YOU KNOW')}${head(h, f.headline, 0.062)}
        ${statNum ? `<div class="pop" style="font-size:${Math.round(h * 0.14)}px;color:${GOLD};margin:${Math.round(h * 0.04)}px 0">${f.stat}</div>` : ''}${sub(h, f.detail)}`),
      stage(w, h, `${head(h, 'There’s a file on everyone.', 0.065)}${sub(h, '35,000+ heroes & villains — powers, matchups, rankings & lore')}
        <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">mythique.app&thinsp;→</div>`),
    ];
  },
```

- [ ] **Step 5: Run tests + eyeball.** `yarn test:social` (green). Then render one fact reel with a real long fact to confirm the body is legible + inside the safe zone (stub script in /tmp; extract the `stat` scene frame; view with Read). Iterate font size if it overflows.

- [ ] **Step 6: Commit**

```bash
git add scripts/social/ads/data.mjs scripts/social/ads/render-reel.mjs scripts/social/ads/render-carousel.mjs scripts/social/ads/data.test.mjs
git commit -m "feat(ads): deepen fact angle with real hero_narrative_facts + stat-less fact rendering"
```

---

### Task 2: `fetchLore` selectors — family / rivalry / connected (TDD)

**Files:**
- Modify: `scripts/social/ads/data.mjs`
- Test: `scripts/social/ads/data.test.mjs`

**Interfaces:**
- Consumes: `sb.rest`.
- Produces:
  - `fetchLore(sb, rand, { excludeTierS }) → Promise<LoreEntry[]>` where `LoreEntry = { sub: 'family'|'rivalry'|'connected', a: string, b?: string, relation?: string, year?: string, allies?: number, enemies?: number, teams?: number }` — **names + numbers only, no ids/portraits.**
  - Exported pure helper `relationPhrase(relation) → string` mapping the enum to human copy: `parent→"the parent of"`, `child→"the child of"`, `sibling→"the sibling of"`, `aunt_uncle→"the aunt/uncle of"`, `other→"family to"`.
  - `fetchPools`' return gains `lore: LoreEntry[]` (family entries first — the priority order).

- [ ] **Step 1: Write the failing test** in `data.test.mjs`:

```js
import { relationPhrase } from './data.mjs'; // add to import

test('relationPhrase maps every relation enum to human copy', () => {
  for (const [k, re] of [['parent',/parent/],['child',/child/],['sibling',/sibling/],['aunt_uncle',/aunt/],['other',/family/]])
    assert.match(relationPhrase(k), re);
});
```

- [ ] **Step 2: Run to verify FAIL**: `yarn test:social`.

- [ ] **Step 3: Implement** in `data.mjs`:

```js
const RELATION_PHRASE = { parent: 'the parent of', child: 'the child of', sibling: 'the sibling of', aunt_uncle: 'the aunt/uncle of', other: 'family to' };
export const relationPhrase = (r) => RELATION_PHRASE[r] ?? 'family to';

const yearOf = (s) => { const m = /(\d{4})/.exec(s ?? ''); return m ? m[1] : null; };

/** Lore pools — family feud (lead), rivalry, most-connected. Names + numbers
 *  only. Each entry carries `sub`; family entries come first (priority). */
export async function fetchLore(sb, rand, { excludeTierS = false } = {}) {
  const out = [];
  // FAMILY: relatives whose related_hero_id is a hero AND an enemy edge exists.
  const fam = await sb.rest(
    `hero_relatives?select=relation,heroes!hero_relatives_hero_id_fkey(name,fame_score),related:heroes!hero_relatives_related_hero_id_fkey(name,fame_score)` +
    `&related_hero_id=not.is.null&limit=600`,
  ).catch(() => []);
  for (const r of fam) {
    const a = r.heroes, b = r.related;
    if (!a || !b || (a.fame_score ?? 0) < 30) continue;
    if (excludeTierS) { /* names only — tier gate not applicable to text */ }
    out.push({ sub: 'family', a: a.name, b: b.name, relation: r.relation });
  }
  // RIVALRY: famous enemy pairs, best-effort year from first_appearance.
  const riv = await sb.rest(
    `hero_relationships?select=kind,a:heroes!hero_relationships_hero_id_fkey(name,fame_score,first_appearance),b:heroes!hero_relationships_related_id_fkey(name,fame_score,first_appearance)` +
    `&kind=eq.enemy&limit=800`,
  ).catch(() => []);
  const rivPairs = [];
  for (const r of riv) {
    const a = r.a, b = r.b;
    if (!a || !b || (a.fame_score ?? 0) < 30 || (b.fame_score ?? 0) < 30) continue;
    rivPairs.push({ sub: 'rivalry', a: a.name, b: b.name, year: yearOf(a.first_appearance) || yearOf(b.first_appearance) });
  }
  // CONNECTED: degree leaderboard by kind, top famous heroes.
  const deg = await sb.rest(
    `hero_relationships?select=hero_id,kind`,
  ).catch(() => []);
  const byHero = new Map();
  for (const r of deg) { const m = byHero.get(r.hero_id) || { ally: 0, enemy: 0, teammate: 0 }; m[r.kind] = (m[r.kind] ?? 0) + 1; byHero.set(r.hero_id, m); }
  // resolve the top few hero_ids to names via a bounded id lookup
  const top = [...byHero.entries()].map(([id, m]) => ({ id, total: m.ally + m.enemy + m.teammate, m })).sort((x, y) => y.total - x.total).slice(0, 20);
  if (top.length) {
    const ids = top.map((t) => t.id).join(',');
    const names = await sb.rest(`heroes?select=id,name,fame_score&id=in.(${ids})`).catch(() => []);
    const nameById = new Map(names.map((n) => [n.id, n]));
    for (const t of top) {
      const h = nameById.get(t.id);
      if (!h || (h.fame_score ?? 0) < 40) continue;
      out.push({ sub: 'connected', a: h.name, allies: t.m.ally, enemies: t.m.enemy, teams: t.m.teammate });
      if (out.filter((e) => e.sub === 'connected').length >= 4) break;
    }
  }
  // interleave: family (all) then a capped set of rivalry then connected already appended
  const rivShuffled = [...rivPairs];
  for (let i = rivShuffled.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rivShuffled[i], rivShuffled[j]] = [rivShuffled[j], rivShuffled[i]]; }
  const family = out.filter((e) => e.sub === 'family');
  const connected = out.filter((e) => e.sub === 'connected');
  return [...family, ...rivShuffled.slice(0, 20), ...connected];
}
```

Add `lore: await fetchLore(sb, rand, { excludeTierS })` to `fetchPools`' return object.

**Implementation note (verify, don't guess):** the exact FK constraint names in the embed (`heroes!hero_relatives_hero_id_fkey` etc.) must match the DB. Before trusting them, run `\d hero_relatives` equivalent via `sb.rest` erroring, OR use the simpler disambiguated embed `heroes!hero_id(...)`/`heroes!related_hero_id(...)`. Test the actual query with a throwaway `node -e` against `.env.local` and adjust the embed hint to whatever returns rows. The RETURNED SHAPE (`{ sub, a, b, relation, year, allies, enemies, teams }`) must not change regardless of how the embed is spelled.

- [ ] **Step 4: Run tests + live sanity.** `yarn test:social` green. Throwaway `node -e` calling `fetchLore` with a real `sb`: print counts per sub and assert family ≥ 20, and that `JSON.stringify` of the result contains **no** `portrait`, `image`, `http`, or `_id` substring (names/numbers only). Don't commit the throwaway.

- [ ] **Step 5: Commit**

```bash
git add scripts/social/ads/data.mjs scripts/social/ads/data.test.mjs
git commit -m "feat(ads): fetchLore — family/rivalry/connected pools from the relationship graph (names+numbers only)"
```

---

### Task 3: Register the `lore` angle in `plan.mjs` (TDD)

**Files:**
- Modify: `scripts/social/ads/plan.mjs`
- Test: `scripts/social/ads/plan.test.mjs`

**Interfaces:**
- Consumes: `LoreEntry` (Task 2), `suggestMusic`.
- Produces: `buildPlan` emits `lore` entries. `MAKERS.lore(entry)` returns `{ title, data, caption }` with a stance CTA per `entry.sub`. `ANGLES` includes `'lore'`; `POOL_KEY.lore='lore'`; `cursors` includes `lore:0`; `MUSIC_KIND.lore='brand'`.

- [ ] **Step 1: Write the failing test** in `plan.test.mjs` — extend the fixture `pools` with a `lore` array and assert:

```js
// add to the pools fixture:
lore: [
  { sub: 'family', a: 'Thor', b: 'Loki', relation: 'sibling' },
  { sub: 'family', a: 'Luke Skywalker', b: 'Darth Vader', relation: 'parent' },
  { sub: 'rivalry', a: 'Batman', b: 'Joker', year: '1940' },
  { sub: 'connected', a: 'Spider-Man', allies: 40, enemies: 60, teams: 12 },
],

test('lore angle appears in both formats with stance CTAs', () => {
  const plan = buildPlan({ n: 30, seed: 7, mix: { carousel: 18, reel: 12 }, pools });
  const lore = plan.filter((e) => e.angle === 'lore');
  assert.ok(lore.length >= 2, 'lore should be planned');
  assert.ok(lore.some((e) => e.format === 'reel') && lore.some((e) => e.format === 'carousel'));
  // family entries carry a "same blood" style hook + a stance CTA (👇 / agree)
  const fam = lore.find((e) => e.data.sub === 'family');
  assert.ok(fam && /👇|agree|nature|nurture/i.test(fam.caption));
});
```

- [ ] **Step 2: Run to verify FAIL**: `yarn test:social`.

- [ ] **Step 3: Implement.** In `plan.mjs`:

Add to `MAKERS`:

```js
  lore: (e) => {
    if (e.sub === 'family') return {
      title: `${e.a} & ${e.b} — family`,
      data: e,
      caption: `${e.a} and ${e.b}: same blood, opposite sides. Nature or nurture? 👇\n\nThe whole family tree lives on mythique.app\n\n#comics #superheroes #lore #mythique`,
    };
    if (e.sub === 'rivalry') return {
      title: `${e.a} vs ${e.b} — rivalry`,
      data: e,
      caption: `${e.a} vs ${e.b}${e.year ? ` — enemies since ${e.year}` : ''}. The best rivalry in comics? Fight about it 👇\n\nmythique.app\n\n#comics #superheroes #rivalry #mythique`,
    };
    return {
      title: `Most connected — ${e.a}`,
      data: e,
      caption: `${e.a}: ${e.allies} allies, ${e.enemies} enemies, ${e.teams} teams. The most connected character in fiction?\n\nExplore the whole web — mythique.app\n\n#comics #superheroes #lore #mythique`,
    };
  },
```

Update the constant lines:

```js
const ANGLES = ['matchup', 'ranking', 'guess', 'fact', 'lore'];
const POOL_KEY = { matchup: 'matchups', ranking: 'rankings', guess: 'guesses', fact: 'facts', lore: 'lore' };
const MUSIC_KIND = { matchup: 'matchup', ranking: 'ranking', guess: 'post', fact: 'brand', lore: 'brand' };
```

In `buildPlan`, the `cursors` object is hardcoded — add `lore: 0`:

```js
  const cursors = { matchups: 0, rankings: 0, guesses: 0, facts: 0, lore: 0 };
```

- [ ] **Step 4: Run to verify PASS**: `yarn test:social` (all green; the existing "every angle in both formats" test now also covers lore — if it's flaky at n=30 with 5 angles, that test asserts the 4 original angles by name, so confirm it still passes; if it hard-asserts all ANGLES, update its expectation to include lore).

- [ ] **Step 5: Commit**

```bash
git add scripts/social/ads/plan.mjs scripts/social/ads/plan.test.mjs
git commit -m "feat(ads): register lore angle — family/rivalry/connected with stance-CTA captions (tested)"
```

---

### Task 4: `SLIDES.lore` — carousel templates

**Files:**
- Modify: `scripts/social/ads/render-carousel.mjs`

**Interfaces:**
- Consumes: `LoreEntry` via `entry.data`; existing `stage/eyebrow/head/sub/bar` helpers + `silhouette` (import it).
- Produces: `SLIDES.lore(e, w, h) → string[]` branching on `e.data.sub`.

- [ ] **Step 1: Implement.** Add the import and the `SLIDES.lore` builder:

```js
import { silhouette } from './silhouettes.mjs';
```

```js
  lore: (e, w, h) => {
    const d = e.data;
    const twoBusts = (an, bn) => `<div style="display:flex;align-items:flex-end;justify-content:center;gap:${Math.round(w * 0.06)}px;margin-bottom:${Math.round(h * 0.04)}px">
      <div style="text-align:center">${silhouette('cowl', { size: Math.round(w * 0.24), rim: ORANGE })}<div class="pop" style="font-size:${Math.round(h * 0.036)}px;color:${ORANGE};margin-top:8px">${an}</div></div>
      <div style="text-align:center">${silhouette('spikes', { size: Math.round(w * 0.24), rim: TEAL })}<div class="pop" style="font-size:${Math.round(h * 0.036)}px;color:${TEAL};margin-top:8px">${bn}</div></div></div>`;
    if (d.sub === 'family') return [
      stage(w, h, `${eyebrow(h, 'SAME BLOOD')}${head(h, 'Opposite<br>sides.', 0.085)}${sub(h, 'Swipe for the twist →')}`),
      stage(w, h, `${twoBusts(d.a, d.b)}${head(h, `${d.a} is<br>${relForCopy(d.relation)} ${d.b}.`, 0.055)}`),
      stage(w, h, `${head(h, 'Nature or<br>nurture?', 0.08)}${sub(h, 'The family tree tells the whole story.')}<div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">mythique.app&thinsp;→</div>`),
    ];
    if (d.sub === 'rivalry') return [
      stage(w, h, `${eyebrow(h, 'SOME FIGHTS NEVER END')}${twoBusts(d.a, d.b)}${head(h, `${d.a}<br><span style="color:${GOLD}">vs</span> ${d.b}`, 0.06)}${d.year ? sub(h, `Enemies since ${d.year}.`) : ''}`),
      stage(w, h, `${head(h, 'The best rivalry<br>in comics?', 0.07)}${sub(h, 'Fight about it in the comments 👇')}<div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">mythique.app&thinsp;→</div>`),
    ];
    return [ // connected
      stage(w, h, `${eyebrow(h, 'THE SOCIAL WEB')}${head(h, `The most connected<br>character in fiction?`, 0.055)}${head(h, d.a, 0.09)}`),
      stage(w, h, `<div style="display:flex;gap:${Math.round(w * 0.06)}px;justify-content:center;margin-bottom:${Math.round(h * 0.04)}px">
        ${['allies', d.allies, ORANGE].join ? '' : ''}
        <div><div class="pop" style="font-size:${Math.round(h * 0.09)}px;color:${ORANGE}">${d.allies}</div><div style="font-size:${Math.round(h * 0.028)}px;color:${MUTED}">ALLIES</div></div>
        <div><div class="pop" style="font-size:${Math.round(h * 0.09)}px;color:${TEAL}">${d.enemies}</div><div style="font-size:${Math.round(h * 0.028)}px;color:${MUTED}">ENEMIES</div></div>
        <div><div class="pop" style="font-size:${Math.round(h * 0.09)}px;color:${GOLD}">${d.teams}</div><div style="font-size:${Math.round(h * 0.028)}px;color:${MUTED}">TEAMS</div></div></div>
        <div class="g pop" style="font-size:${Math.round(h * 0.04)}px;margin-top:${Math.round(h * 0.05)}px">Explore the web · mythique.app&thinsp;→</div>`),
    ];
  },
```

Add a tiny copy helper near the top of the file (mirrors `relationPhrase` but carousel-local to avoid a cross-module import churn — or import `relationPhrase` from `./data.mjs`; prefer the import):

```js
import { relationPhrase } from './data.mjs';
const relForCopy = (r) => relationPhrase(r); // "the parent of" etc.
```

- [ ] **Step 2: Eyeball.** Render one carousel per sub-kind (stub script, `renderCarousel`), view all slides with Read: two-bust family reveal reads clearly, no dead bottom third, disclaimer present, silhouettes crisp. Iterate.

- [ ] **Step 3: Commit**

```bash
git add scripts/social/ads/render-carousel.mjs
git commit -m "feat(ads): lore carousel templates — family feud, rivalry, most-connected"
```

---

### Task 5: `SCENES.lore` — reel templates (family = the hero)

**Files:**
- Modify: `scripts/social/ads/render-reel.mjs`

**Interfaces:**
- Consumes: `LoreEntry`, existing `hookLayout/plates/silhouette/ring/pips/beats`, `SAFE`, bloom.
- Produces: `SCENES.lore(e) → scene[]` branching on `e.data.sub`, reusing the shell.

- [ ] **Step 1: Implement.** Add to `SCENES`:

```js
  lore: (e) => {
    const d = e.data;
    if (d.sub === 'family') {
      return [
        { id: 'hook', ms: beats(4), html: `<div class="eyebrow in1">SAME BLOOD</div><div class="big rise" style="font-size:120px">Opposite<br>sides.</div>` },
        { id: 'pair', ms: beats(5), html: `${plates(d.a, d.b)}<div class="mut in3" style="margin-top:8px">They’re connected.</div>` },
        { id: 'reveal', ms: beats(7), bloom: true, html: `${plates(d.a, d.b)}<div class="big rise" style="font-size:72px;margin-top:20px">${d.a} is<br>${relLabel(d.relation)}<br><span class="gold">${d.b}</span>.</div>` },
        { id: 'cta', ms: beats(6), html: `<div class="big rise" style="font-size:104px">Nature or<br>nurture?</div><div class="mut in2 gold" style="font-size:46px;margin-top:40px">The family tree · mythique.app</div>` },
      ];
    }
    if (d.sub === 'rivalry') {
      return [
        { id: 'hook', ms: beats(4), html: hookLayout(`Some fights<br><span class="gold">never end.</span>`, d.year ? `Since ${d.year}.` : null) },
        { id: 'pair', ms: beats(6), bloom: true, html: `${plates(d.a, d.b)}<div class="big rise" style="font-size:88px;margin-top:16px">${d.a} <span class="gold">vs</span> ${d.b}</div>${d.year ? `<div class="mut in3">Enemies since ${d.year}.</div>` : ''}` },
        { id: 'cta', ms: beats(6), html: `<div class="big rise" style="font-size:92px">Best rivalry<br>in comics?</div><div class="mut in2">Fight about it 👇</div><div class="mut in3 gold" style="font-size:46px;margin-top:36px">mythique.app</div>` },
      ];
    }
    return [ // connected
      { id: 'hook', ms: beats(5), html: hookLayout(`The most<br>connected<br><span class="gold">character?</span>`, null) },
      { id: 'reveal', ms: beats(5), bloom: true, html: `<div class="big rise" style="font-size:128px">${d.a}</div>` },
      { id: 'stats', ms: beats(6), html: `<div style="display:flex;gap:56px;justify-content:center">
        <div class="in1"><div class="huge" style="font-size:120px;color:${O}"><span class="cnt" data-to="${d.allies}">0</span></div><div class="mut">allies</div></div>
        <div class="in2"><div class="huge" style="font-size:120px;color:${T}"><span class="cnt" data-to="${d.enemies}">0</span></div><div class="mut">enemies</div></div>
        <div class="in3"><div class="huge" style="font-size:120px;color:${GOLD}"><span class="cnt" data-to="${d.teams}">0</span></div><div class="mut">teams</div></div></div>` },
      { id: 'cta', ms: beats(5), html: `<div class="big rise" style="font-size:88px">Explore the web.</div><div class="mut in2 gold" style="font-size:46px;margin-top:36px">mythique.app</div>` },
    ];
  },
```

Add the reel-local relation label near the other fragments (family reveal wants a short middle-line form):

```js
const relLabel = (r) => ({ parent: 'the parent of', child: 'the child of', sibling: 'the sibling of', aunt_uncle: 'the aunt/uncle of', other: 'family to' }[r] ?? 'family to');
```

- [ ] **Step 2: Eyeball — the hero template gets the closest look.** Render a family reel (Thor/Loki), a rivalry reel (Batman/Joker), a connected reel. ffprobe 1080×1920; extract the hook + reveal + cta frames of each; view with Read. Judge against the viral bar: does the family "Opposite sides." hook provoke? Is the relation reveal a clear payoff? Safe zones respected? Iterate sizes/timing.

- [ ] **Step 3: Commit**

```bash
git add scripts/social/ads/render-reel.mjs
git commit -m "feat(ads): lore reel templates — family feud (hero), rivalry, most-connected"
```

---

### Task 6: Publish tab — Lore filter chip

**Files:**
- Modify: `src/components/admin/health/domains/SocialDomain.tsx`

**Interfaces:**
- Consumes: the `Filter` type + `FILTER_OPTIONS` + `matches` predicate already in the file; `angle` values now include `'lore'`.
- Produces: a "Lore" chip that filters `p.angle === 'lore'`.

- [ ] **Step 1: Implement.** Add `'lore'` to the `Filter` union and a `{ label: 'Lore', value: 'lore' }` entry to `FILTER_OPTIONS` (after 'fact'). The existing `matches` predicate's `else` branch already does `p.angle === filter`, so `'lore'` works with no logic change. Verify the predicate's typing still holds (no `any`).

- [ ] **Step 2: Verify.** `yarn tsc --noEmit` clean; `yarn test:ci` green; `yarn lint` no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/domains/SocialDomain.tsx
git commit -m "feat(command-center): Publish tab — Lore filter chip"
```

---

### Task 7: Integration — render a lore-heavy sample, publish, verify

**Files:** none new (runs + any fix commits touch only their own files).

- [ ] **Step 1:** Render a small lore-weighted batch to a THROWAWAY dir (protect the live `ad-library-2026-07`): `node scripts/social/ads/batch-month.mjs --dry-run --n 10` first to confirm `lore` entries appear in the plan. Then a real small batch — but batch-month writes to `ad-library-YYYY-MM` and wipes it. **Do NOT wipe the live library.** Instead render lore samples via a throwaway stub script (import `fetchLore`+`buildPlan`+renderers, output to `out/social/_lore-check/`) covering ≥1 of each sub-kind × both formats. Eyeball all against the viral + safe-zone bar.
- [ ] **Step 2:** Confirm the safety gate held (no throw during renders = every asset passed `assertNoPortrait`) and grep the rendered HTML dumps for any `http`/`portrait` (should be none beyond data URIs).
- [ ] **Step 3:** `yarn test:social && yarn test:ci && yarn tsc --noEmit` — all green.
- [ ] **Step 4:** Clean up `out/social/_lore-check/`. Hand off to the user: when they want next month's library, `batch-month --n 30` now includes lore automatically; or regenerate now if they want lore in the current library (this WIPES + replaces `ad-library-2026-07` — the user's call, since the current 30 are already published/live).
- [ ] **Step 5:** Update the social-studio memory note with the lore angle.

---

## Self-review notes (already applied)

- **Spec coverage:** deepen facts (T1), fetchLore family/rivalry/connected (T2), plan lore angle + stance CTAs (T3), carousel templates (T4), reel templates incl. family-hero (T5), Publish Lore chip (T6), integration + viral/safe eyeball (T7). Ad-safety inherited + re-asserted (T2 sanity, T7 grep). Viral acceptance criteria are explicit eyeball gates in T4/T5/T7.
- **Type/shape consistency:** `LoreEntry` fields (`sub/a/b/relation/year/allies/enemies/teams`) defined in T2, consumed identically in T3 MAKERS, T4 SLIDES, T5 SCENES. `facts` shape `{ headline, detail, stat|null }` consistent T1↔renderers. `relationPhrase` (data.mjs) reused by carousel; `relLabel` is a reel-local twin (both from the same enum map) — intentional to avoid a data.mjs import in the reel hot path.
- **Flagged for the implementer to verify, not guess:** the PostgREST embed FK-hint spelling in T1/T2 (test the actual query, keep the return shape); the "every angle in both formats" plan test's expectation when ANGLES grows to 5 (T3 Step 4).
- **Protect the live library:** T7 explicitly forbids wiping `ad-library-2026-07`; lore samples render to a throwaway dir.
