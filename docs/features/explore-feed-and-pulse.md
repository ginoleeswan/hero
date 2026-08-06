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

That first fix only covered the paged grid. Three more copies of the same
embedded join survived it, and all three are now on `heroIdsForTags` too:

- `getAllHeroesBySlug` (categories.ts) — the whole-category fetch.
- `getHeroesByMediaTag` (feed.ts) — the worst shape of the lot. A themed row
  asks for 20 heroes, but horror-icon only has 15, so the limit can never be
  filled and the planner walks the fame index to the very end every time.
- `api/bot-page.ts` — the six tag-backed crawler hubs (`/category/anime`,
  video-games, horror, magic, aliens, mythology). This bundle uses the **anon**
  key, so it hit the same 3s timeout; `fetchHubHeroes` fail-softs a failure to
  `[]`, and an empty hub renders as a **noindex 404**. Those six hub pages were
  serving Googlebot a 404. Its `CatQuery` now carries a `tag` field that is
  resolved to ids before the heroes request.

## Publisher predicates: keep the statistics fresh, not the index list long

`dark-horse` was the other slow category, and it looked like the same bug. It
was not. The tell: `anime` failed **every** attempt, while `dark-horse` failed
the first two and then served in 0.5s — a warm/cold curve, not a broken plan.

`/category/dark-horse` filters `publisher ILIKE '%dark horse%'`. The trigram
index for that has existed since `20260715105637`, which measured it at 5.2ms.
By August the same query was timing out at 3s. Nothing about the index had
changed; the **statistics** had drifted.

`publisher` has 260 distinct values and the default statistics target keeps an
MCV list of only 68. Outside that list the planner guesses, and its guess for
`'%dark horse%'` was loose enough that walking `heroes_fame_score_idx` looked
like it would fill `LIMIT 48` early. It does not — only 754 of 50,529 rows
match, so it filtered 11,202 rows and burned 10,665 buffers before the anon
`statement_timeout` killed it.

`20260806154827_heroes_publisher_stats_freshness.sql` raises the target to 500
(MCV 68 → 144, `n_distinct` 204 → 259 against an actual 260) and analyzes
`heroes` at 2% drift instead of 10%, because the enrichment drains move more
than 5,000 rows in a batch and the last autoanalyze had been four days stale.
Row estimates are now exact — 754/754 on dark-horse, 3/3 on Dynamite.

Measured as anon, warm, after:

| Predicate | Rows | Plan | Time |
| --- | --- | --- | --- |
| `%dark horse%` | 754 | bitmap · `heroes_publisher_trgm` | 6.9ms |
| `%dynamite%` | 3 | bitmap · `heroes_publisher_trgm` | 13ms |
| `%image%` | 3421 | index scan · `heroes_fame_score_idx` | 16.7ms |

Note that `%image%` still takes the fame-index walk. With accurate statistics
that is the *right* choice — 3421 matches means the limit fills after ~3.6k
rows, so the scan is bounded. The failure mode is never the plan shape itself,
it is choosing a walk whose early exit never arrives.

**Two rules fall out of this.** A `%pattern%` predicate is only as good as the
planner's selectivity estimate, so a column that gets filtered by pattern needs
a statistics target that covers its distinct values. And a timeout that comes
and goes with cache warmth is a *costing* problem; one that fails every single
time is a *shape* problem. They do not have the same fix.

Beware measuring this from a dev container: a trivial single-row fetch against
the REST endpoint costs ~0.44s of pure network from here, so anything under
about a second is noise, not query time.

### The audit of the other browse predicates

Every other filter a browse grid applies was checked as anon at the same time.
Nothing else needed changing, and the reason is worth keeping:

| Predicate | Slug | Verdict |
| --- | --- | --- |
| `franchise = …` | franchise pages | Safe — `heroes_franchise_idx` serves it as an index *cond*, 0.8ms. |
| `teams @> …` | team pages | Safe — GIN index cond. |
| `alignment ILIKE '%neutral%'` | anti-heroes | Safe — 3 distinct values, all in the MCV, so the estimate is exact. |
| `group_affiliation ILIKE '%x-men%'` | xmen | Healthy, but the one to watch. |

Equality or containment on an indexed column is never the trap: it becomes an
index *condition*, so the scan is bounded no matter what the planner estimates.
The trap needs a **pattern** predicate that degrades into a filter over an
ordered walk.

`xmen` is the residual risk. It returns **45 heroes against a LIMIT of 48** —
the same never-fills-the-page condition that killed anime — so it is safe only
because its estimate is currently good (51 predicted, 45 actual, bitmap scan
over `heroes_group_affiliation_trgm_idx`). `group_affiliation` has 346 distinct
values and an MCV of just 8, but it is long free text rather than a categorical,
so a bigger MCV would not help it the way it helped `publisher`. It was measured
healthy and deliberately left alone; the 2% autoanalyze above is what protects
it. **If `/category/xmen` ever starts timing out, this is the first thing to
re-measure** — and the fix will be to stop it walking, not to add an index.

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
