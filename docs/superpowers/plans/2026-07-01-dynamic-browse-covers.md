# Dynamic Browse Covers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/explore` "Browse the Universe" grid and the mobile-web Search category cards show a fame-weighted *random* hero portrait per category (stable per session) instead of always the single most-famous face.

**Architecture:** The `get_browse_covers` RPC returns a fame-ranked candidate pool per category slug. The client (`getBrowseCovers` in `categories.ts`) picks one distinct, fame-weighted-random candidate per slug via a pure function. Both surfaces share `getBrowseCovers`, so one change fixes both. Selection is already cached once per session, giving per-session cadence for free.

**Tech Stack:** TypeScript, Supabase/PostgREST RPC (PL/pgSQL `language sql`), Jest + `@testing-library`.

## Global Constraints

- Package manager is **yarn**; run tests with `yarn test:ci`.
- TypeScript only — no `any`; prefer `unknown` for caught errors.
- Screens never import `supabase` directly — DB access stays in `src/lib/db/`.
- SQL schema/function changes must be a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`, applied via the Supabase MCP tool (`mcp__supabase__apply_migration`), then regenerate `src/types/database.generated.ts` via `mcp__supabase__generate_typescript_types`.
- The `get_browse_covers` per-slug predicate mirrors `category_facet_counts` — do not change the per-slug `CASE`; only add the image gate.
- Spec: `docs/superpowers/specs/2026-07-01-dynamic-browse-covers-design.md`.

---

## File Structure

- **Modify** `src/lib/db/heroes/categories.ts` — export `BrowseCoverCandidate`, add `POOL_SIZE`/`WEIGHT_ALPHA` constants, add pure `pickDistinctCovers` + `weightedPick` helpers, rewrite `getBrowseCovers` to request the deeper pool and delegate to `pickDistinctCovers`.
- **Create** `__tests__/lib/db/heroes.browseCovers.test.ts` — unit tests for `pickDistinctCovers` (distinct assignment, weighting bias, exhausted-pool fallback).
- **Create** `supabase/migrations/20260701140000_browse_covers_image_gate.sql` — redefines `get_browse_covers` adding the "has a usable cover image" predicate.
- **Regenerate** `src/types/database.generated.ts` — after applying the migration (expected no-op since the RPC return shape is unchanged; regenerate anyway per convention).

---

### Task 1: Client-side weighted-random distinct cover picker

**Files:**
- Modify: `src/lib/db/heroes/categories.ts:581-639`
- Test: `__tests__/lib/db/heroes.browseCovers.test.ts` (create)

**Interfaces:**
- Consumes: `BrowseCover` (from `src/lib/db/heroes/types.ts`), `CategorySlug`, `supabase` (already imported in `categories.ts`).
- Produces:
  - `export interface BrowseCoverCandidate { slug: string; pos: number; id: string; name: string; image_url: string | null; image_md_url: string | null; portrait_url: string | null; }`
  - `export function pickDistinctCovers(bySlug: Map<string, BrowseCoverCandidate[]>, slugs: CategorySlug[], rng?: () => number): Record<string, BrowseCover>`
  - `getBrowseCovers(slugs: CategorySlug[]): Promise<Record<string, BrowseCover>>` (unchanged signature).

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/heroes.browseCovers.test.ts`:

```ts
import {
  pickDistinctCovers,
  type BrowseCoverCandidate,
} from '../../../src/lib/db/heroes/categories';

// pickDistinctCovers is pure, but importing categories.ts evaluates its
// top-level `import { supabase }`. Stub it so no real client is created.
jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

function cand(slug: string, pos: number, id: string): BrowseCoverCandidate {
  return {
    slug,
    pos,
    id,
    name: id,
    image_url: `${id}.jpg`,
    image_md_url: null,
    portrait_url: null,
  };
}

describe('pickDistinctCovers', () => {
  it('never assigns the same hero to two slugs when a distinct fallback exists', () => {
    // Both slugs top with the shared hero X; dc must fall through to a distinct pick.
    const bySlug = new Map<string, BrowseCoverCandidate[]>([
      ['marvel', [cand('marvel', 1, 'X'), cand('marvel', 2, 'Y')]],
      ['dc', [cand('dc', 1, 'X'), cand('dc', 2, 'Z')]],
    ]);
    // rng() === 0 always selects the first (highest-weight) available candidate.
    const out = pickDistinctCovers(bySlug, ['marvel', 'dc'], () => 0);
    expect(out.marvel.name).toBe('X');
    expect(out.dc.name).toBe('Z');
  });

  it('biases selection toward higher-ranked (lower pos) candidates', () => {
    const bySlug = new Map<string, BrowseCoverCandidate[]>([
      ['marvel', [cand('marvel', 1, 'A'), cand('marvel', 2, 'B'), cand('marvel', 3, 'C')]],
    ]);
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
    for (let i = 0; i < 3000; i++) {
      const out = pickDistinctCovers(bySlug, ['marvel'], Math.random);
      counts[out.marvel.name] += 1;
    }
    // Weights are 1, 0.5, 0.333 — pos-1 should clearly dominate pos-3.
    expect(counts.A).toBeGreaterThan(counts.B);
    expect(counts.B).toBeGreaterThan(counts.C);
  });

  it('falls back to the first candidate when every candidate is already used', () => {
    const bySlug = new Map<string, BrowseCoverCandidate[]>([
      ['marvel', [cand('marvel', 1, 'X')]],
      ['dc', [cand('dc', 1, 'X')]], // only X, already claimed by marvel
    ]);
    const out = pickDistinctCovers(bySlug, ['marvel', 'dc'], () => 0);
    expect(out.marvel.name).toBe('X');
    expect(out.dc.name).toBe('X'); // still gets art via fallback, not dropped
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/lib/db/heroes.browseCovers.test.ts`
Expected: FAIL — `pickDistinctCovers` / `BrowseCoverCandidate` are not exported yet (import error or "is not a function").

- [ ] **Step 3: Implement the picker in `categories.ts`**

In `src/lib/db/heroes/categories.ts`, replace the existing block at lines 581-639 (the `interface BrowseCoverCandidate { ... }` through the end of `getBrowseCovers`) with:

```ts
/** One candidate row from the get_browse_covers RPC (top heroes per slug, by fame). */
export interface BrowseCoverCandidate {
  slug: string;
  pos: number;
  id: string;
  name: string;
  image_url: string | null;
  image_md_url: string | null;
  portrait_url: string | null;
}

// How deep into each fame-ranked category the rotation can reach.
const POOL_SIZE = 40;
// Rank-decay exponent: weight for a candidate at 1-based fame rank `pos` is
// pos^(-WEIGHT_ALPHA). Higher = stronger bias toward the most famous.
const WEIGHT_ALPHA = 1.0;

type Rng = () => number; // returns a float in [0, 1)

// Pick one candidate proportional to pos^(-WEIGHT_ALPHA). Because the pool is
// already ordered by fame, rank-decay encodes "more popular → more likely"
// without reading raw fame_score (robust to fame ties/zeros in the top N).
function weightedPick(candidates: BrowseCoverCandidate[], rng: Rng): BrowseCoverCandidate {
  const weights = candidates.map((c) => Math.pow(c.pos, -WEIGHT_ALPHA));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r < 0) return candidates[i];
  }
  return candidates[candidates.length - 1]; // float-rounding guard
}

/**
 * Assign one DISTINCT cover candidate per slug, walking slugs in order. Within a
 * slug, pick a fame-weighted-random candidate from those not yet used; an earlier
 * pod claims a shared hero so a later one falls through to its next candidate
 * (otherwise the same most-popular hero tops multiple tiles). Falls back to the
 * first candidate if every candidate for a slug is already used, so the tile still
 * gets art rather than the solid-colour fallback. Pure; `rng` is injectable for tests.
 */
export function pickDistinctCovers(
  bySlug: Map<string, BrowseCoverCandidate[]>,
  slugs: CategorySlug[],
  rng: Rng = Math.random,
): Record<string, BrowseCover> {
  const used = new Set<string>();
  const out: Record<string, BrowseCover> = {};
  for (const slug of slugs) {
    const candidates = bySlug.get(slug) ?? [];
    const available = candidates.filter((c) => !used.has(c.id));
    const pick = available.length > 0 ? weightedPick(available, rng) : candidates[0];
    if (!pick) continue;
    used.add(pick.id);
    out[slug] = {
      name: pick.name,
      image_url: pick.image_url,
      image_md_url: pick.image_md_url,
      portrait_url: pick.portrait_url,
    };
  }
  return out;
}

/**
 * One representative hero per browse category, for the image-backed category tiles
 * on the home screen and mobile-web search. A single `get_browse_covers` RPC returns
 * the top `POOL_SIZE` heroes by fame for every slug at once; `pickDistinctCovers`
 * then chooses a distinct, fame-weighted-random hero per pod so the grid varies each
 * session instead of always showing the single most-famous face. Missing/empty
 * categories simply don't get a cover (the tile falls back to a solid colour).
 */
export async function getBrowseCovers(slugs: CategorySlug[]): Promise<Record<string, BrowseCover>> {
  const { data, error } = await supabase.rpc('get_browse_covers', {
    p_slugs: slugs,
    p_per_slug: POOL_SIZE,
  });
  if (error) {
    console.warn('[getBrowseCovers] error:', error.message);
    return {};
  }

  // Group candidates by slug, preserving the RPC's fame order (rows arrive
  // pos-ascending within each slug).
  const bySlug = new Map<string, BrowseCoverCandidate[]>();
  for (const row of (data ?? []) as BrowseCoverCandidate[]) {
    const list = bySlug.get(row.slug) ?? [];
    list.push(row);
    bySlug.set(row.slug, list);
  }

  return pickDistinctCovers(bySlug, slugs);
}
```

Note: `BrowseCover` and `CategorySlug` are already imported at the top of `categories.ts` (they are used by the surrounding code) — do not add duplicate imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/lib/db/heroes.browseCovers.test.ts`
Expected: PASS (3 passing tests).

- [ ] **Step 5: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no new errors in `categories.ts` or the test file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/heroes/categories.ts __tests__/lib/db/heroes.browseCovers.test.ts
git commit -m "feat(explore): fame-weighted random browse covers (distinct per pod)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Migration — gate browse-cover candidates to heroes with a usable image

**Files:**
- Create: `supabase/migrations/20260701140000_browse_covers_image_gate.sql`
- Regenerate: `src/types/database.generated.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (independent; the client already tolerates any pool size).
- Produces: a redefined `get_browse_covers(text[], int)` whose candidates all have a non-null cover image. Return shape unchanged.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260701140000_browse_covers_image_gate.sql`:

```sql
-- get_browse_covers: gate candidates to heroes that actually have a usable cover
-- image, so the client's fame-weighted-random pick (which now reaches ~40 deep per
-- category) can never surface a blank/broken tile. Only the image predicate is
-- added; the per-slug CASE still MIRRORS category_facet_counts(p_slug) — keep the
-- two in sync. An unknown slug falls through to ELSE (top heroes overall).
create or replace function public.get_browse_covers(
  p_slugs text[],
  p_per_slug int default 6
)
returns table (
  slug text,
  pos int,
  id text,
  name text,
  image_url text,
  image_md_url text,
  portrait_url text
)
language sql
stable
set search_path = public
as $function$
  select s.slug, c.pos, c.id, c.name, c.image_url, c.image_md_url, c.portrait_url
  from unnest(p_slugs) as s(slug)
  cross join lateral (
    select
      h.id, h.name, h.image_url, h.image_md_url, h.portrait_url,
      row_number() over (order by h.fame_score desc nulls last) as pos
    from heroes h
    where
      coalesce(h.portrait_url, h.image_md_url, h.image_url) is not null
      and case s.slug
        when 'popular' then h.category = 'popular'
        when 'villain' then h.alignment = 'bad' and (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain'))
        when 'xmen' then (h.group_affiliation ilike '%x-men%' or h.group_affiliation ilike '%xmen%')
        when 'anti-heroes' then h.alignment ilike '%neutral%'
        when 'marvel' then h.publisher ilike '%marvel%'
        when 'dc' then h.publisher ilike '%dc%'
        when 'image' then h.publisher ilike '%image%'
        when 'dark-horse' then h.publisher ilike '%dark horse%'
        when 'strongest' then h.strength is not null
        when 'most-intelligent' then h.intelligence is not null
        when 'most-iconic' then (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed'))
        when 'franchise-icons' then h.franchise is not null
        when 'anime' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'anime')
        when 'video-games' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'video-game')
        when 'horror' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'horror-icon')
        else true
      end
    order by h.fame_score desc nulls last
    limit p_per_slug
  ) c
  order by s.slug, c.pos;
$function$;

grant execute on function public.get_browse_covers(text[], int) to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP tool `mcp__supabase__apply_migration` with:
- `name`: `browse_covers_image_gate`
- `query`: the full SQL from Step 1.

Expected: success, no error.

- [ ] **Step 3: Verify the gate holds**

Use `mcp__supabase__execute_sql` to run:

```sql
select count(*) as blank
from get_browse_covers(array['marvel','dc','villain','anime','video-games'], 40)
where coalesce(portrait_url, image_md_url, image_url) is null;
```

Expected: `blank = 0`. Also spot-check variety:

```sql
select slug, count(*) as candidates
from get_browse_covers(array['marvel','dc','villain','anime','video-games'], 40)
group by slug order by slug;
```

Expected: each listed slug returns multiple candidates (up to 40), confirming the pool is deep enough for the weighted pick.

- [ ] **Step 4: Regenerate generated types**

Use `mcp__supabase__generate_typescript_types` and write the output to `src/types/database.generated.ts`.
Expected: the `get_browse_covers` `Returns` shape is unchanged (this is a no-op-ish regeneration per repo convention). If the file is byte-identical, that is fine — still commit any diff.

- [ ] **Step 5: Typecheck + full test run**

Run: `yarn tsc --noEmit && yarn test:ci`
Expected: no type errors; all tests pass (including Task 1's new file).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260701140000_browse_covers_image_gate.sql src/types/database.generated.ts
git commit -m "feat(explore): gate browse-cover candidates to heroes with a usable image

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- RPC image gate → Task 2. ✅
- Client `POOL_SIZE = 40`, `WEIGHT_ALPHA = 1.0`, pure `pickDistinctCovers` with injected `rng`, rank-decay weighting, distinct dedup, exhausted-pool fallback → Task 1. ✅
- Per-session cadence via existing caches (`useBrowseCovers` module cache + React Query `exploreKeys.browseCovers`) → no code change required; documented in spec §3, no task needed. ✅
- Tests: distinct assignment, weighting bias, exhausted-pool fallback → Task 1 Step 1. ✅
- Both surfaces benefit via shared `getBrowseCovers` → inherent (no call-site changes). ✅

**Placeholder scan:** No TBD/TODO; all code and SQL shown in full. ✅

**Type consistency:** `BrowseCoverCandidate` (exported, with `pos`), `pickDistinctCovers(bySlug, slugs, rng)`, `weightedPick`, `POOL_SIZE`, `WEIGHT_ALPHA` used identically across the test, the implementation, and `getBrowseCovers`. `weightedPick` uses `c.pos` (the RPC's true fame rank), not the post-filter array index — correct after `available` filtering. ✅
