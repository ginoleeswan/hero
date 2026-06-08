# Search Screen — Native iOS Redesign (Dark Navy Glass)

**Date:** 2026-06-07
**Status:** Approved design, ready for implementation planning
**Scope:** Native (`app/(tabs)/search.tsx`) only. Web (`search.web.tsx`) is preserved unchanged.

## Goal

Rework the native Search tab so it (a) uses the **genuine iOS `UISearchController`** native search bar — "as native as possible" — and (b) visually matches the arena / pick pages by becoming a **dark navy glass** surface. Inspiration: the Apple Games app's search screen (native large-title + search field, scope bar, frosted glass cards over a dark canvas).

The existing result cards (`PortraitCard`, 2-up grid) are kept as-is — only the shell around them changes.

## Design decisions (locked)

1. **Real native search bar**, not a custom lookalike. Use `headerLargeTitle: true` + `headerSearchBarOptions` from `react-native-screens` (via expo-router's `Stack`). iOS renders the true `UISearchController`; Android renders its native equivalent.
2. **Dark navy glass canvas.** Search becomes the only dark tab — a deliberate, focused "command surface" unified with the navy arena/pick pages.
3. **Publisher filter is a custom scope row,** not native scope buttons. `react-native-screens@4.23` `SearchBarProps` exposes **no scope-bar API** (verified: `barTintColor`, `tintColor`, `textColor`, `hintTextColor`, `placeholder`, `placement`, `hideWhenScrolling`, `obscureBackground`, `autoCapitalize`, `cancelButtonText`, `onChangeText`, `onFocus`, `onCancelButtonPress` — and nothing for scopes). So All / Marvel / DC / Other render as a custom Apple-style segment row pinned just below the header — which matches where Apple Games places its scope bar anyway.
4. **Route restructured into a nested native Stack** to host the header search bar (the tab has no header today).
5. **Existing `PortraitCard` grid kept.** Density unchanged (2 columns).

### Explicitly out of scope

- "Trending Matchup" featured card (idle-state hook) — phase 2.
- "Fight" CTA on result cards — long-press peek already offers Fight.
- Any web changes.

## Architecture

### Route restructure

`app/(tabs)/search.tsx` (single screen) becomes a folder:

```
app/(tabs)/search/
  _layout.tsx        Native Stack — navy header, large title, headerSearchBarOptions
  index.tsx          The search screen (dark body, scope bar, rails, grid)
  index.web.tsx      = today's search.web.tsx, moved verbatim (web keeps custom search)
```

- The `NativeTabs.Trigger name="search"` in `app/(tabs)/_layout.tsx` continues to resolve to the `search` route (now a folder with a layout) — no change needed there.
- `_layout.tsx` renders a `Stack` with a single screen. On web the native header search is unavailable; `index.web.tsx` keeps the existing custom web search UI. If the Stack header causes issues on web, add `_layout.web.tsx` rendering a headerless `Stack`. (Confirm during implementation; web is otherwise untouched.)

### Header configuration (`_layout.tsx`)

`Stack.Screen` options for the search screen:

- `headerLargeTitle: true`, `title: 'Search'`
- `headerStyle: { backgroundColor: <deep navy> }`, `headerShadowVisible: false`
- `headerLargeTitleStyle: { color: COLORS.beige, fontFamily: 'Flame-Bold' }` (confirm custom font renders in the native large title; if iOS rejects the custom font, fall back to system and revisit)
- `headerTintColor: COLORS.beige`
- `headerSearchBarOptions`:
  - `placeholder: 'Hero, villain, or real name…'`
  - `barTintColor`: dark glass field fill (e.g. `rgba(245,235,220,0.12)`)
  - `textColor: COLORS.beige`, `hintTextColor: 'rgba(245,235,220,0.5)'`
  - `tintColor: COLORS.orange` (cursor + cancel accent)
  - `hideWhenScrolling: false` (keep search reachable — matches Apple Games; one-line toggle if the team prefers the classic collapse)
  - `onChangeText`: pushes text into screen query state
  - `onCancelButtonPress`: clears query state

**Query wiring:** the screen owns `query` state. `headerSearchBarOptions` is defined where it can call `setQuery` (either inline in `_layout` via a shared store/context, or set on the screen through `navigation.setOptions` in `index.tsx`). Preferred: define `headerSearchBarOptions` in `index.tsx` via `useLayoutEffect(() => navigation.setOptions({ headerSearchBarOptions: {...} }))`, so `onChangeText` closes over the screen's `setQuery` directly. The existing 300ms `useDebounce` + `searchHeroes`/`rankResults` pipeline is unchanged.

### Status bar

Search tab uses light status bar content (dark header). Set via the Stack screen / `StatusBar` for this route. Other tabs (beige) are unaffected because the dark styling is scoped to this nested stack.

## The screen body (`index.tsx`)

Dark navy canvas (`#1a262b`, slightly deeper than `COLORS.navy`) with a warm radial **orange top-glow** behind the content. Layout, top → bottom:

1. **Scope bar (pinned below header).** Custom `ScopeBar` — All / Marvel / DC / Other as Apple-style segments: active = solid beige pill (navy text), inactive = faint glass (`expo-blur` or translucent fill) with beige text. Drives the existing `PublisherFilter` state. Implemented as a sticky element so it stays put while the grid scrolls (e.g. list header with `stickyHeaderIndices`, or rendered outside the scroll above the `FlatList`).
2. **Scrolling body** (`FlatList`, 2 columns, existing data flow):
   - **Idle (no query):**
     - **Recently Viewed** — `AccentRail`: gold sword-rail header (⚔ + gold label + hairline bar) + horizontal thumb row. Hidden when there is no recently-viewed data.
     - **Popular** — gold-eyebrow label + 2-col `PortraitCard` grid (the `getSearchIdleHeroes` set).
   - **Typing (query present):** result-count label ("N results") + 2-col `PortraitCard` grid (`searchHeroes` + `rankResults`). Rails hidden.
   - **Empty:** restyled for dark canvas — beige-on-navy headline + sub, orange search-outline icon in a translucent circle.
   - **Loading:** skeletons styled for the dark canvas.

All press / long-press behavior (navigate to character, `HeroPeek` long-press → Fight / View Profile) is preserved.

## Components

| File | Change |
| --- | --- |
| `app/(tabs)/search.tsx` | **Delete** — replaced by the `search/` folder. |
| `app/(tabs)/search/_layout.tsx` | **New** — native `Stack`, navy header, `headerSearchBarOptions`. |
| `app/(tabs)/search/index.tsx` | **New** — reworked dark-navy screen (body, scope bar wiring, rails, grid, query state). |
| `app/(tabs)/search/index.web.tsx` | **Moved** from `search.web.tsx`, verbatim. |
| `src/components/search/ScopeBar.tsx` | **New** — Apple-style publisher scope segments (`expo-blur` frost on dark canvas). |
| `src/components/search/AccentRail.tsx` | **New** — shared gold sword-rail header + horizontal thumb row. Extracts the pattern currently inline in `app/compare/[hero]/pick.tsx`; pick.tsx is refactored to consume it (no visual change there). |
| `src/components/search/PortraitCard.tsx` | **Modify** — add a faint light hairline edge (`boxShadow: '0 0 0 1px rgba(245,235,220,0.08)'` or equivalent) so navy cards separate from the dark canvas. Behind a prop (`onDark`) so web/idle uses elsewhere are unaffected. |

### Dependency

- `yarn expo install expo-blur` — not currently installed. Used for the scope bar (and any frosted panels) to get the authentic Apple Games frost. If `expo-blur` proves problematic, fall back to a translucent solid fill (`rgba`) — acceptable on a dark canvas.

## Data / logic

No changes to the data layer. Reuses:

- `searchHeroes`, `rankResults`, `getSearchIdleHeroes`, `PublisherFilter` (`src/lib/db/heroes.ts`)
- `getRecentlyViewed` (`src/lib/db/viewHistory.ts`)
- `useDebounce` (300ms), `useAuth`, `HeroPeek`

## Risks / things to confirm during implementation

1. **Custom font in native large title.** `headerLargeTitleStyle.fontFamily: 'Flame-Bold'` may or may not apply in the native large title. If it doesn't render, accept the system font for the large title (still native) or revisit.
2. **`hideWhenScrolling: false` + large title interaction.** Confirm the pinned-search + large-title combination behaves well; toggle to `true` if the collapse feels better.
3. **Web nesting.** Confirm the nested `Stack` doesn't disrupt the existing web search; add `_layout.web.tsx` if needed.
4. **Native Tabs + nested Stack.** Confirm the `search` folder layout still mounts correctly under `NativeTabs.Trigger name="search"`.
5. **Scope bar stickiness** under a large-title header that collapses — verify the custom scope row sits correctly relative to the collapsing nav bar.

## Success criteria

- Tapping the Search tab shows a large "Search" title and the **native iOS search bar**; typing filters the existing hero results live.
- Header + body read as a cohesive **dark navy glass** surface consistent with the arena/pick pages.
- All / Marvel / DC / Other scope row filters results (custom row, below the native bar).
- Recently Viewed (gold sword-rail) and Popular sections appear when idle; results grid appears when typing.
- Existing `PortraitCard` press / long-press behavior unchanged.
- Web search is unaffected.
