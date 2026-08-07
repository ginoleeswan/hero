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

Idle (empty-query) surfaces: recent searches, the Recently Viewed rail
(`useRecentlyViewed`), fame-ranked trending heroes via `useIdleHeroes` →
`getSearchIdleHeroes` (`src/lib/db/heroes/core.ts`), category pods, and — in
the web palette — `useIdleShowcase` (trending teams + films, cached once per
session).

Native (`app/(tabs)/search/index.tsx`) uses the iOS `Stack.SearchBar` plus
`Stack.Toolbar.Menu` filter menus (Publisher, Alignment).

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
