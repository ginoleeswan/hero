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

| Piece                      | What it is                                                              |
| -------------------------- | ----------------------------------------------------------------------- |
| `compute_explore_bundle`   | The real work (the old RPC body). Not executable by anon.               |
| `explore_bundle_cache`     | One row, RLS-locked, no client policies.                                |
| `refresh_explore_bundle()` | Recompute + upsert; pg_cron runs it every 10 minutes.                   |
| `get_explore_bundle`       | Public API — serves the cache when args match, computes live otherwise. |

**Trap:** the slug list baked into `refresh_explore_bundle()` must mirror
`BROWSE_PODS` in `src/components/home/CategoryPodGrid.tsx`. Change one, change
both, or browse-grid requests miss the cache and go the slow path.

**Trap:** `fetchExploreBundle` (`src/lib/db/exploreBundle.ts`) treats an empty
`spotlight_famous` or `iconic` pool as a _fetch failure_ and throws — those
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

| Engine                                              | Bundle section                        | Client module                 |
| --------------------------------------------------- | ------------------------------------- | ----------------------------- |
| ComicVine weekly comics                             | `new_comics`                          | `src/lib/db/comics.ts`        |
| TMDB trending (on screen / coming soon / streaming) | `title_buckets`, `trending_on_screen` | `src/lib/db/trending.ts`      |
| Wikipedia pageview movers                           | `wiki_trending`                       | `src/lib/db/trending.ts`      |
| This Month in History (debut anniversaries)         | `debuts`                              | `src/lib/db/anniversaries.ts` |

The band's freshness label (`src/lib/home/freshness.ts`) measures the freshest
actual _event_, goes null past seven days, and is deliberately **not** derived
from `explore_bundle_cache.refreshed_at` — the cache recomputes every ten
minutes whether or not anything changed, so `refreshed_at` is always fresh and
says nothing about the content.

## The Pulse

The rail of things that _happened_: kinds `live_event`, `trailer`, `surge`,
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

Real-world events (SDCC, a Direct) are _detected_ from Wikipedia attention, not
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

| Predicate      | Rows | Plan                                 | Time   |
| -------------- | ---- | ------------------------------------ | ------ |
| `%dark horse%` | 754  | bitmap · `heroes_publisher_trgm`     | 6.9ms  |
| `%dynamite%`   | 3    | bitmap · `heroes_publisher_trgm`     | 13ms   |
| `%image%`      | 3421 | index scan · `heroes_fame_score_idx` | 16.7ms |

Note that `%image%` still takes the fame-index walk. With accurate statistics
that is the _right_ choice — 3421 matches means the limit fills after ~3.6k
rows, so the scan is bounded. The failure mode is never the plan shape itself,
it is choosing a walk whose early exit never arrives.

**Two rules fall out of this.** A `%pattern%` predicate is only as good as the
planner's selectivity estimate, so a column that gets filtered by pattern needs
a statistics target that covers its distinct values. And a timeout that comes
and goes with cache warmth is a _costing_ problem; one that fails every single
time is a _shape_ problem. They do not have the same fix.

Beware measuring this from a dev container: a trivial single-row fetch against
the REST endpoint costs ~0.44s of pure network from here, so anything under
about a second is noise, not query time.

### The audit of the other browse predicates

Every other filter a browse grid applies was checked as anon at the same time.
Nothing else needed changing, and the reason is worth keeping:

| Predicate                           | Slug            | Verdict                                                             |
| ----------------------------------- | --------------- | ------------------------------------------------------------------- |
| `franchise = …`                     | franchise pages | Safe — `heroes_franchise_idx` serves it as an index _cond_, 0.8ms.  |
| `teams @> …`                        | team pages      | Safe — GIN index cond.                                              |
| `alignment ILIKE '%neutral%'`       | anti-heroes     | Safe — 3 distinct values, all in the MCV, so the estimate is exact. |
| `group_affiliation ILIKE '%x-men%'` | xmen            | Healthy, but the one to watch.                                      |

Equality or containment on an indexed column is never the trap: it becomes an
index _condition_, so the scan is bounded no matter what the planner estimates.
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
- `docs/superpowers/specs/2026-08-14-ipad-spotlight-deck-design.md` — the
  billboard's deck above 720pt.

## The skeleton handoff

Three things have to be true or the swap visibly jumps, and all three were
broken at once:

- **The skeleton and the feed must lay out from the SAME top inset.** The
  skeleton took the live `useSafeAreaInsets().top` while the feed took
  `useStableTopInset()` — the hook that exists precisely because the live value
  was observed changing after mount. Different insets mean different billboard
  heights, so the handoff jumped vertically by the difference. `HomeSkeleton`
  now takes `insetTop` and the caller passes the stable one.

- **The skeleton must not promise a row the feed cannot deliver.** Today's
  matchup is a separate query, `enabled` on `iconic` — which comes from the
  bundle, and the bundle resolving is exactly what clears the skeleton. So the
  matchup query could not even START until the handoff, guaranteeing the feed
  appeared without that row and that a ~206pt card punched in a moment later,
  shoving everything below it down. Every cold load, deterministically. The
  feed now holds the slot with the skeleton's own `MatchupSkeleton` while the
  query is pending (`undefined` = pending, `null` = resolved-but-none — the
  data layer already drew that distinction). Reusing the component rather than
  building a matching placeholder is the point: a placeholder kept in step with
  a skeleton by hand drifts.
  Its row type is in `DARK_ROWS` too, or the navy-tinted shimmer would land on
  beige paper and claim the seam.

- **The two halves of the dissolve must be one cross-fade.** See
  `SKELETON_DISSOLVE_MS` — the skeleton's exit and a row's entrance share one
  constant and start together, so total ink on screen never dips. They used to
  be tuned against different clocks (the row delay was set against the BOOT
  stage's dissolve), which left ~300ms of half-faded skeleton over an empty
  screen.

## Motion that never ends

The tab bar is `NativeTabs`, which keeps **every screen mounted** — that is why
switching tabs is instant, and it means anything looping with
`withRepeat(..., -1)` on Explore keeps running while you are on Search, Arena
or Profile. Forever, for nobody. Same class of waste as a list paginating rows
nothing will draw.

Both of Explore's endless animations now hold still off-screen, via
`useScreenFocused`:

- **`PulseTicker`** resumes seamlessly rather than snapping back to the start.
  It finishes the leg it was on, then hands over to the loop — `withRepeat`
  restarts each iteration from the value its animation began at, so the loop
  can only be started from 0, hence a zero-duration snap between the two. That
  snap is invisible _because_ the strip is two identical copies: at `-copyW`
  the second copy sits exactly where the first began, so 0 and `-copyW` are the
  same picture.
- **`PulseDot`** also gained a Reduce Motion check, which it never had. A dot
  that throbs forever is the most literal thing Reduce Motion exists to
  suppress — more so than any transition, because it never ends. It rests at
  full opacity rather than wherever the blink was cancelled, so a live
  indicator is never left frozen at 30% looking broken.

**If you add a `withRepeat(..., -1)` anywhere, it needs both checks.**

## Above 720pt the billboard is a deck, not a crop

The full-bleed billboard below sizes its box as a ratio of the window and
draws a ~2:3 portrait with `contentFit="cover"` + `contentPosition="top"`.
Cover matches the box's width and discards past its height, so the share of
the art that survives falls with the box's aspect: 82% on a phone, 43% on an
iPad in portrait, **26% in landscape**, where a character was reduced to hair
and hats. The fix makes the card's aspect the invariant and lets the stage
height follow it, so rotating an iPad changes how many cards are visible and
never what shape they are — the same rule `constants/layout.ts` already
applies to every other card on the page, just never to this one.

`src/constants/spotlightLayout.ts` is that arithmetic, and it is **shared by
native and web** — moved out of `components/web/home/` so the two platforms
cannot drift apart the way the character screen's native/web pair still does.
`spotlightLayout(width)` returns one of four states:

| Width | State | What renders |
| --- | --- | --- |
| < `SPOTLIGHT_DECK_MIN_WIDTH` (720) | `stacked` | web-only; native keeps today's full-bleed `SpotlightCarousel` unchanged |
| 720–999 | `caption` | one correctly-proportioned card beside the panel, no deck |
| 1000–1279 | `duo` | active card + two slivers |
| ≥ 1280 | `gallery` | active card + a tapering deck, ghost name as scenery |

Above `SPOTLIGHT_DECK_MIN_WIDTH`, `SpotlightCarousel` renders `SpotlightDeck`
(`src/components/home/SpotlightDeck.tsx`) instead of the phone carousel.
`deckSelection.ts` (`src/components/home/deckSelection.ts`) — named to dodge a
macOS case-insensitive collision with `SpotlightDeck.tsx` — is the pure
selection logic: `deckCards()` returns **one entry per hero**, in the heroes
array's own stable order, each carrying the width its distance from the
active index assigns. Nothing is reordered by taper position, so a card holds
its slot across an advance and the view animates its width in place — that
400ms width/opacity morph (`SpotlightDeckCard.tsx`, eased to match web's
`cubic-bezier(0.16, 1, 0.3, 1)`) *is* the carousel's motion. `resolveActiveIndex()`
exists because a feed refetch can shrink `heroes` out from under a still-mounted
`active` index; without it the panel and the deck's front card disagree or crash.

**The panel** is a glass card at web parity: eyebrow, name (the link — see
below), real name, publisher + alignment chip, summary, INT/STR/SPD stat
pills, first appearance (`gallery` only, via `detail === 'full'`), and a plate
number (`03 / 08`) beside the reused `SpotlightProgress` dwell rail. What the
panel carries shrinks with `layout.detail` (`full` → `trim` → `lean`) as the
state narrows. It has **no "View Profile" CTA** — a deliberate native
divergence from web's `duo`/`gallery` panels: the card is already a ~280×500pt
touch target and the name is a link, so a button beside it would be the same
instruction printed twice.

**Ghost name** is `gallery`-only (`state === 'gallery'`), bottom-left anchored
and viewport-scaled, matching web's `backdropName` — `duo`'s strip fills its
stage, so there's no negative space for type-as-scenery to sit in. **The
glow** (`SpotlightGlow.tsx`) is a real `RadialGradient` via `react-native-svg`,
publisher-tinted, crossfading over 800ms; native has no backdrop-filter to
fake it with a flat disc, and Reanimated cannot animate an SVG `<Stop>` (see
trap below), so the crossfade is two static gradient layers with the top one's
*View* opacity driven instead.

The deck also clears the floating iPadOS tab bar via `TABLET_TAB_CLEARANCE`
(`SpotlightDeck.tsx`), which `spotlightHeight()` (`SpotlightCarousel.tsx`)
folds in too, so `HomeSkeleton` reserves the same space and the handoff
doesn't jump.

**The tablet feed now has one left gutter, not three.** `publisherGrid`,
`matchupCard` and `dailyBanner` (`src/components/home/homeGeometry.ts`) all
switch to the deck's own `pageGutter` at tablet widths, and
`__tests__/components/home/homeGeometry.test.tsx` asserts they agree there
(phone values are asserted unchanged).

**Traps this cost real time to find, all invisible to CI:**

- `DAILY_BANNER` had exactly one consumer — the skeleton. The real
  `DailyChallengeBanner` (`src/components/game/DailyChallengeBanner.tsx`) used
  to hardcode its own `marginHorizontal` and never read the shared constant, so
  the two silently disagreed. That is precisely the drift `homeGeometry.ts`
  exists to prevent — it now reads `dailyBanner(width)` too.
- Reanimated cannot drive an SVG `<Stop>` — it's a paint-server definition
  element with no host view for Reanimated to attach to, and wrapping it in
  `createAnimatedComponent` crashes on mount. The test suite mocks Reanimated
  as an identity passthrough, so a green `test:ci` proves nothing about this;
  crossfade at the View level instead (see `SpotlightGlow.tsx`).
- The whole class of defect here — the crop, the crash, an off-screen glow,
  ragged gutters — passed `tsc`, `lint`, `check:ui` and the full suite. Only a
  device pass on an iPad simulator found them.

Design: `docs/superpowers/specs/2026-08-14-ipad-spotlight-deck-design.md`.

**The billboard's indicator is a dot per slide, a filling pill for the active
one.** Plain dots encoded position at whisper volume and said nothing about
the billboard advancing on its own. A full row of segmented bars (briefly
shipped, ported from the web spotlight) said all of it far too loudly — five
bright bars competing with the artwork under them. The shipped form keeps the
dots' light footing and puts the clock inside the one indicator that is
already the loud one: the active slide's dot is a wider pill whose track fills
orange across the autoplay interval. The dot↔pill change is a morph, not a
swap — one shared value tracks the active index and every indicator
interpolates its width from the distance to it, so total row width stays
steady and nothing jitters sideways. `SpotlightProgress` shares one
`AUTOPLAY_MS` clock with the carousel, because a fill timed against a
different number than the advance is a clock that lies. Under Reduce Motion
there is no autoplay, so the active pill parks fully filled ("you are here")
instead of promising an advance that never comes. The slide deliberately
carries NO chevron
(one was briefly ported from web): on native a full-bleed content card is the
affordance — the App Store's Today cards and Apple TV's billboard carry none —
and web keeps its own because an editorial headline under a cursor is a
different convention. The slide instead gained the accessibility name it
always lacked (`Open <name>`), which serves the one audience for whom
tappability is not visible. `HomeSkeleton` mirrors the dots and the active
pill via the shared `SPOTLIGHT` tokens.
