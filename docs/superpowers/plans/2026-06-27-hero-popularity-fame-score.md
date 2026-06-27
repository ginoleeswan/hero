# Hero Popularity / Fame Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-proxy `issue_count` popularity heuristic with a stored, mainstream-weighted `fame_score` (0–100) derived from a Claude-rated recognizability tier plus hard signals (Wikipedia sitelinks, film count, issue count).

**Architecture:** Capture raw signals in their own columns on `heroes`; a pure, versioned SQL function `compute_fame_score` blends them (tier sets the band, winsorized log signals position within it). Claude rates the ~2,075-hero candidate pool in-session via direct SQL; everyone else defaults to tier 0. Consumers switch `.order('issue_count')` → `.order('fame_score')` in phases.

**Tech Stack:** Supabase Postgres (migrations via `mcp__supabase__apply_migration`, ad-hoc SQL via `mcp__supabase__execute_sql`), Deno edge function (`enrich-wikidata-batch`), TypeScript `src/lib/db/` query layer, Jest (`yarn test:ci`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-27-hero-popularity-fame-score-design.md`.
- Package manager: **yarn** only. Never npm/bun.
- All schema changes are new files in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`, applied via `mcp__supabase__apply_migration`. After any migration, regenerate `src/types/database.generated.ts` via `mcp__supabase__generate_typescript_types` — never hand-edit it.
- Screens never import `supabase` directly; all DB access stays inside `src/lib/db/`.
- PostgREST has a 1000-row cap — keep `.limit()`/`.range()` on `heroes` queries.
- Candidate pool definition (used verbatim everywhere): `movie_count >= 2 OR issue_count >= 200 OR franchise IS NOT NULL` (~2,075 rows as of 2026-06-27).
- Tier → band map (verbatim): `0→[0,15] 1→[15,35] 2→[35,55] 3→[55,80] 4→[80,100]`.
- Maintenance functions (`recompute_fame_scores`) are not client-exposed: REVOKE from `anon`/`authenticated`; run them as service role via MCP.
- Tier provenance marker string (verbatim): `fame_rated_by = 'claude-opus-4-8'`.
- Commit after each task. Work directly on `main` (repo convention — no feature branches).

---

### Task 1: Schema + scoring function migration

**Files:**
- Create: `supabase/migrations/20260627120000_fame_score.sql`
- Modify (regenerate): `src/types/database.generated.ts`

**Interfaces:**
- Produces columns on `heroes`: `fame_tier smallint NOT NULL DEFAULT 0`, `fame_rated_at timestamptz`, `fame_rated_by text`, `wikidata_sitelinks int`, `fame_score smallint`, `fame_score_version smallint`.
- Produces SQL: `compute_fame_score(p_tier smallint, p_n_site real, p_n_movie real, p_n_issue real) returns smallint` (pure/immutable); `recompute_fame_scores() returns integer` (security definer, service-role only).

- [ ] **Step 1: Write the failing test (function does not exist yet)**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT public.compute_fame_score(4::smallint, 1.0::real, 1.0::real, 1.0::real);
```
Expected: ERROR `function public.compute_fame_score(...) does not exist`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260627120000_fame_score.sql`:
```sql
-- Fame / popularity score: captured signals + a versioned scoring function.
-- Replaces issue_count as the popularity heuristic with a mainstream-weighted
-- 0-100 score. fame_tier is rated by Claude for the candidate pool; everyone
-- else defaults to 0 (=> ordered by issue_count via the scoring blend, no
-- regression for the long tail).

alter table public.heroes
  add column if not exists fame_tier        smallint not null default 0,
  add column if not exists fame_rated_at    timestamptz,
  add column if not exists fame_rated_by    text,
  add column if not exists wikidata_sitelinks int,
  add column if not exists fame_score       smallint,
  add column if not exists fame_score_version smallint;

create index if not exists heroes_fame_score_idx
  on public.heroes (fame_score desc nulls last);

-- Pure blend: tier sets the band; the mainstream-weighted, already-normalized
-- ([0,1]) signal mix positions the hero within the band, with a bounded
-- cross-band correction (+/- up to 8 pts) so extreme hard signals can rescue a
-- mis-rated hero. All constants here are tunable; bump fame_score_version and
-- re-run recompute_fame_scores() after changing them.
create or replace function public.compute_fame_score(
  p_tier smallint, p_n_site real, p_n_movie real, p_n_issue real
) returns smallint
language sql immutable as $$
  with b as (
    select
      (case p_tier when 4 then 80 when 3 then 55 when 2 then 35 when 1 then 15 else 0 end)::real as lo,
      (case p_tier when 4 then 100 when 3 then 80 when 2 then 55 when 1 then 35 else 15 end)::real as hi
  ),
  s as (
    select least(1.0, greatest(0.0,
      0.5 * coalesce(p_n_site, 0) + 0.3 * coalesce(p_n_movie, 0) + 0.2 * coalesce(p_n_issue, 0)
    ))::real as w
  )
  select greatest(0, least(100, round(
      (select lo from b) + (select w from s) * ((select hi from b) - (select lo from b))
    + (case when (select w from s) > 0.9 then ((select w from s) - 0.9) * 80 else 0 end)
    - (case when (select w from s) < 0.1 then (0.1 - (select w from s)) * 80 else 0 end)
  )))::smallint
$$;

-- Recompute every hero's fame_score. Winsorizes each hard signal at its 99th
-- percentile (so one outlier can't flatten the scale), log-compresses, and
-- normalizes to [0,1] before calling compute_fame_score. Service-role only.
create or replace function public.recompute_fame_scores()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_cap real; v_movie_cap real; v_issue_cap real; v_n integer;
begin
  select percentile_cont(0.99) within group (order by wikidata_sitelinks)
    into v_site_cap from heroes where wikidata_sitelinks > 0;
  select percentile_cont(0.99) within group (order by movie_count)
    into v_movie_cap from heroes where movie_count > 0;
  select percentile_cont(0.99) within group (order by issue_count)
    into v_issue_cap from heroes where issue_count > 0;
  v_site_cap  := greatest(coalesce(v_site_cap, 1), 1);
  v_movie_cap := greatest(coalesce(v_movie_cap, 1), 1);
  v_issue_cap := greatest(coalesce(v_issue_cap, 1), 1);

  update heroes h set
    fame_score = compute_fame_score(
      coalesce(h.fame_tier, 0)::smallint,
      (ln(1 + least(coalesce(h.wikidata_sitelinks, 0), v_site_cap)) / ln(1 + v_site_cap))::real,
      (ln(1 + least(coalesce(h.movie_count, 0), v_movie_cap)) / ln(1 + v_movie_cap))::real,
      (ln(1 + least(coalesce(h.issue_count, 0), v_issue_cap)) / ln(1 + v_issue_cap))::real
    ),
    fame_score_version = 1;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.recompute_fame_scores() from public, anon, authenticated;
grant execute on function public.recompute_fame_scores() to service_role;
```

Apply via `mcp__supabase__apply_migration` (name: `fame_score`, the SQL above).

- [ ] **Step 3: Verify the function passes its behavioral checks**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT
  public.compute_fame_score(0::smallint, 0,0,0)        AS tier0_floor,   -- expect 0
  public.compute_fame_score(4::smallint, 0,0,0)        AS tier4_band_lo, -- expect 80
  public.compute_fame_score(4::smallint, 1.0,1.0,1.0)  AS tier4_max,     -- expect 100
  public.compute_fame_score(2::smallint, 0.5,0.5,0.5)  AS tier2_mid,     -- expect 45
  public.compute_fame_score(1::smallint, 1.0,1.0,1.0)  AS tier1_signal_boosted; -- > 35
```
Expected: `tier0_floor=0`, `tier4_band_lo=80`, `tier4_max=100`, `tier2_mid=45`, `tier1_signal_boosted` between 35 and 43 (cross-band lift). If any differ, fix the constants in the migration and re-apply.

- [ ] **Step 4: Regenerate types**

Run `mcp__supabase__generate_typescript_types` and write the result to `src/types/database.generated.ts`. Confirm `fame_score`, `fame_tier`, `wikidata_sitelinks` appear in the `heroes` Row.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260627120000_fame_score.sql src/types/database.generated.ts
git commit -m "feat(fame): fame_score columns + compute/recompute SQL functions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Backfill Wikipedia sitelink counts via enrich-wikidata-batch

**Files:**
- Modify: `supabase/functions/enrich-wikidata-batch/index.ts` (`fetchFacts` ~128-159; the hero `.update({...})` ~258-265)

**Interfaces:**
- Consumes: `heroes.wikidata_qid` (resolved), the existing `sparql()` helper.
- Produces: populated `heroes.wikidata_sitelinks` for QID-resolved heroes.

- [ ] **Step 1: Add sitelinks to the SPARQL + return type in `fetchFacts`**

In `fetchFacts`, extend the return type and query. Change the signature block (line ~128) to include `sitelinks: number | null;`, add `?sl` to the SELECT and an OPTIONAL clause, and return it:
```ts
async function fetchFacts(qid: string): Promise<{
  aliases: string[];
  creators: string[];
  inceptionYear: number | null;
  imdb: string | null;
  site: string | null;
  sitelinks: number | null;
}> {
  const q = `
SELECT ?aliases ?creators ?inc ?imdb ?site ?sl WHERE {
  OPTIONAL { wd:${qid} wdt:P571 ?inc. }
  OPTIONAL { wd:${qid} wdt:P345 ?imdb. }
  OPTIONAL { wd:${qid} wdt:P856 ?site. }
  OPTIONAL { wd:${qid} wikibase:sitelinks ?sl. }
  OPTIONAL { SELECT (GROUP_CONCAT(DISTINCT ?a; SEPARATOR="|") AS ?aliases) WHERE { wd:${qid} skos:altLabel ?a. FILTER(LANG(?a)="en") } }
  OPTIONAL { SELECT (GROUP_CONCAT(DISTINCT ?cl; SEPARATOR="|") AS ?creators) WHERE { wd:${qid} wdt:P170 ?c. ?c rdfs:label ?cl. FILTER(LANG(?cl)="en") } }
} LIMIT 1`;
  const rows = await sparql(q);
  const r = rows[0] ?? {};
  const split = (v: string | undefined) =>
    v ? v.split('|').map((s) => s.trim()).filter(Boolean) : [];
  const sl = r.sl?.value != null ? Number.parseInt(r.sl.value, 10) : null;
  return {
    aliases: split(r.aliases?.value),
    creators: split(r.creators?.value),
    inceptionYear: yearOf(r.inc?.value ?? null),
    imdb: r.imdb?.value ?? null,
    site: r.site?.value ?? null,
    sitelinks: Number.isFinite(sl as number) ? sl : null,
  };
}
```

- [ ] **Step 2: Persist it in the hero update**

In the hero `.update({...})` block (~258-265), add the field:
```ts
      await sb
        .from('heroes')
        .update({
          creators: mergeUniq(h.creators ?? [], facts.creators),
          aliases: mergeUniq(h.aliases ?? [], facts.aliases),
          wikidata_sitelinks: facts.sitelinks,
          wikidata_enriched_at: new Date().toISOString(),
        })
        .eq('id', h.id);
```

- [ ] **Step 3: Deploy the function**

Deploy via `mcp__supabase__deploy_edge_function` (name `enrich-wikidata-batch`, the full updated file).

- [ ] **Step 4: Run a small retry batch and verify the column populates**

The function selects resolved heroes; `retry: true` re-processes already-enriched rows (so we can backfill sitelinks onto heroes whose `wikidata_enriched_at` is already set). Invoke a small batch (e.g. via `mcp__supabase__execute_sql` calling the existing admin drain, or trigger the function with `{ limit: 25, retry: true }` through the project's normal invocation path). Then verify:
```sql
SELECT count(*) FILTER (WHERE wikidata_sitelinks IS NOT NULL) AS got_sitelinks,
       max(wikidata_sitelinks) AS max_sitelinks
FROM heroes;
```
Expected: `got_sitelinks > 0`, `max_sitelinks` plausibly large (Spider-Man-class heroes have 100+ Wikipedia editions).

- [ ] **Step 5: Drain the full resolved set**

Re-run the batch (limit 25, retry true) repeatedly until coverage stops growing, or trigger the existing scheduled/admin drain to completion. Confirm:
```sql
SELECT count(*) AS resolved,
       count(*) FILTER (WHERE wikidata_sitelinks IS NOT NULL) AS with_sitelinks
FROM heroes WHERE wikidata_status = 'resolved' AND wikidata_qid IS NOT NULL;
```
Expected: `with_sitelinks` ≈ `resolved` (some entities legitimately have 0/none — that's fine; they stay NULL → treated as 0 in scoring).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/enrich-wikidata-batch/index.ts
git commit -m "feat(fame): backfill wikidata_sitelinks in enrich-wikidata-batch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Rate the candidate pool (Claude, in-session)

**Files:** none (data-only backfill via `mcp__supabase__execute_sql`).

**Interfaces:**
- Consumes: candidate pool rows.
- Produces: `heroes.fame_tier` (0–4) + `fame_rated_at`/`fame_rated_by` set for the pool.

- [ ] **Step 1: Pull the candidate pool in deterministic, paged batches**

For each batch (offset stepping by 200), run:
```sql
SELECT id, name, publisher, aliases, first_appearance, issue_count, movie_count, franchise
FROM heroes
WHERE movie_count >= 2 OR issue_count >= 200 OR franchise IS NOT NULL
ORDER BY id
LIMIT 200 OFFSET 0;   -- then 200, 400, ... until empty
```

- [ ] **Step 2: Assign a tier 0–4 to each row using the rubric**

Rubric (from the spec): 4 = household name (non-fans recognize: Spider-Man, Batman, Goku); 3 = well-known to general audiences (Harley Quinn, Deadpool, Venom); 2 = known to genre/comics fans (Nightcrawler, Blue Beetle); 1 = deep-cut comics-only; 0 = unidentifiable/obscure. Use `publisher` + `aliases` + `first_appearance` to disambiguate name collisions before deciding. When genuinely unsure between two tiers, pick the lower.

- [ ] **Step 3: Write each batch back via a single VALUES update**

```sql
UPDATE heroes AS h
SET fame_tier = v.tier,
    fame_rated_at = now(),
    fame_rated_by = 'claude-opus-4-8'
FROM (VALUES
  ('cv-1443', 4),
  ('cv-1455', 3)
  -- ...one row per hero in the batch...
) AS v(id, tier)
WHERE h.id = v.id;
```

- [ ] **Step 4: Verify full pool coverage after all batches**

```sql
SELECT
  count(*) AS pool,
  count(*) FILTER (WHERE fame_rated_at IS NOT NULL) AS rated,
  count(*) FILTER (WHERE fame_tier >= 3) AS tier3plus
FROM heroes
WHERE movie_count >= 2 OR issue_count >= 200 OR franchise IS NOT NULL;
```
Expected: `rated = pool` (every candidate rated); `tier3plus` is a believable few hundred, not thousands.

- [ ] **Step 5: Spot-check known heroes**

```sql
SELECT name, publisher, fame_tier FROM heroes
WHERE name ILIKE ANY (ARRAY['Spider-Man','Batman','Wolverine','Harley Quinn','Goku','Superman'])
ORDER BY fame_tier DESC;
```
Expected: all land at tier 4 (or 3 for borderline). Re-rate any obvious miss via another VALUES update before proceeding.

(No commit — data lives in the DB, not the repo.)

---

### Task 4: Compute scores + sanity-check distribution

**Files:** none (run via MCP).

**Interfaces:**
- Consumes: `fame_tier`, `wikidata_sitelinks`, `movie_count`, `issue_count`.
- Produces: populated `heroes.fame_score` + `fame_score_version = 1`.

- [ ] **Step 1: Run the recompute**

```sql
SELECT public.recompute_fame_scores();
```
Expected: returns ~33,989 (every row scored).

- [ ] **Step 2: Verify no nulls and a non-degenerate spread**

```sql
SELECT count(*) FILTER (WHERE fame_score IS NULL) AS nulls,
       min(fame_score), round(avg(fame_score),1) AS avg, max(fame_score),
       count(DISTINCT fame_score) AS distinct_scores
FROM heroes;
```
Expected: `nulls = 0`; `max` near 100; `distinct_scores` in the dozens+ (not clustered on one value).

- [ ] **Step 3: Verify the ranking reads sensibly at both ends**

```sql
(SELECT 'top' AS end, name, publisher, fame_tier, fame_score FROM heroes ORDER BY fame_score DESC LIMIT 15)
UNION ALL
(SELECT 'bottom', name, publisher, fame_tier, fame_score FROM heroes ORDER BY fame_score ASC LIMIT 5);
```
Expected: top is recognizable marquee characters (tier 3–4); bottom is obscure tier-0 imports. If a household name is missing from the top, fix its tier (Task 3 Step 5 pattern) and re-run Step 1.

(No commit.)

---

### Task 5: Phase 1 consumer cutover — Most Iconic + Popular category

**Files:**
- Modify: `src/lib/db/heroes/categories.ts` (`CATEGORY_DESCRIPTIONS['most-iconic']` ~107; `most-iconic` case ~196-203; `popular` case ~139-142; `getCategoryPage` default sort ~352-355)
- Test: `__tests__/lib/db/heroes.fameOrder.test.ts` (create)

**Interfaces:**
- Consumes: `heroes.fame_score`.
- Produces: category list/page queries ordered by `fame_score`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/heroes.fameOrder.test.ts` (mirrors the mock in `heroes.categoryPage.test.ts`):
```ts
import { getAllHeroesBySlug } from '../../../src/lib/db/heroes';

let mockResolveWith: { data: unknown; error: unknown } = { data: [], error: null };

jest.mock('../../../src/lib/supabase', () => {
  const methods = ['select', 'eq', 'gte', 'lte', 'neq', 'or', 'ilike', 'not', 'order', 'limit', 'range'];
  const chain: Record<string, unknown> = {};
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  chain.range = jest.fn(() => Promise.resolve(mockResolveWith));
  return { supabase: { from: jest.fn().mockReturnValue(chain) }, __chain: chain };
});

const { __chain: chain } = jest.requireMock('../../../src/lib/supabase') as {
  __chain: Record<string, jest.Mock>;
};

beforeEach(() => {
  jest.clearAllMocks();
  ['select', 'eq', 'not', 'order', 'limit', 'range'].forEach((m) => chain[m].mockReturnValue(chain));
  chain.range.mockReturnValue(Promise.resolve(mockResolveWith));
  mockResolveWith = { data: [], error: null };
});

describe('fame_score ordering', () => {
  it('orders most-iconic by fame_score desc', async () => {
    await getAllHeroesBySlug('most-iconic');
    expect(chain.order).toHaveBeenCalledWith('fame_score', { ascending: false, nullsFirst: false });
  });
  it('orders popular by fame_score desc (no longer alphabetical)', async () => {
    await getAllHeroesBySlug('popular');
    expect(chain.order).toHaveBeenCalledWith('fame_score', { ascending: false, nullsFirst: false });
    expect(chain.order).not.toHaveBeenCalledWith('name');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn jest __tests__/lib/db/heroes.fameOrder.test.ts`
Expected: FAIL — `popular` currently orders by `'name'`; `most-iconic` orders by `'issue_count'`.

- [ ] **Step 3: Update the queries**

In `src/lib/db/heroes/categories.ts`:
- `most-iconic` case (~196-203): change `.order('issue_count', ...)` → `.order('fame_score', { ascending: false, nullsFirst: false })`.
- `popular` case (~139-142): change `.order('name')` → `.order('fame_score', { ascending: false, nullsFirst: false })`.
- `getCategoryPage` default-sort else-branch (~354-355): change the relevance fallback `.order('issue_count', ...)` → `.order('fame_score', { ascending: false, nullsFirst: false })`.
- `CATEGORY_DESCRIPTIONS['most-iconic']` (~107): change `'Ranked by total comic book appearances'` → `'The most recognizable characters across comics and screen'`.

- [ ] **Step 4: Run the test + full suite**

Run: `yarn jest __tests__/lib/db/heroes.fameOrder.test.ts && yarn test:ci`
Expected: new test PASS; existing suite stays green (the `heroes.categoryPage.test.ts` `az`/`power` sort assertions are unaffected; if any test asserted the old `issue_count` default sort, update it to `fame_score`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/heroes/categories.ts __tests__/lib/db/heroes.fameOrder.test.ts
git commit -m "feat(fame): order Most Iconic + Popular categories by fame_score

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Phase 2 consumer cutover — feed rows, core list, related lists

**Files:**
- Modify: `src/lib/db/heroes/feed.ts` (issue_count `.order` sites: ~26, 37, 49, 60, 102, 115, 200, 211)
- Modify: `src/lib/db/heroes/core.ts` (~163)
- Modify: `src/lib/db/heroes/relationships.ts` (popularity ordering for related lists)
- Test: extend `__tests__/lib/db/heroes.fameOrder.test.ts`

**Interfaces:**
- Consumes: `heroes.fame_score`.
- Produces: feed/core/related queries ordered by `fame_score`, with `issue_count` kept only as a secondary tiebreaker where two orders are chained.

- [ ] **Step 1: Add failing assertions for a feed function**

Append to `__tests__/lib/db/heroes.fameOrder.test.ts` a test for one representative feed export (e.g. `getPopularHeroes` or the function at feed.ts:26 — use its real exported name):
```ts
import { /* exact export, e.g. */ getPopularHeroes } from '../../../src/lib/db/heroes';

it('orders the popular feed row by fame_score desc', async () => {
  await getPopularHeroes();
  expect(chain.order).toHaveBeenCalledWith('fame_score', { ascending: false, nullsFirst: false });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn jest __tests__/lib/db/heroes.fameOrder.test.ts`
Expected: FAIL (still ordering by `issue_count`).

- [ ] **Step 3: Swap the ordering at each site**

In `feed.ts`, `core.ts`, `relationships.ts`: replace each popularity-intent `.order('issue_count', { ascending: false, nullsFirst: false })` with `.order('fame_score', { ascending: false, nullsFirst: false })`.
- **Keep `issue_count` as-is** where it is NOT a popularity proxy: `getNewlyAddedCV` (feed.ts:167, ordered by `added_at`) and the spotlight's `.gte('issue_count', 200)`/`.gte('movie_count', 2)` *filters* (feed.ts:98-115) stay — only the `.order('issue_count')` line within spotlight (102, 115) becomes a secondary tiebreaker after a new `.order('fame_score', ...)` line above it.
- In `relationships.ts`, the related-list ordering (enemies/allies/rivals, per the popularity-ordering convention) switches to `fame_score`.

- [ ] **Step 4: Run the test + full suite + typecheck**

Run: `yarn jest __tests__/lib/db/heroes.fameOrder.test.ts && yarn test:ci`
Expected: all PASS. Resolve any test that hard-coded the old `issue_count` ordering by updating it to `fame_score`.

- [ ] **Step 5: Verify ordering end-to-end against the DB**

```sql
SELECT name, fame_score, issue_count FROM heroes
WHERE category = 'popular' ORDER BY fame_score DESC NULLS LAST LIMIT 10;
```
Expected: recognizable names on top, not an alphabetical or pure-issue_count list.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/heroes/feed.ts src/lib/db/heroes/core.ts src/lib/db/heroes/relationships.ts __tests__/lib/db/heroes.fameOrder.test.ts
git commit -m "feat(fame): order feed rows, core list, related lists by fame_score

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Update CLAUDE.md + final verification

**Files:**
- Modify: `CLAUDE.md` (the "3,000+ heroes" claims in the Project section, `seed.sql` note, and the Database conventions row-cap note)

**Interfaces:** none.

- [ ] **Step 1: Correct the catalog size + document fame_score**

In `CLAUDE.md`:
- Replace every "3,000+ heroes"/"3,000+ rows" mention with "~34,000 heroes" (Project blurb, `seed.sql` comment, Database-conventions row-cap note).
- In the Database conventions section, add a short bullet: popularity ordering uses `heroes.fame_score` (0–100), computed by `recompute_fame_scores()` from `fame_tier` (Claude-rated) + `wikidata_sitelinks` + `movie_count` + `issue_count`; re-rate the candidate pool and re-run recompute after large catalog growth. Reference the spec path.

- [ ] **Step 2: Final full verification**

Run: `yarn test:ci`
Expected: green.
Run via MCP: `SELECT count(*) FILTER (WHERE fame_score IS NULL) FROM heroes;`
Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update catalog size + document fame_score popularity heuristic

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Mainstream-weighted 0–100 score → Task 1 (`compute_fame_score` weights 0.5/0.3/0.2). ✓
- Captured signals + versioned function (not baked float) → Task 1 columns + `fame_score_version`. ✓
- Claude rates tier, not Gemini → Task 3 (direct SQL, no edge function). ✓
- Candidate pool `movie≥2 OR issue≥200 OR franchise`, tail defaults to 0 → Task 3 + column default. ✓
- Wikidata sitelinks backfill via enrich-wikidata-batch → Task 2. ✓
- Tier-band + winsorized log signals + bounded cross-band → Task 1. ✓
- Trending kept separate → no task touches `trending`/`get_trending_heroes` ordering. ✓ (spotlight filters retained, only popularity `.order` swapped.)
- Phased consumer cutover + honest "Most Iconic" copy + fix `popular` alphabetical → Tasks 5–6. ✓
- CLAUDE.md staleness action item → Task 7. ✓

**Placeholder scan:** All SQL/TS/test code is concrete; the only intentionally-variable content is the per-hero tier values in Task 3 (the deliverable of Claude's judgment) and the exact feed export name in Task 6 Step 1 (resolve to the real symbol at execution). No TBDs.

**Type consistency:** `compute_fame_score(smallint, real, real, real)→smallint` and `recompute_fame_scores()→integer` are referenced consistently across Tasks 1/4. `.order('fame_score', { ascending: false, nullsFirst: false })` is identical across Tasks 5/6 and the tests. Column names match the migration.

**Note on tests for SQL:** `compute_fame_score` is verified by SQL assertions (Task 1 Step 3) rather than Jest, since it is a pure DB function; the TS query-layer changes use the repo's existing chainable-mock Jest convention.
