# Category Page Redesign

**Date:** 2026-04-14  
**Status:** Approved for implementation

## Problem

The current category full-list page (`app/category/[slug].tsx`) is a flat, unsorted grid of all heroes in a category loaded at once. With categories ranging from 17 to 888 heroes, this creates three problems:

1. **Overwhelming** — a wall of cards with no entry point
2. **Boring** — no visual hierarchy or personality
3. **Too long** — no pagination; all heroes dumped at once

## Design

### Layout

```
┌─────────────────────────┐
│  ← Villains             │  ← Header (back + title)
├─────────────────────────┤
│  ┌─────────────────────┐│
│  │  FEATURED           ││  ← Featured hero banner (hidden during search)
│  │  Thanos             ││
│  │  Marvel · 2,793 iss.││
│  └─────────────────────┘│
│  🔍 Search villains…    │  ← Search bar
│  [Popular][A–Z]  [⚙ ·] │  ← Segmented sort + filter icon
│  89 villains · Marvel   │  ← Count label
├─────────────────────────┤
│  [card][card][card]     │  ← 3-column grid
│  [card][card][card]     │
│  ...infinite scroll...  │
└─────────────────────────┘
```

### Components

#### Featured Hero Banner
- Always the top hero by `issue_count` for the active filters
- Full-width card with cinematic image, name, publisher, and issue count
- Tapping navigates to `/character/[id]`
- Hidden when the search bar has text (search takes over the full screen)

#### Search Bar
- Debounced server-side query, 300ms delay
- Scoped to the current category slug (same filter logic as the grid)
- Clears with an `×` button when active
- While active: featured banner hides, count label reflects search results

#### Sort Control (Segmented)
- Two segments: **Popular** (default, ordered by `issue_count` DESC) and **A–Z** (ordered by `name` ASC)
- Switching resets pagination to page 1 and refetches

#### Publisher Filter Icon
- Funnel icon to the right of the segmented control
- Orange dot indicator when a non-default filter is active
- Tapping opens a bottom sheet with two sections:
  - **Sort by:** Popular · A–Z (mirrors the segmented control — they stay in sync)
  - **Publisher:** All (default) · Marvel · DC
- Sheet has an **Apply** button that closes the sheet and triggers a refetch

#### Count Label
- Shows live result count reflecting all active filters
- Format: `165 villains` → `89 villains · Marvel` → `2 results for "doc"`

#### Hero Grid
- 3 columns, same card style as current implementation
- **Infinite scroll:** 30 heroes per page; next page fetches automatically when user is within ~3 cards of the bottom
- Loading indicator (spinner row) while next page fetches

### Data Layer

All queries live in `src/lib/db/heroes.ts`. The existing `getAllHeroesBySlug` is replaced by a new paginated function:

```ts
getCategoryPage(
  slug: CategorySlug,
  options: {
    page: number         // 0-indexed
    pageSize: number     // default 30
    sort: 'popular' | 'az'
    publisher: 'all' | 'marvel' | 'dc'
    search: string       // empty string = no search
  }
): Promise<{ heroes: Hero[]; total: number }>
```

- `total` drives the count label
- Featured hero = first result of `getCategoryPage(slug, { page: 0, pageSize: 1, sort: 'popular', publisher, search: '' })`
- When search is active, the same `getCategoryPage` is called with the `search` param; featured hero is hidden

### State

The screen manages:
```ts
sort: 'popular' | 'az'           // default: 'popular'
publisher: 'all' | 'marvel' | 'dc' // default: 'all'
search: string                    // default: ''
pages: Hero[][]                   // accumulated pages
total: number                     // total matching count
loading: boolean                  // initial load
loadingMore: boolean              // pagination
filterSheetVisible: boolean
```

Changing `sort`, `publisher`, or `search` resets `pages` to `[]` and fetches page 0.

### Edge Cases

- **Empty results:** "No heroes found" empty state with a clear-filters button
- **Search with no results:** Same empty state, clear search button
- **Single page of results:** Infinite scroll silently stops (no "end" indicator needed)
- **Categories with no publisher split** (e.g. `popular`, `xmen`): Publisher filter still shown — Marvel/DC pills just return whatever heroes match

## Files to Change

| File | Change |
|---|---|
| `src/lib/db/heroes.ts` | Add `getCategoryPage()`, keep `getAllHeroesBySlug` for now (used by nothing after this) |
| `app/category/[slug].tsx` | Full rewrite to use new layout and paginated data |
| `app/category/[slug].web.tsx` | Mirror changes if it exists |

## Out of Scope

- Alphabetical section headers / jump list
- Saving filter preferences across sessions
- Changing card size or aspect ratio
