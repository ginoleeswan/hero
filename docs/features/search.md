# Search

> How search works end to end: the `search_heroes` RPC and its fame-primary
> ranking, the unified five-section layer, the Spotlight-style top result, and
> the client caches that make typing feel instant. Read this before changing
> ranking, adding a searchable type, or debugging "why does X outrank Y".

## Mental model (read this first)

Hero search is **one RPC over one column**: `search_heroes` filters a
generated `heroes.search_text` column (name + full_name + aliases, lowercased,
STORED) with a single GIN **trigram** index. The predicate is
`search_text LIKE '%q%' OR search_text % q`. It is **not** tsvector full-text
search — there is no stemming, no phrase search, no word-boundary logic, and
adding any of those means changing the index strategy, not tuning constants.

Ranking is **fame-primary**: the match tier sets a base score, then
`fame_score * 20` dominates within and across tiers, so a famous prefix match
beats an obscure exact-name homonym ("spider" → Spider-Man, not eight nobodies
named "Spider"). Everything above the RPC — sections, top result, caches — is
client-side composition and **trusts the RPC's order**; re-ranking client-side
would undo the fame blend.

| Match tier | Base |
| --- | --- |
| Exact name | 300 + fame×20 |
| Name prefix | 200 + fame×20 |
| Name contains | 120 + fame×20 |
| full_name/alias exact-or-prefix | 80 + fame×20 |
| Everything else (trigram-only) | 20 + **fame×6** |

Ties break on `fame_score`, then `issue_count`, then `id`. Note the last tier's
weaker fame weight — that's `20260627220000_demote_hidden_field_search_matches.sql`,
which stopped "bat" surfacing Billy Batson and "Battling Bowman" near the top
with no visible reason. Strong hidden-field matches stay reachable ("bruce
wayne" → Batman); weak substrings sink.

Two more load-bearing migrations:
`20260628120000_search_text_column_and_fame_primary_ranking.sql` (the column,
the index, the blend) and `20260708150000_browse_fame_index_fast_empty_search.sql`
— the Search tab and opponent picker open on an **empty query**, which used to
be a 6.7 s seq-scan because the ranking CASE is non-indexable. The RPC is now
plpgsql with an explicit empty branch: plain
`fame_score, issue_count, id` order served by the partial
`heroes_browse_fame_idx` (~3 ms), junk publishers excluded. Real searches keep
the CASE. Keep the branch — a single SQL body can't make the planner prove the
CASE constant.

## The unified layer

`src/hooks/useUnifiedSearch.ts` fans one query out to five sections, in
display order: **universes, houses, teams, heroes, titles**. Houses sit high
because "targaryen" means the dynasty, not the fifty-five characters sharing
the surname.

| Section | Source | How |
| --- | --- | --- |
| Universes | `searchUniverses` (`src/lib/db/universes.ts`) | in-memory `PUBLISHER_BRANDS` registry (`src/constants/publishers.ts`) — synchronous, no network |
| Houses | `searchHouses` (`src/lib/db/houses.ts`) | surname-aware: matches the bare surname as well as the stored "House X" style |
| Teams / Titles | `searchTeams` / `searchTitles` | 180 ms debounced queries |
| Heroes | `useHeroSearch` → `search_heroes` RPC | see caching below |

## The top result

`src/lib/search/topResult.ts` picks the one Spotlight-style answer — **only
when confident**, so vague fragments never get a presumptuous guess. Priority:
exact universe > exact house > exact team > exact title (when no confident
hero) > confident hero. A hero is confident on an exact name match, or a
prefix match with `fame_score >= 50` (`HERO_TOP_FAME_MIN`). Otherwise
`pickTopResult` returns null and the UI just shows grouped sections.
`TopResult` is a discriminated union on purpose — adding a variant makes the
compiler name every switch that needs the new case. Keep it a union.

## Client caching and pagination

`src/hooks/useHeroSearch.ts` is the single debounced primitive (results page
and palette both ride it). Feels-fast rules: an 80-entry FIFO session cache
returns **synchronously** on a hit (retyping/backspacing never re-fetches);
on a miss the **previous results stay visible** while the new query resolves —
no per-keystroke skeleton flash. Debounce is 180 ms, 300 ms for the palette
path (`src/hooks/useSearchSuggestions.ts`).

The paginated grid uses `searchHeroesPage` +
`useHeroSearchInfinite` (`src/lib/query/heroQueries.ts`) with
`placeholderData: keepPreviousData`. Publisher/browse pages are prefetched
on `onPressIn` via `src/lib/query/prefetchBrowse.ts` — its query keys must
match the page hooks **exactly** (React Query hashes by value), and it warms
the first grid images too.

**Nothing may page while the screen is idle.** `loadMore` returns early on
`isIdle`, and the footer spinner is gated on `!isIdle` as well. This is not
belt-and-braces fussiness — it is the fix for a live loop. When idle, `listData`
is deliberately `[]` (the pods are the doorway, not a "Popular" wall), so the
list's entire content is its header and the user sits permanently inside
`onEndReachedThreshold`. VirtualizedList re-arms `onEndReached` whenever content
length changes, and the footer spinner mounting/unmounting changes it every
cycle: fetch → footer appears → re-arm → fetch. The visible symptom was a
spinner below the pods that never stopped; the invisible one was the app paging
through all ~34k heroes in the background, for rows nothing would ever render.
`getNextPageParam` is a length heuristic with no count cap, so `hasNextPage`
stays true for hundreds of pages and cannot break the loop on its own.

Filters: publisher + alignment are **server-side** arguments to
`search_heroes` (so pages stay correctly filled). Category pages have much
richer facets — `src/lib/db/categoryFilters.ts` + the `category_facet_counts`
RPC (`src/lib/db/heroes/categories.ts`) — search itself deliberately does not.

## History, idle state, and platform UI

Search history is a platform pair: `useSearchHistory` (web, localStorage) and
`useRecentSearches` (native, AsyncStorage). Both run entries through
`tidySearchHistory` (exported from `src/hooks/useSearchHistory.ts`), which
collapses typing prefixes so "spi", "spide", "spider" store as one entry.
On native, a term is recorded on the keyboard Search button **and on tapping
any result** (card, top result, or a section row) — tap-through is the common
path, and recording only on the rarely-pressed Search key left Recent empty.

Idle (empty-query) surfaces: the Recently Viewed rail (`useRecentlyViewed`),
recent searches, category pods, publisher tiles, fame-ranked trending heroes
via `useIdleHeroes` → `getSearchIdleHeroes` (`src/lib/db/heroes/core.ts`), and
— in the web palette — `useIdleShowcase` (trending teams + films, cached once
per session).

**Recently Viewed works signed out.** `user_view_history` is keyed on
`user_id`, so every read used to require an account — and browsing this
catalogue never has. A logged-out reader who went through twenty characters
got an empty rail on Explore and an empty Search landing: the app declining to
remember what it had just shown them. `recordView` now mirrors every view to a
local ordered id list regardless of session, and `getRecentlyViewed` merges
local ahead of server (local is authoritative about the last few seconds, the
server about the last few months, and ids are deduped across the two). A failed
server read degrades to the local list rather than throwing — losing the rail
because the durable half was unreachable would waste the half that never is.
Order survives hydration explicitly, because PostgREST returns `in()` rows in
whatever order it likes and a recently-viewed rail with arbitrary order is not
one.

**The idle order is history → shortcut → content.** Recently Viewed, recent
queries, the Universes rail, then the browse pods.

`PublisherGrid` takes `layout="rail"` here rather than its Explore grid, and
that is what resolves the ordering question rather than answering it. As a
two-row tile grid, Universes forced a choice between burying it under eight
pods — a long scroll for a one-tap intent — and putting it above them, which
pushes the richest content below the fold. As a rail it costs one row, so it
sits high AND leaves the pods where they can be seen. Neither had to lose.

**Label a section only when the content does not say what it is.** "Recent"
marks a list of chips as YOUR history; "Universes" tells you the logos are
publishers. Tiles reading Villains, Anime and Video Games are already their own
label, and "Browse" named the activity of the whole screen rather than those
eight things — so that header is gone and the boundary it was really providing
is space.

**The pods stay a GRID, deliberately.** A horizontal rail would show two or
three of eight categories and hide the rest behind a gesture, on a screen whose
job is showing someone their options when they do not yet know what they want.
It would also blur the two tabs into each other: Explore is a magazine built of
rails and read by scrolling; Search is a directory, scanned. The rails here are
for things with an inherent order (your history) or a handful of items (four
publishers) — not for a closed set you want to survey.

**There is no "Search" title.** The tab is called Search, the placeholder says
what to type, and on iOS 26 the field is pinned to the BOTTOM — so a 38pt
heading at the top spent the screen's best space naming the room from the far
end of it.

Native (`app/(tabs)/search/index.tsx`) uses the iOS `Stack.SearchBar`. **The
filters are `FilterChips` rows in the CONTENT, on every platform, shown only
with results.**

They were an iOS-only `Stack.Toolbar` of two unlabelled glyphs — a books stack
and theatre masks — pinned to the top-right of the native header, and that was
three problems in one control. Nobody decodes those icons; nothing showed which
filter was active, so a narrowed result set looked identical to a complete one;
and once the "Search" title was removed the header collapsed to its minimum and
carried the toolbar up against the status bar, where it read as floating debris
rather than as part of the screen. Moving to the chips Android and web already
used fixes all three at once — named options, visible selection, and a position
this file controls — and removes the `Stack.Toolbar` from a native header with a
documented history of fragility. They render only when there are results,
because idle suppresses the hero list and there is nothing to filter.

**The empty state points at the actual cause.** "Try a different search or
filter" was shown whether or not a filter existed: useless advice in the common
case, and where a filter WAS narrowing the search it pointed at two unlabelled
glyphs instead of fixing it. A filter is by far the likeliest reason a name that
exists returns nothing, so when one is on the empty state names it and offers
"Search everything" — one tap, both filters cleared. With no filter on it says
nothing about filters and suggests a shorter name or a different spelling.

**The search field is bottom-aligned, and that is deliberate.** The Search tab
declares `role="search"` (`app/(tabs)/_layout.tsx`), which is Apple's
recommended shape for a tabbed app on iOS 26: the search tab draws as its own
circular button, and selecting it morphs that circle into a field at the bottom
of the screen, reachable one-handed and animating up over the keyboard.

Three things have to line up or the field **fails silently — visible but
impossible to type into**:

1. `role="search"` on the tab trigger.
2. A navigation stack inside the tab (`app/(tabs)/search/_layout.tsx`).
3. `Stack.SearchBar` with `placement` left at **`automatic`**.

**Do not set `barTintColor`.** It is the search *field's* background colour,
and on the iOS 26 bottom-aligned field it paints an opaque rectangle behind the
Liquid Glass capsule — the rounded corners then show grey square shoulders. The
system material renders a legible dark field over this screen on its own.

Point 3 is the one that bit. The placement was `stacked` (field pinned under
the header) and the whole search tab was dead for a release.
`react-native-screens` documents the cause on `allowToolbarIntegration`: *"When
placement is set to `stacked`, this property's value will be overridden with
`false`."* Toolbar integration is the channel the search-role tab uses to hand
its field to the search bar, so `stacked` cuts the wire — the tab bar still
renders the pill, because that is the role rather than anything we draw, and
tapping it does nothing. **Never set `placement="stacked"` while the tab carries
`role="search"`.** Its
screen debounce is 250 ms with two feel rules: **clearing flushes
immediately** (the idle surface must not coexist with the old query's
sections), and the **settle gap shows the skeleton grid** — the beat between
the first keystroke and the debounced query landing used to render a blank
screen. Web
(`index.web.tsx`) is driven by the TopBar's `?q=` URL param — the input
commits to the URL after 300 ms, and the page renders from the URL, so results
are linkable and back/forward work. Both screens must exist (expo-router
platform-pair rule) and both render from the same hooks.

## Analytics: length only, never the term

One `'search'` event per **settled** query — debounced 900 ms on the trimmed
string, ignoring queries under 2 chars — carrying only
`{ length: trimmed.length }`. This is a privacy stance, not an oversight:
search terms are never sent to analytics. Keep it that way when touching
`useUnifiedSearch`.

## Map

| Concern | Path |
| --- | --- |
| RPC + ranking | `search_heroes` — current body in `supabase/migrations/20260708150000_browse_fame_index_fast_empty_search.sql` |
| RPC client wrapper | `src/lib/db/heroes/core.ts` (`searchHeroes`, `searchHeroesPage`, `getSearchIdleHeroes`) |
| Unified sections | `src/hooks/useUnifiedSearch.ts` |
| Debounce + session cache | `src/hooks/useHeroSearch.ts` |
| Top result | `src/lib/search/topResult.ts` |
| Infinite grid + prefetch | `src/lib/query/heroQueries.ts`, `src/lib/query/prefetchBrowse.ts` |
| History | `src/hooks/useSearchHistory.ts` (web), `src/hooks/useRecentSearches.ts` (native) |
| Screens | `app/(tabs)/search/index.tsx` / `.web.tsx` |
| Web palette | `src/components/web/search/` (`SearchPalette`, `SearchDropdownContent`) |

## History

Historical specs (status lines in them may be stale):
`docs/superpowers/specs/2026-06-07-search-screen-native-redesign-design.md`,
`docs/superpowers/specs/2026-06-27-search-ranking-design.md`,
`docs/superpowers/specs/2026-06-27-smarter-search-universes-design.md`,
`docs/superpowers/specs/2026-06-27-search-phase2-titles-design.md`,
`docs/superpowers/specs/2026-06-27-search-phase3-teams-design.md`,
`docs/superpowers/specs/2026-06-27-hero-popularity-fame-score-design.md`.
