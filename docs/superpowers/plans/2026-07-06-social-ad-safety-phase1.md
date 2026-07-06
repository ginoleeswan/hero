# Social Ad Safety — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the safety decision layer (`safety.mjs`) and a catalogue risk-audit script (`audit-safety.mjs`) so paid ad creative can be built against a conservative, single-source-of-truth risk model — and so we can quantify current exposure before building any ad generators.

**Architecture:** A pure decision core assigns each hero a risk tier (`S/A/B/C`) from its `publisher` (with per-character overrides), and derives what that hero may depict in a paid ad. A thin selection helper filters the existing famous pool by tier. An audit script paginates the whole catalogue and renders a risk report. No visual/rendering changes ship in Phase 1; `safePortrait` and the ad generators are Phase 2.

**Tech Stack:** Node ESM (`.mjs`), the built-in `node:test` runner + `node:assert/strict`, the existing `scripts/social/lib.mjs` data layer (public Supabase anon key over PostgREST). Zero new dependencies.

## Global Constraints

- **Node ESM only** — all files are `.mjs`, import with `import`, no CommonJS.
- **Zero new dependencies** — use `node:test`, `node:assert/strict`, and existing `lib.mjs` exports only.
- **Public anon key only** — all DB access goes through `lib.mjs`'s `makeSb`/`loadEnv` (the same read path the app uses). No service key.
- **PostgREST 1000-row cap** — any full-table read MUST paginate with `limit`/`offset` (the `heroes` table has ~34,000 rows).
- **Conservative defaults (safe-by-construction):** unknown / missing / unlisted publisher → **Tier A**, never C. This is a hard invariant with its own test.
- **Disclaimer copy (verbatim):** `Unofficial fan encyclopedia. Characters © their respective owners.`
- **Tier risk order (most → least restricted):** `S > A > B > C`.
- **Tests run with:** `node --test scripts/social/<file>.test.mjs` (added as `yarn test:social`).

---

### Task 1: Decision core — tiers, `tierOf`, `adImagery`, `tierAllowed`, `DISCLAIMER`

**Files:**
- Create: `scripts/social/safety.mjs`
- Create: `scripts/social/safety.test.mjs`
- Modify: `package.json` (add `test:social` script)

**Interfaces:**
- Produces:
  - `PUBLISHER_TIER: Record<string,'S'|'A'|'B'|'C'>`
  - `OVERRIDES: Record<string,'S'|'A'|'B'|'C'>` (hero id → tier)
  - `DEFAULT_TIER = 'A'`
  - `TIER_RISK: Record<'S'|'A'|'B'|'C', number>`
  - `tierOf(hero: {id?, publisher?}) => 'S'|'A'|'B'|'C'`
  - `adImagery(hero) => 'none'|'stylized'|'small-raw'|'full'`
  - `tierAllowed(tier, maxTier) => boolean`
  - `DISCLAIMER: string`

- [ ] **Step 1: Write the failing test**

Create `scripts/social/safety.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierOf, adImagery, tierAllowed, DISCLAIMER } from './safety.mjs';

test('tierOf: per-character override wins over publisher', () => {
  assert.equal(tierOf({ id: 'ov1', publisher: 'Marvel' }), 'C'); // ov1 overridden to C below
});

test('tierOf: known publishers map to their tier', () => {
  assert.equal(tierOf({ publisher: 'Marvel' }), 'S');
  assert.equal(tierOf({ publisher: 'Pokémon' }), 'S');
  assert.equal(tierOf({ publisher: 'DC Comics' }), 'A');
  assert.equal(tierOf({ publisher: 'Company-Licensed' }), 'B');
  assert.equal(tierOf({ publisher: 'In the Public Domain' }), 'C');
});

test('tierOf: unknown / missing publisher defaults to A (conservative)', () => {
  assert.equal(tierOf({ publisher: 'Totally New Publisher' }), 'A');
  assert.equal(tierOf({ publisher: null }), 'A');
  assert.equal(tierOf({}), 'A');
  assert.equal(tierOf(null), 'A');
});

test('adImagery: tier maps to allowed depiction', () => {
  assert.equal(adImagery({ publisher: 'Marvel' }), 'none');
  assert.equal(adImagery({ publisher: 'DC Comics' }), 'stylized');
  assert.equal(adImagery({ publisher: 'Company-Licensed' }), 'small-raw');
  assert.equal(adImagery({ publisher: 'In the Public Domain' }), 'full');
});

test('tierAllowed: maxTier admits its tier and every less-risky one', () => {
  assert.equal(tierAllowed('C', 'C'), true);
  assert.equal(tierAllowed('B', 'C'), false);
  assert.equal(tierAllowed('B', 'B'), true);
  assert.equal(tierAllowed('C', 'B'), true);
  assert.equal(tierAllowed('A', 'B'), false);
  assert.equal(tierAllowed('S', 'A'), false);
  assert.equal(tierAllowed('A', 'S'), true);
});

test('DISCLAIMER is the exact approved copy', () => {
  assert.equal(DISCLAIMER, 'Unofficial fan encyclopedia. Characters © their respective owners.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/social/safety.test.mjs`
Expected: FAIL — cannot resolve module `./safety.mjs` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `scripts/social/safety.mjs`:

```js
// Single source of truth for social-content IP risk. A hero's TIER (S/A/B/C)
// governs what it may depict in a PAID AD. Organic posting is never restricted.
// Design: docs/superpowers/specs/2026-07-06-social-ad-safety-split-design.md

// Risk order, most → least restricted. Higher number = riskier to depict.
export const TIER_RISK = { S: 3, A: 2, B: 1, C: 0 };

// Publisher → tier. Refined over time via audit-safety.mjs's untiered report.
export const PUBLISHER_TIER = {
  // S — do not depict in ads (majors + fiercely-policed licensed brands)
  Marvel: 'S', Disney: 'S', 'Star Wars': 'S', Pokémon: 'S', Nintendo: 'S',
  Shueisha: 'S', Kodansha: 'S', 'The Muppets': 'S', 'Sesame Street': 'S',
  'Looney Tunes': 'S', 'Hanna-Barbera': 'S', Bongo: 'S', 'Star Trek': 'S',
  'The Terminator': 'S', Conan: 'S', 'Teenage Mutant Ninja Turtles': 'S',
  Hasbro: 'S', Mattel: 'S',
  // A — stylized only (DC + other US comics + major game studios)
  'DC Comics': 'A', Image: 'A', 'Archie Comics': 'A', 'Top Cow Productions': 'A',
  Rebellion: 'A', 'Harvey Comics': 'A', Hellboy: 'A', Capcom: 'A',
  'Square Enix': 'A', Sega: 'A', 'NetherRealm Studios': 'A', Konami: 'A',
  'CD Projekt Red': 'A', 'PlayStation Studios': 'A', 'Xbox Game Studios': 'A',
  Atlus: 'A', Dupuis: 'A', 'NBC Studios': 'A', 'The Boys': 'A',
  // B — restrained
  'Company-Licensed': 'B',
  // C — safe to depict full-fidelity
  'In the Public Domain': 'C', 'Non-Fictional': 'C',
};

// Per-character exceptions by hero id. Populated as exceptions are found.
export const OVERRIDES = {
  ov1: 'C', // test fixture only — remove/replace with real ids as needed
};

// Conservative default: anything untiered is treated as restricted, never safe.
export const DEFAULT_TIER = 'A';

export function tierOf(hero) {
  if (hero && hero.id && Object.prototype.hasOwnProperty.call(OVERRIDES, hero.id)) {
    return OVERRIDES[hero.id];
  }
  const p = hero && hero.publisher;
  if (p && Object.prototype.hasOwnProperty.call(PUBLISHER_TIER, p)) return PUBLISHER_TIER[p];
  return DEFAULT_TIER;
}

// What a hero may show in a PAID AD (organic is unrestricted, handled elsewhere).
export function adImagery(hero) {
  switch (tierOf(hero)) {
    case 'S': return 'none';
    case 'A': return 'stylized';
    case 'B': return 'small-raw';
    case 'C': return 'full';
    default: return 'none';
  }
}

// True if `tier` is no riskier than `maxTier` (e.g. maxTier 'B' admits B and C).
export function tierAllowed(tier, maxTier) {
  return TIER_RISK[tier] <= TIER_RISK[maxTier];
}

export const DISCLAIMER = 'Unofficial fan encyclopedia. Characters © their respective owners.';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/social/safety.test.mjs`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Add the `test:social` npm script**

In `package.json`, add to the `"scripts"` object (next to the existing `test`/`test:ci` entries):

```json
"test:social": "node --test scripts/social/",
```

- [ ] **Step 6: Verify the script works**

Run: `yarn test:social`
Expected: PASS — node's test runner discovers `scripts/social/safety.test.mjs` and reports 6 passing tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/social/safety.mjs scripts/social/safety.test.mjs package.json
git commit -m "feat(social): risk-tier decision core for ad safety"
```

---

### Task 2: Safe selection pool — `filterPool` (pure) + `safePool` (I/O)

**Files:**
- Modify: `scripts/social/safety.mjs`
- Modify: `scripts/social/safety.test.mjs`

**Interfaces:**
- Consumes: `famousPool(sb) => Promise<Hero[]>` from `./lib.mjs` (already exported; returns the top-160 heroes by `fame_score`, each including `publisher` and `fame_score`).
- Produces:
  - `filterPool(rows, { maxTier='C', minFame=0 }) => Hero[]` — pure.
  - `safePool(sb, { maxTier='C', minFame=0 }) => Promise<Hero[]>` — thin I/O wrapper.

- [ ] **Step 1: Write the failing test**

Append to `scripts/social/safety.test.mjs`:

```js
import { filterPool } from './safety.mjs';

test('filterPool: keeps only heroes no riskier than maxTier, above minFame', () => {
  const rows = [
    { id: 'm', publisher: 'Marvel', fame_score: 90 },           // S
    { id: 'dc', publisher: 'DC Comics', fame_score: 80 },       // A
    { id: 'cl', publisher: 'Company-Licensed', fame_score: 70 },// B
    { id: 'pd', publisher: 'In the Public Domain', fame_score: 65 }, // C
    { id: 'pdlow', publisher: 'In the Public Domain', fame_score: 5 }, // C, low fame
  ];
  const c = filterPool(rows, { maxTier: 'C', minFame: 40 }).map((h) => h.id);
  assert.deepEqual(c, ['pd']); // only C-tier above fame 40

  const b = filterPool(rows, { maxTier: 'B', minFame: 0 }).map((h) => h.id);
  assert.deepEqual(b, ['cl', 'pd', 'pdlow']); // B and C tiers, any fame

  const a = filterPool(rows, { maxTier: 'A', minFame: 0 }).map((h) => h.id);
  assert.deepEqual(a, ['dc', 'cl', 'pd', 'pdlow']); // A, B, C — never S
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/social/safety.test.mjs`
Expected: FAIL — `filterPool` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `scripts/social/safety.mjs` (top-of-file import, and the two functions at the end):

```js
import { famousPool } from './lib.mjs';
```

```js
// Pure: filter a hero array to those allowed at maxTier and at/above minFame.
export function filterPool(rows, { maxTier = 'C', minFame = 0 } = {}) {
  return rows.filter(
    (h) => (h.fame_score ?? 0) >= minFame && tierAllowed(tierOf(h), maxTier),
  );
}

// I/O: the top-famous pool, filtered to what an ad may select. Draws from
// lib's famousPool (top-160 by fame_score, includes publisher).
export async function safePool(sb, opts = {}) {
  return filterPool(await famousPool(sb), opts);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/social/safety.test.mjs`
Expected: PASS — the new `filterPool` test passes alongside the Task 1 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/social/safety.mjs scripts/social/safety.test.mjs
git commit -m "feat(social): tier-filtered safe selection pool"
```

---

### Task 3: Audit report builder — `buildReport` (pure)

**Files:**
- Create: `scripts/social/audit-safety.mjs`
- Create: `scripts/social/audit-safety.test.mjs`

**Interfaces:**
- Consumes: `PUBLISHER_TIER`, `OVERRIDES`, `tierOf` from `./safety.mjs`.
- Produces: `buildReport(rows, { famousMin=40 }) => Report`, where `rows` is `[{ id, publisher, fame_score }]` and `Report` is:
  ```
  {
    total: number,
    tierTotals: { S, A, B, C },        // all heroes
    tierFamous: { S, A, B, C },        // heroes with fame_score >= famousMin
    publishers: [{ publisher, tier, total, famous }],  // sorted by famous desc
    untieredPublishers: string[],      // present in data, absent from PUBLISHER_TIER
    safeFaceBands: [{ label, count }], // Tier-C heroes bucketed by fame band
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `scripts/social/audit-safety.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from './audit-safety.mjs';

const ROWS = [
  { id: 'm1', publisher: 'Marvel', fame_score: 90 },              // S, famous
  { id: 'dc1', publisher: 'DC Comics', fame_score: 50 },          // A, famous
  { id: 'pd1', publisher: 'In the Public Domain', fame_score: 70 },// C, famous (band 60-79)
  { id: 'pd2', publisher: 'In the Public Domain', fame_score: 10 },// C, not famous (band 1-19)
  { id: 'x1', publisher: 'Weird New Pub', fame_score: 45 },       // untiered -> A, famous
  { id: 'n1', publisher: null, fame_score: 0 },                   // null -> A, not famous
];

test('buildReport: tier totals and famous counts', () => {
  const r = buildReport(ROWS, { famousMin: 40 });
  assert.equal(r.total, 6);
  assert.deepEqual(r.tierTotals, { S: 1, A: 3, B: 0, C: 2 });
  assert.deepEqual(r.tierFamous, { S: 1, A: 2, B: 0, C: 1 });
});

test('buildReport: untiered publishers flagged, null excluded', () => {
  const r = buildReport(ROWS, { famousMin: 40 });
  assert.deepEqual(r.untieredPublishers, ['Weird New Pub']);
});

test('buildReport: safe-face bands count Tier-C by fame band', () => {
  const r = buildReport(ROWS, { famousMin: 40 });
  const band = (label) => r.safeFaceBands.find((b) => b.label === label).count;
  assert.equal(band('60-79'), 1); // pd1
  assert.equal(band('1-19'), 1);  // pd2
  assert.equal(band('80-100'), 0);
});

test('buildReport: publishers sorted by famous desc', () => {
  const r = buildReport(ROWS, { famousMin: 40 });
  assert.equal(r.publishers[0].publisher, 'Marvel'); // 1 famous, tie broken by total/order
  assert.ok(r.publishers.every((p) => typeof p.tier === 'string'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/social/audit-safety.test.mjs`
Expected: FAIL — cannot resolve `./audit-safety.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/social/audit-safety.mjs` (pure part only for now — the CLI `main` is added in Task 4):

```js
// Catalogue IP-risk audit. buildReport is pure (tested); the CLI wrapper that
// fetches real rows and writes the report is added in Task 4.
// Design: docs/superpowers/specs/2026-07-06-social-ad-safety-split-design.md
import { PUBLISHER_TIER, tierOf } from './safety.mjs';

const BANDS = [
  { label: '80-100', min: 80 },
  { label: '60-79', min: 60 },
  { label: '40-59', min: 40 },
  { label: '20-39', min: 20 },
  { label: '1-19', min: 1 },
  { label: '0', min: 0 },
];

const bandFor = (fame) => BANDS.find((b) => (fame ?? 0) >= b.min).label;

export function buildReport(rows, { famousMin = 40 } = {}) {
  const tierTotals = { S: 0, A: 0, B: 0, C: 0 };
  const tierFamous = { S: 0, A: 0, B: 0, C: 0 };
  const byPub = new Map(); // publisher -> { publisher, tier, total, famous }
  const safeBands = new Map(BANDS.map((b) => [b.label, 0]));

  for (const h of rows) {
    const tier = tierOf(h);
    const famous = (h.fame_score ?? 0) >= famousMin;
    tierTotals[tier]++;
    if (famous) tierFamous[tier]++;

    const pub = h.publisher ?? '(none)';
    if (!byPub.has(pub)) byPub.set(pub, { publisher: pub, tier, total: 0, famous: 0 });
    const rec = byPub.get(pub);
    rec.total++;
    if (famous) rec.famous++;

    if (tier === 'C') safeBands.set(bandFor(h.fame_score), safeBands.get(bandFor(h.fame_score)) + 1);
  }

  const publishers = [...byPub.values()].sort((a, b) => b.famous - a.famous || b.total - a.total);
  const untieredPublishers = publishers
    .filter((p) => p.publisher !== '(none)' && !Object.prototype.hasOwnProperty.call(PUBLISHER_TIER, p.publisher))
    .map((p) => p.publisher);
  const safeFaceBands = BANDS.map((b) => ({ label: b.label, count: safeBands.get(b.label) }));

  return { total: rows.length, tierTotals, tierFamous, publishers, untieredPublishers, safeFaceBands };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/social/audit-safety.test.mjs`
Expected: PASS — all 4 `buildReport` tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/social/audit-safety.mjs scripts/social/audit-safety.test.mjs
git commit -m "feat(social): pure catalogue risk-report builder"
```

---

### Task 4: Audit CLI — paginated fetch, markdown render, report file

**Files:**
- Modify: `scripts/social/audit-safety.mjs`

**Interfaces:**
- Consumes: `loadEnv`, `makeSb`, `OUT_DIR` from `./lib.mjs`; `buildReport` (Task 3); `PUBLISHER_TIER` from `./safety.mjs`.
- Produces: an executable CLI. `node scripts/social/audit-safety.mjs` → writes `out/social/safety-report.md` and prints a summary. `renderMarkdown(report) => string` is exported for reuse.

- [ ] **Step 1: Add the paginator, markdown renderer, and guarded `main`**

Append to `scripts/social/audit-safety.mjs`:

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv, makeSb, OUT_DIR } from './lib.mjs';

// Full-catalogue scan — paginate under the PostgREST 1000-row cap.
async function fetchAllHeroes(sb, pageSize = 1000) {
  const cols = 'id,name,publisher,fame_score';
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await sb.rest(`heroes?select=${cols}&order=id.asc&limit=${pageSize}&offset=${offset}`);
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

export function renderMarkdown(report) {
  const { total, tierTotals, tierFamous, publishers, untieredPublishers, safeFaceBands } = report;
  const L = [];
  L.push(`# Mythique catalogue — IP risk audit`, ``, `Generated ${new Date().toISOString()}`, ``);
  L.push(`Total heroes: **${total.toLocaleString()}**`, ``);
  L.push(`## Tier distribution`, ``, `| Tier | Total | Famous (fame ≥ 40) |`, `| --- | ---: | ---: |`);
  for (const t of ['S', 'A', 'B', 'C']) L.push(`| ${t} | ${tierTotals[t]} | ${tierFamous[t]} |`);
  L.push(``, `## Safe-face pool (Tier C by fame band)`, ``, `| Fame band | Tier-C count |`, `| --- | ---: |`);
  for (const b of safeFaceBands) L.push(`| ${b.label} | ${b.count} |`);
  L.push(``, `## Untiered publishers (defaulting to Tier A — review & assign)`, ``);
  L.push(untieredPublishers.length ? untieredPublishers.map((p) => `- ${p}`).join('\n') : '_none — full coverage_');
  L.push(``, `## Publishers by famous-character count`, ``, `| Publisher | Tier | Total | Famous |`, `| --- | --- | ---: | ---: |`);
  for (const p of publishers.slice(0, 60)) L.push(`| ${p.publisher} | ${p.tier} | ${p.total} | ${p.famous} |`);
  return L.join('\n') + '\n';
}

async function main() {
  const sb = makeSb(loadEnv());
  console.log('Scanning catalogue…');
  const rows = await fetchAllHeroes(sb);
  const report = buildReport(rows);
  const md = renderMarkdown(report);
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'safety-report.md');
  writeFileSync(outPath, md);
  console.log(`\nTotal: ${report.total}`);
  console.log('Tier totals:', report.tierTotals);
  console.log('Tier famous:', report.tierFamous);
  console.log('Untiered publishers:', report.untieredPublishers.join(', ') || '(none)');
  console.log(`\nReport written to ${outPath}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Verify the unit tests still pass (importing the file must not run `main`)**

Run: `node --test scripts/social/audit-safety.test.mjs`
Expected: PASS — the `isMain` guard prevents `main()` from firing on import, so the `buildReport` tests still pass with no network access.

- [ ] **Step 3: Run the audit against the real catalogue**

Run: `node scripts/social/audit-safety.mjs`
Expected: prints `Scanning catalogue…`, then a summary (Total ≈ 34,000; tier totals dominated by A/S; a short untiered-publisher list), and writes `out/social/safety-report.md`. Requires `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY` in `.env.local`.

- [ ] **Step 4: Eyeball the report**

Open `out/social/safety-report.md`. Confirm: the tier table is populated, the "Safe-face pool" section shows how many Tier-C characters exist per fame band (expected: small at high fame), and the untiered-publisher list is short (each entry is a real gap in `PUBLISHER_TIER` to consider assigning).

- [ ] **Step 5: Commit**

```bash
git add scripts/social/audit-safety.mjs
git commit -m "feat(social): catalogue IP-risk audit CLI + report"
```

Note: `out/social/` is already git-ignored (per `scripts/social/README.md`), so the generated report is not committed.

---

## Self-Review

**1. Spec coverage (Phase 1 scope):**
- §3 risk-tier model → Task 1 (`PUBLISHER_TIER`, `OVERRIDES`, `tierOf`, defaults). ✓
- §3.1 ad rule matrix → Task 1 (`adImagery`). ✓
- §3.3 hard defaults (unknown→A) → Task 1 test + impl. ✓ (official-art-never-in-ads is a `safePortrait` rule — Phase 2, correctly out of scope here.)
- §4 `safePool` → Task 2. ✓ `DISCLAIMER` → Task 1. ✓ (`safePortrait` is Phase 2 — depends on stylize; noted in plan Architecture.)
- §6 audit script (tier coverage, safe-face pool, untiered flag) → Tasks 3–4. ✓ (Sample-exposure labeling via `adImagery` is available; a fuller sample run can be added when ad selection exists in Phase 2.)
- §9 testing (pure functions unit-tested; audit as integration check) → Tasks 1–4. ✓
- §10 phasing (Phase 1 = safety.mjs + audit) → this plan. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". All code shown in full. ✓

**3. Type consistency:** `tierOf`/`adImagery`/`tierAllowed`/`filterPool`/`safePool`/`buildReport`/`renderMarkdown` signatures match between definition and consumption across tasks. `famousPool` consumed per its existing `lib.mjs` export. Report shape in Task 3 interface matches `renderMarkdown` fields in Task 4. ✓

**Deviation from spec, noted:** `safePortrait` (spec §4) is deferred to Phase 2 because its `stylized` branch depends on `ads/stylize.mjs` (also Phase 2). Phase 1 ships the pure decision layer, `safePool`, and the audit — all independently useful and runnable.
