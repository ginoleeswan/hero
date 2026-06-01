# Category Page Filtering Overhaul — Design

**Date:** 2026-06-01
**Scope:** Web only (`app/category/[slug].web.tsx` and supporting layers). Native screen
(`app/category/[slug].tsx`) is out of scope; shared logic is extracted so it can be ported later.
**Status:** Approved design → spec for review.

## Background

The web category pages (`/category/villain`, etc.) currently expose only search + a
Popular/A–Z sort + a Marvel/DC publisher toggle. The goal is a mature, encyclopedia-grade
filtering system.

A WebKit layout bug that blanked these grids on iOS was fixed separately (cards using
`aspectRatio` in a CSS grid now also set `width: '100%'`). That fix is **not** part of this
work but is a prerequisite that already landed.

### Data reality (drives every decision)

Of **2,950** heroes:

| Attribute | Coverage |
|---|---|
| image | 100% |
| issue_count (popularity) | 85% (2,500) |
| powerstats (6 int columns) | 19% (570) |
| alignment / gender / group_affiliation / first_appearance | 16% (484) |
| race | 12% (345) |
| movies / creators / teams | 1–2% (too sparse — excluded) |

Publisher buckets: Other 1,507 · Marvel 840 · DC 592 · none 11.
Alignment: good 329 · bad 131 · neutral 18.
Gender: male 342 · female 128.

**Implication:** rich facets apply only to an enriched ~16–19% slice. The UX must be honest
about this rather than silently hiding heroes.

## Decisions

1. **Honest + adaptive filtering.** Always-available controls (publisher, popularity, A–Z,
   search) are primary. Rich facets (alignment, gender, has-powerstats) narrow the set
   transparently, with live counts so the trade-off is legible. Nothing hides silently.
2. **Filter set:** Publisher (All/Marvel/DC/**Other**), Alignment (Good/Bad/Neutral),
   Gender (Male/Female), Has-powerstats (toggle), Sort (Popular/A–Z/Power), plus existing
   search.
3. **Mobile UI:** clean header (search + "Filters" button with active-count badge);
   tapping opens a **bottom sheet** with all facet groups; active filters shown as removable
   chips under the header.
4. **Desktop UI:** **left filter sidebar (rail)** with facet groups + counts; hero grid fills
   the right column.
5. **One shared filter-state model** drives both rail and sheet.
6. **URL state:** filters serialize to query params (shareable, back-button friendly).
7. **Per-option facet counts in v1**, via a Postgres RPC (faceted-search semantics: each
   facet's counts reflect the *other* active filters, excluding its own selection).
8. **Power sort** = order by a new generated `powerstats_total` column (sum of the six stats);
   selecting it auto-enables Has-powerstats (only meaningful over heroes that have stats).
   `Has-powerstats` = `powerstats_total > 0`. Adding this column also fixes the pre-existing
   `getHeroesByPowerRange` bug, which already references a `powerstats_total` column that does
   not yet exist.

## Filter model

```ts
type CategoryFilters = {
  publisher: 'all' | 'marvel' | 'dc' | 'other';
  alignment: 'any' | 'good' | 'bad' | 'neutral';
  gender: 'any' | 'male' | 'female';
  hasStats: boolean;
  sort: 'popular' | 'az' | 'power';
  search: string;
};
```

### Category-aware facet visibility

Each slug defines a base query (the existing `switch` in `getCategoryPage`). Facets that are
redundant or empty for a slug are hidden:

| Slug | Hidden / forced |
|---|---|
| villain | hide Alignment (base already `alignment=bad`) |
| anti-heroes | hide Alignment (base `alignment=neutral`) |
| marvel / dc | hide Publisher (base already pins publisher) |
| strongest / most-intelligent | Has-powerstats implied; default Sort = Power |
| popular / xmen / most-iconic | all facets available |

Visibility is a single declarative map keyed by slug, consumed by both the rail and the sheet.

## URL state

`?publisher=marvel&alignment=bad&gender=female&stats=1&sort=az`

Defaults (`all` / `any` / `false` / `popular`) are omitted from the URL. State syncs via
expo-router `useLocalSearchParams` + `router.setParams`, matching the pattern already used in
`app/search.web.tsx`.

## Architecture / files

### Shared, platform-agnostic
- **`src/hooks/useCategoryFilters.ts`** — owns filter state ↔ URL sync, exposes setters,
  derived active-filter list, and a `reset`. No web/native-specific imports.
- **`src/lib/db/categoryFilters.ts`** — `CategoryFilters` type, per-slug facet-visibility
  config, filter→query-param (de)serialization, and the URL default-omission rules.
- **`src/lib/db/heroes.ts`** — extend `getCategoryPage(slug, filters)` to apply the full
  filter object (currently only `publisher/sort/search`). Add `getCategoryFacetCounts(slug,
  filters)` calling the RPC.

### Web UI — new `src/components/web/category/`
- **`FilterControls.tsx`** — single source of truth for rendering each facet group (radio
  groups, the toggle, the sort control). Used by **both** the rail and the sheet so they can
  never visually drift.
- **`FilterRail.tsx`** — desktop left sidebar wrapper around `FilterControls` + counts.
- **`FilterSheet.tsx`** — mobile slide-up bottom sheet wrapper around `FilterControls` with an
  "Apply · N results" footer.
- **`ActiveFilterChips.tsx`** — removable chips reflecting non-default filters.
- **`app/category/[slug].web.tsx`** — rewired:
  `width >= 768 ? <rail + grid> : <grid + Filters button + sheet>`. Reuses the existing
  (now bug-fixed) grid and infinite-scroll.

## Data layer

### Row fetch
`getCategoryPage(slug, filters)` builds the slug base query, applies publisher / alignment /
gender / hasStats / search, orders by sort (`popular`→issue_count desc, `az`→name,
`power`→sum of six stats desc), and returns `{ heroes, total }`. `total` (via `count: 'exact'`)
powers the live result count.

### Facet counts (Postgres RPC)
A `category_facet_counts` RPC returns a `jsonb` of per-option counts for each facet plus the
grand total. Each facet's counts are computed against the slug base + search + **other** active
facets (excluding the facet's own selection), so the numbers reflect what selecting an option
would actually yield.

Return shape:
```json
{
  "total": 130,
  "publisher": { "all": 130, "marvel": 60, "dc": 50, "other": 20 },
  "alignment": { "good": 0, "bad": 131, "neutral": 0 },
  "gender":    { "male": 90, "female": 40 },
  "has_stats": 70
}
```

The slug→base predicate is encoded inside the function. **Risk:** this duplicates the small
base-query logic that also lives in `getCategoryPage` (TS). Mitigation: keep the base predicate
list short and documented in both places, with a unit test asserting the TS base filters match
the slugs the RPC supports. (If drift becomes a problem later, promote the base predicate to a
SQL view both paths share — out of scope for v1.)

### Migration
New file `supabase/migrations/YYYYMMDDHHMMSS_category_facet_counts.sql` defining the RPC, applied
via `mcp__supabase__apply_migration`, then regenerate `src/types/database.generated.ts`
(per CLAUDE.md). The function is `stable`, `security definer` not required (read-only on
`heroes`, which is already publicly selectable for the app).

## Testing

Per CLAUDE.md — unit tests with mocked Supabase, no full-screen render tests:
- `categoryFilters` serialization round-trips (filters → params → filters), default omission.
- Per-slug facet-visibility map (villain hides alignment, marvel hides publisher, etc.).
- filter→Supabase-query mapping in `getCategoryPage` (correct `.eq`/`.ilike`/`.not`/order per
  filter combination) using a mocked query builder.
- `useCategoryFilters` setters + reset + power-sort-auto-enables-hasStats, with a mocked router.

## Out of scope (explicit)
- Native (`[slug].tsx`) filter UI — logic is extracted for a later port.
- Race / teams / movies / creators facets (data too sparse).
- Promoting the slug base predicate to a shared SQL view.
- The pre-existing `getHeroesByPowerRange` bug (references a non-existent `powerstats_total`
  column) — noted, not fixed here.
```
