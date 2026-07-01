# Dynamic, fame-weighted browse covers

**Date:** 2026-07-01
**Status:** Approved (ready for implementation plan)

## Problem

The image-backed category tiles in two places are **deterministic** — they show the
same hero portrait on every visit:

- The "Browse the Universe" grid on `/explore` (`browsegrid` row).
- The category cards on the mobile-web Search page (idle discovery grid).

Both surfaces share one data path:

- [useBrowseCovers.ts](../../../src/hooks/useBrowseCovers.ts) (search) and
  [exploreQueries.ts](../../../src/lib/query/exploreQueries.ts) (explore) both call
  `getBrowseCovers()`.
- `getBrowseCovers` calls the `get_browse_covers` RPC
  ([migration](../../../supabase/migrations/20260701130000_get_browse_covers.sql)),
  which returns the top candidates per slug **strictly ordered by `fame_score desc`**.
- [categories.ts:603-639](../../../src/lib/db/heroes/categories.ts#L603-L639) then
  greedily picks the **first distinct** hero per pod.

The RPC already fetches 6 candidates per slug, but only for cross-slug de-duplication
(so Joker doesn't lead DC *and* Villains at once) — not for variety. The result is
that each category always shows its single most-famous face.

## Goal

Make the browse-tile portraits feel alive: a **fame-weighted random** face per
category, so popular heroes dominate but the grid varies. Because both surfaces share
`getBrowseCovers`, one change fixes both.

## Decisions (agreed)

| Axis | Decision |
| --- | --- |
| **Cadence** | Once per session. Randomized when the covers are first fetched; stable until reload. Matches the existing session caching (no flicker on in-session navigation). |
| **Bias / pool depth** | Medium — top ~40 per category, fame-weighted. Deeper cuts appear but heavier heroes still dominate the odds. |
| **Where randomization lives** | Client-side (Approach A). The RPC returns a fame-ranked candidate pool; the client does the weighted pick. Keeps the important distinct-dedup behaviour in place and makes the weighting a pure, testable function. |
| **Quality gate** | Candidates must have a usable cover image, so a deep-cut pick can never surface a blank/broken tile. |

## Design

### 1. RPC change — new migration for `get_browse_covers`

A new migration file (`supabase/migrations/YYYYMMDDHHMMSS_browse_covers_image_gate.sql`)
redefines `get_browse_covers` with **one added predicate**: candidates must have a
usable cover image.

```sql
-- inside the lateral subquery WHERE, in addition to the per-slug CASE:
and coalesce(h.portrait_url, h.image_md_url, h.image_url) is not null
```

Everything else is unchanged — the per-slug `CASE` predicates, the
`order by h.fame_score desc nulls last`, the `pos` row-number, and the signature
`(p_slugs text[], p_per_slug int default 6)`. The client requests a deeper pool via
the existing `p_per_slug` param, so the signature does not change.

The migration header must keep the existing note that the per-slug predicate mirrors
`category_facet_counts` — that invariant is unaffected by this change.

After applying: regenerate `database.generated.ts` (per repo convention). No app-type
changes are expected since the RPC return shape is unchanged.

### 2. Client selection — `getBrowseCovers` in `categories.ts`

- Introduce module constants:
  - `POOL_SIZE = 40` — passed as `p_per_slug` (replaces the current `6`).
  - `WEIGHT_ALPHA = 1.0` — rank-decay exponent (the bias knob).
- Extract the assignment loop into a **pure function**:

```ts
type Rng = () => number; // returns [0, 1)

/**
 * Assign one DISTINCT cover candidate per slug, walking slugs in order.
 * Within a slug, pick a fame-weighted-random candidate from those not yet used.
 * Weight for a candidate at 1-based rank `pos` is pos^(-WEIGHT_ALPHA): because
 * the pool is already ordered by fame, rank-decay encodes "more popular → more
 * likely" without reading raw fame_score (robust to fame ties/zeros in the top N).
 * Falls back to the first candidate if every candidate for a slug is already used.
 */
export function pickDistinctCovers(
  bySlug: Map<string, BrowseCoverCandidate[]>,
  slugs: CategorySlug[],
  rng: Rng = Math.random,
): Record<string, BrowseCover>
```

- `getBrowseCovers` becomes thin: call the RPC with `POOL_SIZE`, group rows by slug
  (preserving fame order), then `return pickDistinctCovers(bySlug, slugs)`.
- `rng` is injected (defaults to `Math.random`) **only** so tests can assert the
  weighting deterministically.

**Weighted-pick algorithm** (per slug, over the unused candidates):

1. Compute `weight_i = (pos_i)^(-WEIGHT_ALPHA)` for each unused candidate (`pos` is
   the 1-based fame rank returned by the RPC).
2. Sample one candidate proportional to its weight using `rng()` against the
   cumulative weight sum.
3. Mark its `id` used so no later pod repeats it.

If a slug has no unused candidates (pool exhausted — unlikely at 40), fall back to its
first candidate so the tile still gets art.

### 3. Cadence & caching — no new code

Selection runs inside `getBrowseCovers`, which is already cached once per session:

- Mobile-web search: the module-level `cache` in
  [useBrowseCovers.ts](../../../src/hooks/useBrowseCovers.ts).
- Explore: React Query under `exploreKeys.browseCovers` in
  [exploreQueries.ts](../../../src/lib/query/exploreQueries.ts).

So the weighted pick is computed once per session and stays stable until reload —
exactly the chosen cadence. The deeper payload (~40 light rows × ~13 slugs) is paid
once, not per render. Neither call site changes.

### 4. Testing

Extend the categories test suite with unit tests on `pickDistinctCovers` (pure,
`rng`-injected):

- **Distinct assignment:** never assigns the same hero id to two pods when a distinct
  fallback exists.
- **Weighting bias:** with a seeded/stubbed `rng`, higher-ranked (lower `pos`)
  candidates are selected more often than deep cuts over many samples.
- **Exhausted-pool fallback:** a slug whose only candidates are all already used falls
  back to its first candidate rather than producing no cover.

The image gate lives in SQL and is not client-tested.

## Tuning knobs

Two constants control the feel, both easy to nudge later:

- `POOL_SIZE` (40) — how deep into a category the rotation can reach.
- `WEIGHT_ALPHA` (1.0) — higher = stronger bias toward the most famous; lower = flatter
  / more variety.

## Out of scope

- Daily or per-visit cadence (chose per-session).
- Server-side / seeded randomization (Approaches B and C).
- Changing which fields the tile renders or the tile's colour fallback.
- Any change to the per-slug category definitions.
