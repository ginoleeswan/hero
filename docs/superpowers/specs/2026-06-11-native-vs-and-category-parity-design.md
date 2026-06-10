# Native parity: VS page + category filters

**Date:** 2026-06-11
**Status:** Approved (design)

## Goal

Close two native-vs-web parity gaps surfaced by a parity audit:

1. **VS page** (`app/compare/[hero]/[opponent].tsx`) is missing the relationship
   `MatchupBadge` and the inline "Share result" affordance that web mobile shows.
2. **Category screen** (`app/category/[slug].tsx`) exposes only `sort` (Popular /
   A–Z) and `publisher` filters; web also exposes `alignment`, `gender`,
   `power-stats`, a `Power` sort option, per-category facet gating, and facet
   counts.

Both are **UI-only** changes. The data + query layer (`getCategoryPage`,
`getCategoryFacetCounts`, `categoryFilters.ts`) already supports every facet and
count; native simply never varies them. No DB, migration, or query changes.

## Audit context (for the record)

Every web route already has a native counterpart, so there are no missing
screens — only feature-richness gaps. Remaining known gaps **not** in this scope
(left as a future roadmap): the Discover/Explore home magazine sections, the
two-slot matchup builder (`compare/pick`, an intentional web-only stub), the 3
extra picker category rows, and possible search history/idle suggestions.
Character / biography / profile / auth screens are at content parity (web
differences are chrome only).

## Piece 1 — VS page parity

**File:** `app/compare/[hero]/[opponent].tsx`

Changes (mirrors the web mobile layout in `[opponent].web.tsx`):

- Import `useRelationship` (`src/lib/query/heroQueries`) and `relationshipBadge`
  (`src/lib/db/heroes`); compute `const badge = relationshipBadge(relationship)`.
- Import `MatchupBadge` (`src/components/compare/MatchupBadge`) — already
  cross-platform (RN primitives; web-only `backdropFilter` behind `Platform.select`).
- Render `<MatchupBadge badge={badge} style={{ marginTop, marginBottom }} />`
  between the `ClashPortraits` card and the `VerdictReveal` block, matching web's
  placement. Renders nothing when the two heroes have no recorded relationship,
  so non-rival matchups are unaffected.
- Add an inline "Share result" pill inside the verdict block, reusing the
  existing `handleShare` (native `Share.share`). Keep the existing header-share
  button. Style it to read on the navy stage (muted beige pill), consistent with
  the rest of the native screen's styling conventions (no web-only `cursor` /
  `hover` / `boxShadow`).

No new components or hooks. No behavioural change to stats, portraits, swap, or
navigation.

## Piece 2 — Category filters parity

**File:** `app/category/[slug].tsx` (plus a small facet-counts fetch)

**Approach:** Extend the existing native `Stack.Toolbar.Menu` pull-down — the
iOS-native equivalent of web's `FilterRail`/`FilterSheet`. No bottom sheet, no
ported web components.

### State

Replace the two local `useState`s (`sort`, `publisher`) with the full
`CategoryFilters` shape so all facets flow into the existing query:

- Hold `filters` as local state seeded from `DEFAULT_FILTERS` with
  `sort: defaultSort(slug)` (so `strongest` / `most-intelligent` default to
  `power`, matching web).
- A `setFilter(key, value)` updater (local only — native needs no URL sync,
  unlike web's `useCategoryFilters`). Applies the same `sort === 'power' ⇒
  hasStats: true` coupling web uses.
- Keep the debounced `search` wiring as-is, folded into the `filters` memo.
- `useCategoryHeroes(categorySlug, filters)` is unchanged — it already consumes
  the full filter object.

### Menu structure

Drive visible facets from `visibleFacets(slug)` so each category shows only its
relevant facets (e.g. villains hide Alignment, Marvel/DC hide Publisher,
strongest/most-intelligent hide Power-stats). Build the toolbar menu as inline
submenus, each with `isOn` checkmarks:

- **Sort** — Popular / A–Z / Power
- **Publisher** — All / Marvel / DC / Other  (when visible)
- **Alignment** — Any / Good / Bad / Neutral  (when visible)
- **Gender** — Any / Male / Female  (when visible)
- **Power stats** — Any / Rated only  (when visible)

The toolbar icon uses the filled variant
(`line.3.horizontal.decrease.circle.fill`) when **any** facet is non-default
(reuse `activeFilterList(slug, filters).length > 0` plus a non-default-sort
check), otherwise the outline variant. Add a **Reset** action at the bottom of
the menu when any filter is active.

### Facet counts

Append counts to menu labels (e.g. `Good (1,832)`), since the iOS menu can't show
a separate count column:

- Fetch via `getCategoryFacetCounts(categorySlug, filters)` in an effect keyed on
  `filters`, stored in local `counts` state (same pattern as web's effect).
- Labels render counts when `counts` is loaded and `> 0`; otherwise fall back to
  the bare label. Counts are best-effort — a failed fetch leaves labels bare,
  never blocks filtering.

### Eyebrow

Extend the existing navy-stage `eyebrow` to reflect active facets the way it
already does for publisher (e.g. append `· GOOD`, `· MALE`, `· RATED`), keeping
it short. Optional polish, not required for parity.

## Out of scope

- Desktop "arena" two-column compare layout (web-only by design).
- Active-filter chip row under the header (web affordance; the iOS filled menu
  icon + eyebrow signal active filters instead).
- URL param sync on native.
- The future roadmap gaps listed under "Audit context".

## Testing

Both pieces are presentational wiring over already-tested data/query/filter
layers (`categoryFilters` parsing, `getCategoryPage` filtering, `MatchupBadge`
rendering). No new pure logic is introduced that warrants unit tests; per project
convention we do not test full-screen rendering or navigation. Verification is
manual: launch the app, open a rivalry matchup (badge shows) and a non-rival one
(no badge); open several categories and confirm the correct facets appear,
filter, and update counts.
