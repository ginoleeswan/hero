# Explore feed and the Pulse

> How the Explore/Home surface is assembled: the one-RPC bundle that feeds it,
> the typed row feed both platforms render, the four freshness engines, and the
> Pulse — the ranked "just happened" rail with its live-event takeover. Read
> this before adding a row to Explore, touching `get_explore_bundle`, or tuning
> what the Pulse shows.

## Mental model (read this first)

Explore is **one anonymous payload plus a thin personalised fringe**. Everything
a logged-out visitor sees arrives in a single `get_explore_bundle` RPC round
trip, served from a precomputed cache. Only three things sit outside it: the
Pulse candidates, the daily-matchup verdict, and the auth-keyed personalised
rows. If you're adding data to the page, the default answer is "fold it into
the bundle", not "add a fetch".

The page itself is a flat, chaptered list of typed rows — a magazine, not a
dashboard. Data lives in one platform-neutral hook (`useExploreData` in
`src/lib/query/exploreQueries.ts`); `app/(tabs)/explore.tsx` (native, a typed
FlatList) and `app/(tabs)/explore.web.tsx` are presentation only.

## The bundle

`get_explore_bundle(p_browse_slugs)` replaced a ~15-request fan-out that
intermittently exhausted the DB connection pool — synchronized 500s, and any
fetcher that swallowed its error cached partial rows as "success". One request
can't race itself; a failure now fails the whole bundle, so React Query keeps
the last-good snapshot and retries with backoff (5-min staleTime, 30-min
gcTime).

Because computing it live costs ~4.5s cold against the anon role's 3s statement
timeout, the public RPC serves a **single-row cache**:

| Piece | What it is |
| --- | --- |
| `compute_explore_bundle` | The real work (the old RPC body). Not executable by anon. |
| `explore_bundle_cache` | One row, RLS-locked, no client policies. |
| `refresh_explore_bundle()` | Recompute + upsert; pg_cron runs it every 10 minutes. |
| `get_explore_bundle` | Public API — serves the cache when args match, computes live otherwise. |

**Trap:** the slug list baked into `refresh_explore_bundle()` must mirror
`BROWSE_PODS` in `src/components/home/CategoryPodGrid.tsx`. Change one, change
both, or browse-grid requests miss the cache and go the slow path.

**Trap:** `fetchExploreBundle` (`src/lib/db/exploreBundle.ts`) treats an empty
`spotlight_famous` or `iconic` pool as a *fetch failure* and throws — those
pools are structurally always populated, so empty means the read broke. Don't
"fix" that throw into a fallback.

## The feed

Sixteen `FeedRow` variants, declared in `app/(tabs)/explore.tsx` (the web file
keeps its own copy): `spotlight`, `publishers`, `matchup`, `daily`, `ticker`,
`recent`, `foryou`, `sponsorslot`, `favourites`, `rightnow`, `chapter`,
`halloffame`, `browsegrid`, `featuredrivalry`, `seeall`, `curated`.

Order, as pushed: spotlight → publishers → Today's Matchup → dailies banner →
ticker → the "Right Now" band → recently viewed → For You → "The Library"
chapter → Hall of Fame → browse grid → Newly Added (`curated`) → sponsor slot →
"The Arena" chapter → featured rivalry → see-all → favourites.

Two visual zones: `DARK_ROWS` (`spotlight` through `rightnow`) render on the
dark stage; everything after is the beige Library, wrapped in `PaperSurface`
(`src/components/home/PaperSurface.tsx`) with a seam lip on the first beige row.

Rows that were built for Explore and then cut in the curation pass are
catalogued in `docs/parked-explore-modules.md` — check there before rebuilding
an "Origins" wall or an era timeline from scratch.

## Freshness engines

Four pipelines keep the "Right Now" band newsy; all are bundle sections, pushed
by cron (see `docs/architecture/data-pipelines.md` for the sync jobs):

| Engine | Bundle section | Client module |
| --- | --- | --- |
| ComicVine weekly comics | `new_comics` | `src/lib/db/comics.ts` |
| TMDB trending (on screen / coming soon / streaming) | `title_buckets`, `trending_on_screen` | `src/lib/db/trending.ts` |
| Wikipedia pageview movers | `wiki_trending` | `src/lib/db/trending.ts` |
| This Month in History (debut anniversaries) | `debuts` | `src/lib/db/anniversaries.ts` |

The band's freshness label (`src/lib/home/freshness.ts`) measures the freshest
actual *event*, goes null past seven days, and is deliberately **not** derived
from `explore_bundle_cache.refreshed_at` — the cache recomputes every ten
minutes whether or not anything changed, so `refreshed_at` is always fresh and
says nothing about the content.

## The Pulse

The rail of things that *happened*: kinds `live_event`, `trailer`, `surge`,
`issue`. One read (`get_pulse_candidates`, via `src/lib/db/pulse.ts`) does the
indexed recency selection; **everything judgemental is client-side and
unit-tested** in `src/lib/home/pulse.ts` (`__tests__/lib/home/pulse.test.ts`):

- `score = weight(kind) × 2^(−age/halfLife(kind)) × relevance`. Half-lives:
  trailer 120h, surge/issue 96h.
- Live events don't decay — they're **pinned** (`PIN_SCORE`) for their window,
  then vanish.
- Per-kind caps (`KIND_CAP`: 2 surges, 3 issues) stop the weekly comic
  shipment crowding out irregular news; `MIN_NEWS_EVENTS` makes the rail fail
  toward silence rather than render three comic covers as "Just Happened".
- De-dup is by `entityId`, art-less media events are dropped (`railEvents`),
  and copy stays **temporal, never causal** — "2 days after the trailer", not
  "because of".

Surges are Wikipedia-readership breakouts grouped by publisher
(`20260727170000_pulse_surge_events.sql`), attributed to a nearby trailer,
issue, or live event by `attribute_surge()`
(`20260727180000_attribute_surge.sql`).

To re-tune the rail, edit the constants in `src/lib/home/pulse.ts` — the tuning
rationale lives in `docs/superpowers/specs/2026-07-26-pulse-tuning-guide.md`.

## Live events

Real-world events (SDCC, a Direct) are *detected* from Wikipedia attention, not
read from a calendar: the `sync-watched-events` edge function writes detector
state into `watched_events`, and `get_live_events` only ever returns rows an
**admin approved** — nothing re-skins Explore off a threshold alone
(`20260726150000_watched_events.sql`, `src/lib/db/events.ts`). Each event gets
a dossier page at `/event/[slug]` (`useEventDossier` → `get_event_dossier`) and
an index at `/event` (`get_event_index`), both platform-paired.

## Covers, campaigns, personalised rows

- **Browse covers** rotate: `get_browse_covers` and the bundle share the
  `browse_cover_pool(p_slug, p_limit)` SQL helper
  (`20260726190200_browse_cover_pool_tag_index_path.sql`).
- **Campaigns**: manual editorial rows in `featured_campaigns` win; when empty,
  `synthesizeCampaignFromPool` builds one from the bundled trending buckets,
  preferring a title whose trailer just dropped.
- **Personalised rows** are keyed by userId, disabled (→ empty) logged out:
  For You (`get_my_for_you`, `src/lib/db/forYou.ts`), trending-for-user
  (`get_trending_for_user`, `src/lib/db/trending.ts`), recently viewed
  (`useRecentlyViewed` over `user_view_history`, `src/lib/db/viewHistory.ts`).

## Category pages: never filter on an embedded resource

`/category/[slug]` shares `getCategoryPage` with the universe, franchise and
team browse grids (`src/lib/db/heroes/categories.ts`). Tag-backed slugs — anime,
video-games, horror, magic, aliens, mythology — used to reach their tag through
a PostgREST embedded inner join:

```ts
.select('…, t0:hero_tags!inner(tag)').eq('t0.tag', 'anime')
```

Correct SQL, and it returned **HTTP 500 `canceling statement due to statement
timeout`** on the live anon endpoint, every single attempt. With React Query's
`retry: 2` that is three ~3.6s timeouts before the screen gives up — about
twelve seconds of skeleton, ending in the empty state.

The tell is which categories broke: **anime (29 heroes) and horror-icon (15)**,
while video-game (129), mythological (67), alien (203) and magic-user (206) were
all fine. The two that failed are the two with **fewer heroes than one page**
(30). A filter on an embedded resource lets the planner drive off `heroes` —
50k rows, a 238MB heap — instead of off `hero_tags_tag_idx`, and a page that can
never be filled has no early exit. The same query written as plain SQL, or as
`exists (…)`, plans fine at 11–42ms, so this is PostgREST's generated form
specifically.

Tags now resolve to ids first (`heroIdsForTags`), then the heroes query is a
plain `.in('id', …)` — every existing facet, sort and pagination path unchanged.
Measured after: 0.4–1.2s, HTTP 206, all six categories.

The junction table is small (~8k rows; largest tag ~206, a 5KB id list). If a
tag ever grows into the thousands this should become an RPC — the move
`category_facet_counts` and `get_browse_covers` already made for the same
reason.

**The general rule: a PostgREST filter on an embedded resource is a planner
trap on a large table.** Resolve the ids, or write an RPC.

## History

Historical specs and plans (status lines in them may be stale):

- `docs/superpowers/specs/2026-06-09-explore-overhaul-phase1-design.md` and
  `docs/superpowers/specs/2026-06-09-explore-cohesion-pass.md` — the curation pass.
- `docs/superpowers/specs/2026-06-12-native-explore-polish-design.md`
- `docs/superpowers/plans/2026-06-28-comicvine-weekly-comics.md`,
  `docs/superpowers/plans/2026-06-28-tmdb-trending.md`,
  `docs/superpowers/plans/2026-06-28-wikipedia-pageviews.md`,
  `docs/superpowers/plans/2026-06-28-this-month-in-history.md` — the freshness engines.
- `docs/superpowers/specs/2026-07-01-dynamic-browse-covers-design.md`
- `docs/superpowers/specs/2026-07-26-live-events-and-pulse-design.md`,
  `docs/superpowers/specs/2026-07-26-pulse-tuning-guide.md`,
  `docs/superpowers/specs/2026-07-27-event-attribution-design.md`,
  `docs/superpowers/specs/2026-07-27-pulse-reach-design.md`,
  `docs/superpowers/specs/2026-07-27-pulse-return-design.md` — the Pulse arc.
