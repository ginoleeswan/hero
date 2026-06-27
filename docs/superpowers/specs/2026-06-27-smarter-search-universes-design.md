# Smarter Search — Mixed Results & Universe Search

**Date:** 2026-06-27
**Status:** Approved design — Phase 1 ready for planning

## Problem

Search today is **heroes-only**. The single `search_heroes` RPC
([core.ts:118](../../../src/lib/db/heroes/core.ts#L118)) matches hero
name / full_name / alias with typo tolerance, and powers two surfaces that share
the `useHeroSearch` primitive ([useHeroSearch.ts](../../../src/hooks/useHeroSearch.ts)):

- the web nav **command palette** (top 8 suggestions), and
- the dedicated **`/search?q=` results page** (infinite list + a coarse
  Marvel/DC/Other publisher filter).

Universes already exist as **data** — `PUBLISHER_BRANDS` in
[publishers.ts:88](../../../src/constants/publishers.ts#L88) is a registry of ~40
brands (Marvel, DC, **Mattel**, **Disney**, Nintendo, Star Wars…), each with a
`slug`, `name`, `match[]` substrings, `color`, and `logo`, each routing to
`/universe/[slug]`. But search never consults the registry, so typing "disney"
or "mattel" returns nothing useful. The user wants search to be **smarter**:
surface universes, return mixed result types, rank better, offer a richer idle
state, and feel faster.

## Goals

- Typing a universe name surfaces that universe **above** hero results, as a
  tappable brand chip → `/universe/[slug]`.
- Search returns **grouped, mixed result types** (Phase 1: universes + heroes;
  Phase 2 adds titles).
- Better cross-type ranking — an exact universe-name match floats to the top.
- Richer zero-query idle state — a "Browse universes" shortcut row.
- Snappier palette — keyboard navigation across sections.

## Non-goals

- No Postgres migration for universes — they stay a TypeScript registry
  (consistent with the existing publisher-branding model).
- Teams are **out of scope** (Phase 3, deferred) — they have no first-class
  searchable entity today (only `hero_relationships.is_teammate` edges).

## Architecture

**Approach: client-side aggregation.** Keep `search_heroes` untouched. Add a
pure registry search for universes (zero DB, instant) and — in Phase 2 — a light
`titles` query. A new orchestration hook fans the queries out in parallel and
returns grouped sections; both surfaces render those sections.

Rejected alternatives:
- *Server-side unified RPC* — would force universes into a DB table, duplicating
  the TS registry and adding a migration, for no real gain.
- *Hybrid RPC* — same downside for marginal benefit; the registry is tiny and
  fuzzy-matches fine in JS.

### New / changed units

| Unit | Path | Responsibility |
| --- | --- | --- |
| `searchUniverses(q)` | `src/lib/db/universes.ts` (new) | Pure fuzzy match over `PUBLISHER_BRANDS`. Returns `UniverseResult[]`. No DB. |
| `useUnifiedSearch(q)` | `src/hooks/useUnifiedSearch.ts` (new) | Orchestrates universe + hero search (debounced), returns `{ universes, heroes, loading, resultCount }`. Wraps `useHeroSearch`. |
| `UniverseChip` | `src/components/web/search/UniverseChip.tsx` (new) | Brand chip (logo/wordmark + name + accent) → `/universe/[slug]`. |
| `SearchDropdownContent` | [SearchDropdownContent.tsx](../../../src/components/web/search/SearchDropdownContent.tsx) | Render a "Universes" section above the hero suggestions; consume `useUnifiedSearch`. |
| Results page | `app/(tabs)/search/index.web.tsx` + `index.tsx` | Render the "Universes" section above the hero list; idle "Browse universes" row. |
| `SearchPalette` | [SearchPalette.tsx](../../../src/components/web/search/SearchPalette.tsx) | Keyboard arrow-nav + Enter-to-open across sections; placeholder copy → "Search heroes & universes…". |

### Types

```ts
// src/lib/db/universes.ts
export interface UniverseResult {
  slug: string;
  name: string;
  color: string;
  logo?: BrandLogo;        // reuse PublisherBrand.logo
  badgeSize?: { width: number; height: number };
  logoOnLight?: boolean;
  exact: boolean;          // exact name/match hit → ranks first
}
```

### `searchUniverses(q)` matching rules

Normalize with the same `norm()` used by `rankResults` (lowercase, strip
spaces/`-`/`_`/`.`). For each `PUBLISHER_BRAND`:

1. **exact**: normalized `q` equals normalized `name` or any `match[]` entry → `exact: true`, rank 0.
2. **prefix**: normalized `name` or a `match[]` entry starts with `q` → rank 1.
3. **contains**: normalized `name`/`match[]` includes `q` → rank 2.

Sort by rank, then by registry order (already priority-ordered). Return at most
**3** universes for the palette, **6** for the results page. Empty/whitespace
query → `[]`.

### Data flow

```
query string
  └─ useUnifiedSearch(q) [debounced 250ms]
       ├─ searchUniverses(q)        → UniverseResult[]  (sync, in-memory)
       └─ useHeroSearch(q, 'All')   → HeroSearchResult[] (search_heroes RPC)
  → { universes, heroes, loading, resultCount }
       └─ SearchDropdownContent / results page render sections:
            [Universes]  → UniverseChip → /universe/[slug]
            [Heroes]     → existing SuggestionsList rows → /character/[id]
```

Universes resolve synchronously, so they paint instantly while heroes stream in
behind the debounce — search feels faster with no extra round trip.

### Ranking across types

Section order is fixed: **Universes → Heroes** (→ Titles in Phase 2). Within
universes, exact match first. The intent: "disney" shows the Disney universe at
the very top while still listing Disney-affiliated characters below. Heroes keep
the existing `rankResults` ordering unchanged.

### Idle / empty state

When the query is empty, both surfaces show, in order:
1. **Browse universes** — a horizontal chip row of `FEATURED_PUBLISHERS`
   (Marvel, DC, Image, Dark Horse) reusing `UniverseChip`.
2. Existing **trending heroes** (`useIdleHeroes`).
3. Existing **recent searches** (`useSearchHistory`).

### Palette keyboard navigation

Track a flat highlight index across the rendered sections (universes then
heroes). `ArrowDown`/`ArrowUp` move it (wrapping), `Enter` opens the highlighted
item (universe → `/universe/[slug]`, hero → `/character/[id]`), falling back to
the existing "commit query to results page" when nothing is highlighted.
`Escape` still closes (unchanged).

## Error handling

- `searchUniverses` is pure and total — no failure path.
- Hero search failure already degrades to `[]` in `useHeroSearch`; universes
  still render, so a DB hiccup never blanks the whole palette.

## Testing

Per repo convention (pure logic / hooks only, mocked Supabase):
- `__tests__/lib/db/universes.test.ts` — `searchUniverses`: exact beats prefix
  beats contains; "disney"/"mattel" resolve to the right slug; alias/`match[]`
  hits ("dc comics" → `dc`); empty query → `[]`; result caps (3 / 6).
- `__tests__/hooks/useUnifiedSearch.test.ts` — merges universe + hero results,
  debounces, exposes `loading`/`resultCount`; hero failure leaves universes
  intact.
- No screen/render tests (per CLAUDE.md).

## Phasing

**Phase 1 (this spec):** universes + heroes mixed sections, ranking, idle
"Browse universes", palette keyboard nav. No migration.

**Phase 2 — Titles:** `searchTitles(q)` over the `titles` table
(`title ILIKE`, ordered by `popularity`); a "Films & Shows" section →
`/title/[id]`. `titles` already has `title` / `year` / `poster_url` /
`popularity` columns and a route. Folds into `useUnifiedSearch` as a third
parallel query and a third section.

**Phase 3 — Teams (deferred):** needs its own brainstorm — decide whether to tag
team-type heroes or build a teams view before they can be searched.

## Open questions

- Show a hero count on each universe chip? Nice-to-have; needs a count query per
  universe (or a cached map). Default: **omit in Phase 1**, revisit if the chip
  looks bare.
