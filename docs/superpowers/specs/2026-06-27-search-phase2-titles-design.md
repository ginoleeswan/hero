# Smarter Search — Phase 2: Titles (Films & Shows)

**Date:** 2026-06-27
**Status:** Approved design — follow-up to Phase 1
**Depends on:** `2026-06-27-smarter-search-universes-design.md` (Phase 1)

## Problem

Phase 1 makes search return universes + heroes in grouped sections via
`useUnifiedSearch`. The app also has a rich `titles` table (films & shows, TMDB
data) with a `/title/[id]` route, but nothing lets a user *search* for "Iron Man
(2008)" or "The Boys". Phase 2 adds titles as a third result section.

## Goals

- Typing a film/show name surfaces a **"Films & Shows"** section below heroes,
  each row → `/title/[id]`.
- Folds into the existing `useUnifiedSearch` hook as a third parallel query — no
  new orchestration surface.

## Non-goals

- No change to hero or universe behavior from Phase 1.
- No fuzzy/typo tolerance for titles in v1 — a straight `ILIKE` is enough.

## Architecture

Extends the Phase 1 client-side aggregation. The `titles` table already has the
columns we need (verified): `id` (text), `title`, `media_type`, `year`,
`poster_url`, `popularity`. A new `searchTitles(q)` does one `ILIKE` query
ordered by `popularity`; `useUnifiedSearch` runs it alongside universes + heroes.

### New / changed units

| Unit | Path | Responsibility |
| --- | --- | --- |
| `searchTitles(q, limit)` | `src/lib/db/titles.ts` (extend) | `select('id, title, media_type, year, poster_url').ilike('title', %q%).order('popularity', desc).limit(limit)`. Returns `TitleSearchResult[]`. |
| `TitleSearchResult` | `src/lib/db/titles.ts` | `{ id, title, media_type, year, poster_url }`. |
| `useUnifiedSearch` | `src/hooks/useUnifiedSearch.ts` (extend) | Add a debounced `titles` query; return `{ universes, heroes, titles, loading }`. |
| `TitleRow` (search) | `src/components/web/search/TitleResultRow.tsx` (new) | Poster thumbnail + title + `year · media_type` → `/title/[id]`. |
| `SearchDropdownContent` + results page | render a third **"Films & Shows"** section below heroes. |

### `searchTitles` rules

- Empty/whitespace query → `[]` (no browse-all for titles).
- `ILIKE '%q%'` on `title`, ordered `popularity` desc nulls last.
- Cap: **3** for the palette, **6** for the results page.

### Data flow (extends Phase 1)

```
useUnifiedSearch(q)
  ├─ searchUniverses(q)  → UniverseResult[]
  ├─ useHeroSearch(q)    → HeroSearchResult[]
  └─ searchTitles(q)     → TitleSearchResult[]   (new)
→ sections: Universes → Heroes → Films & Shows
```

## Error handling

- `searchTitles` failure → `[]` (same degradation as hero search); the other two
  sections still render.

## Testing

- `__tests__/lib/db/titles.test.ts` — `searchTitles`: builds the right query
  (mock supabase), empty query short-circuits to `[]`, maps rows to
  `TitleSearchResult`.
- Extend `__tests__/hooks/useUnifiedSearch.test.ts` — titles section populates;
  a titles failure leaves universes + heroes intact.

## Open questions

None — scope is small and the table is ready.
