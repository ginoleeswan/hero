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

### The bounce colours live INSIDE the content

Explore is two-tone at the rubber-band: the top over-scroll reveals the
deep-navy root (matching the spotlight), the bottom reveals beige (matching the
Library tail). The beige half is `bounceFill`, an apron inside
`ListFooterComponent` hanging below the last row — **not** a sheet behind the
list.

It was a screen-level sheet, `position: absolute` over the bottom 55% of the
**viewport**, sitting behind the transparent `FeedList`. Invisible under the
opaque feed — except to the iOS 26 glass tab bar. When a scroll view cannot be
paired with the bar (ours are custom FlatLists; see the
`disableAutomaticContentInsets` note in `app/(tabs)/_layout.tsx`) the bar's
edge effect samples the screen's **backdrop** instead of the scroll content, and
what it found behind the dark feed was that beige sheet. The result was a beige
gradient haze washing up over the ink behind the tab pill, at any scroll
position, in both appearances and on every build.

Two things this was *not*, both checked before the real cause was found: it is
not appearance-driven (it survived `simctl ui … appearance dark`), and it is not
the dev client's older `UIUserInterfaceStyle: Automatic` binary (the pinned-dark
iPad client shows it too). Anything painted behind a transparent scroll view on
a screen with a floating glass bar is a candidate for the same bug — keep bounce
colours in the content, where only the bounce can reveal them.

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
state into `watched_events`, and `get_live_events` returns anything the detector
calls `live` **unless it was explicitly rejected**
(`20260726150000_watched_events.sql`). Each event gets a permanent series hub at
`/event/[slug]` (`useEventHub` → `get_event_hub`), a page per edition at
`/event/[slug]/[edition]` (`get_event_edition`), and an index at `/event`
(`get_event_index`) — all platform-paired.

### Dates: detected, and where we know them, published

The detector can only ever be approximately right about DATES, in a way no
threshold fixes:

- **It can only see the past.** `fetchViews` ends at today-1 and Wikimedia lags
  another day, so the inferred `live_to` is always behind. That made
  `day >= total` true on every day of every event: `eventDayLabel` could produce
  **nothing but "FINAL DAY"**, from the first day onward. Gamescom 2026 read
  "Live · FINAL DAY" on 2026-08-25, the evening before it opened.
- **Anticipation looks exactly like attendance.** The same evening, the inferred
  window was Aug 23-24 — press days and pre-show coverage — for a show that ran
  Aug 26-30.

Two changes, and neither of them is a new threshold:

1. `src/lib/events/schedule.ts` holds **published windows** for the handful of
   events where someone has read the organiser's own dates, keyed by slug and
   edition. It is not a calendar and nothing in it is inferred — an event with no
   entry behaves exactly as before. `statedWindow()` resolves published-else-
   detected, and is what every piece of COPY uses: the Pulse card's status word
   and day counter, the masthead window on `/event/[slug]/[edition]`, the hub
   rows, the index. `EventCurve` keeps shading the **detected** window, because
   it is a figure about detection.
2. Where the window is only inferred, the day counter **says nothing** rather
   than guessing (`eventDayLabel`). D23 2026 ran Aug 14-16 with an inferred
   window of Aug 11-13: "DAY 5" and "FINAL DAY" were both false and there is no
   third number that isn't. `eventPhase` gains `upcoming`, so a published event
   reads "Starts tomorrow" instead of "Live", and `livePulseEvent` gates the
   band's "· LIVE" header on the phase rather than on the kind.

### An announcement must be about the title it links to

`match_title_for_video` matches by substring containment, which attaches a short
catalogue name to any longer name containing it: "Heroes of Might and Magic III
Remake" landed on the TV series **Heroes** and rendered with Sylar and Claire
Bennet under it, four times over, on the Gamescom 2026 page. So did *Stellar
Blade* → **Blade**, and *Aliens: Fireteam Elite 2* → **Aliens**.

The test (`src/lib/events/announcementMatch.ts`, mirrored in SQL by
`video_title_match_is_credible`): a studio leads with the work's name and stacks
ceremony after it, so the catalogue name must **prefix** the video's first
segment with only ceremony ("Official Trailer", "Season 3", "PS5 Games")
following. Colons are not segment breaks — cutting there is what let a 1986 film
claim a 2026 game. `mapEventDossier` applies it at read time; the migration
re-judges what is already attached and drops promotions made under the old test.

**Approval is a veto, not a prerequisite** — inverted by
`20260815080000_live_events_publish_by_default.sql`, whose header carries the
full argument. Short version: the opt-in gate was built to protect a takeover
skin that was never implemented, there is no admin surface or notification for
it, so `pending` meant "no" forever — D23 2026 was detected `live` at 3.37× and
sat unpublished through the event. Control belongs on the **policy** (the
curated 20-row watch list and the `detect.ts` thresholds), not on each firing.
`admin_set_watched_event_approval` still sets `rejected` as a kill switch. A
human gate is still right for anything irreversible: **push must keep its own.**

### The dossier says what was announced

Everything else on an event page is derived from **attention** — a spike, a
curve, whose readership moved. That is the half nobody else publishes, and it is
not the half a reader arrives for: someone opening a D23 page wants the X-Men
cast reveal and the Doomsday Special Look, and Wikipedia readership can never
supply those, because it records that something moved and never what it was.

`channel_videos` closes that gap, so `get_event_dossier` now returns
**`announcements`** (`20260815190000_dossier_announcements.sql`) — the studios'
own uploads inside the window, official channels first. Only videos matched to a
catalogue title are returned: the section renders each row as a link, and a list
of bare marketing strings that link nowhere is worse than a shorter honest one.
`mapEventDossier` tolerates a payload with no `announcements` key at all, so an
unapplied migration renders nothing rather than throwing on a shared route.

Two readers exist for the durable side — `get_event_hub(slug)` and
`get_event_edition(slug, edition)` (`20260815180000_…`). The edition reader takes
perishable things from the frozen snapshot and **recomputes everything durable
from the frozen window**, so an edition page keeps improving as enrichment fills
in rather than being permanently as bad as the catalogue was on the day. The
routes that consume them are not built yet — see the note at the end of this
section.

### Editions: why `/event/d23` is not "D23 2026"

`watched_events` holds one row per **series** and `sync-watched-events`
overwrites it every 30 minutes, so the live row is always "D23, currently" — next
August it silently becomes D23 2027. `event_editions`
(`20260815120000_event_editions.sql`) is the durable per-edition record, written
by `freeze_event_edition()` on **every** sync pass while an event is live (not on
a live→idle transition, so there is no moment to miss and a flickering verdict
cannot lose an edition).

It stores only what **perishes** — the event's own `views_daily` curve,
baseline/peak/spike/edits, and the surge list, since `heroes.views_daily` is
itself a rolling window. Trailers and issues are deliberately **not** copied:
`title_videos` and `comic_issues` keep their history, so an edition page derives
them from the frozen window at read time and old editions keep _improving_ as
enrichment fills in. Copying the catalogue would freeze the rosters at their
worst.

**An edition happened somewhere** (`20260816090000_editions_happened_somewhere.sql`).
`venue`, `venue_city`, `venue_lat`, `venue_lon` live on `event_editions`, not on
`watched_events`, because three of the twenty-one watched events genuinely move:
D23 alone has been to Anaheim, the Tokyo Disney Resort and Walt Disney World, so
a hub-level venue would be wrong for three of its eight editions. Star Wars
Celebration changes country by design, and PAX is several shows under one name
(East in Boston, West in Seattle), attributed by the window's season.

**NULL is a real answer, not missing data.** A Nintendo Direct and DC FanDome are
broadcasts, and gamescom 2020/21 ran with no show floor — a pin on Cologne would
say a crowd was there. 15 of 132 rows are deliberately NULL and the page renders
no map for them. `VenueMap` draws ~40 hand-authored coastline rings in
equirectangular projection: no tiles, because tiles need the network, would not
survive the crawler surface's CSP, and arrive in somebody else's palette.

Two rules that are load-bearing:

- **Keyed `(slug, edition_slug)`, matched by proximity, not by `live_from`.** The
  detector refines its window as lagging pageviews arrive, so `live_from` moves —
  keying on it would fork a new row each time it shifted. A freeze within 45 days
  of an existing edition updates it; further away starts a new one, which is also
  what lets Comiket run twice in one calendar year.
- **`peak`, `spike_ratio` and the surge list never shrink on re-freeze.** The
  curve rolls off, so a later freeze legitimately observes a _smaller_ peak for
  the same event, and a late re-freeze must not quietly rewrite history downward.

The cost of not having had this: SDCC 2026 was detected at 3.35×, and by
2026-08-15 its own row read `spike_ratio` **0.82** with `shape: flat` and zero
movers, because the July spike had rolled out of the 27-day series. Its frozen
edition records that damage honestly rather than restoring a number from a design
doc. D23 2026 was captured with its full 27-day curve intact.

**Most of the watch list cannot fire, and it is the floor that stops it.**
Reviewed 2026-08-15: two of the twenty rows have ever been caught (`sdcc`,
`d23`). The spike threshold is not what excludes the rest — `MIN_PEAK_VIEWS` is
an absolute 250, and six articles sit far below it at baseline (DC FanDome 28,
ECCC 31, CCXP 41, Angoulême 66, Lucca 68, MCM London 69). Those need a **6–9×
spike merely to reach the floor**, against the 2.5× the detector asks for, so
they are undetectable on English Wikipedia however large the event is in the
world. Left enabled deliberately — six extra requests per half-hour is nothing,
and a disabled row can never surprise you by growing — but nobody should expect
them to fire, and lowering the floor for them would buy noise, not events. The
honest fix, if these matter, is a different signal for small events, not a looser
threshold on this one.

**The hub and edition routes are built** (`f3a87dc6`). `get_event_hub` and
`get_event_edition` back `app/event/[slug]/index.tsx` and
`app/event/[slug]/[edition].tsx`, each with its `.web` twin — expo-router throws
if only one of a pair exists, so a route pair is added whole or not at all.

**`/event/[slug]` is ALWAYS the hub.** It briefly rendered two different pages —
the live dossier while the detector called the event on, the hub once it was over
— to keep the Pulse rail one tap from the news. That put the running edition's
content at two addresses simultaneously (here _and_ `/event/d23/2026`, which
exists and is refrozen every 30 minutes while the show runs), listed the live
edition in an archive underneath its own content, and changed what the URL meant
without the URL changing. The tap is paid for on the stage instead: while an
event is live the hub opens on a filled, accent-coloured route straight into the
running edition, and that edition is marked "Happening now" in the timeline. The
crawler surface already assumed this shape — `buildEventHubBotPage` has always
described `/event/[slug]` as the series, so the app was the half that disagreed.

The live dossier reader (`useEventDossier` → `get_event_dossier`) now has no
caller. Kept deliberately: an edition page reads the frozen snapshot, so while an
event runs it can be up to 30 minutes stale, and the live reader is what a
"refresh the running edition from `watched_events`" path would use.

Worth knowing before building it: **`/event` has no inbound links anywhere.**
Nothing in `app/` or `src/` routes to it, so the index is reachable only by
typing the URL, and `scripts/generate-sitemap.mjs` has no events entry — core,
categories, universes, houses, heroes, titles, teams, and no `/event`. Events
also get a **share-meta** rewrite in `vercel.json` but no **bot-page** one, so
crawlers receive the SPA shell. The archive is the precondition for that SEO work
paying off, because a URL whose content silently becomes next year's event cannot
hold a ranking for this year's.

**Three functions read `approval` and must move together** — `get_live_events`
(the rail), `get_event_dossier` (`/event/[slug]`) and `get_event_index`
(`/event`). There is no shared predicate; the `where` is inlined in each, which
is exactly how the first pass drifted: inverting only the rail shipped a
tappable D23 card pointing at a dossier that returned null
(`20260815093000_event_pages_follow_the_veto_gate.sql`). The admin RPCs
deliberately don't filter — they show the whole table, rejections included.

The index's `caught` arm additionally requires `first_detected_at is not null`
(`20260815094500_…`). `live_from` alone marks any contiguous run above
`WINDOW_ENTER`, which a quiet article clears in a slow week; `first_detected_at`
is stamped only when a row is first judged `live`, so it means "this really was
an event" and it survives the event ending. `watching` is kept as the exact
complement of `caught`, so the two arms still sum to the enabled row count.

Copy has to stay honest in _both_ directions. Pageviews lag reality by 1–2 days,
so a running event's inferred window can close before the event does; a
`sustained` shape (the detector's "this run reaches my newest day") therefore
gets `ONGOING_LAG_GRACE_DAYS` = 2 in `eventPhase`, where every other shape keeps
a single day. Wider than that and the card claims "DAY 5" of a three-day
convention; narrower and it says "Just wrapped" mid-event — which is exactly how
D23 would have read.

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

## Tablets: the daily pair, and why nothing else pairs

At `breakpointFor(width) === 'wide'` (≥1024) `app/(tabs)/explore.tsx` renders
**Today's Matchup** and the dailies banner (`DailyChallengeBanner`) side by
side in one row instead of two stacked full-width bands — the feed's
virtualised item list gains a paired-item entry for `wide`, and below 1024 the
original stacked rendering is reproduced verbatim. `HomeSkeleton` mirrors the
pairing so the placeholder doesn't stack and then jump to a paired row on
handoff. Verified on an iPad Pro 13" landscape (1376pt): the two columns
balance at 892pt and 890pt; the right column sits empty below the banner
because the banner is genuinely shorter than the matchup card — that's
correct, not a bug.

**Only this pair.** `RightNowBand`, `HomeHeroRow`, `TitlePosterRail` and
`CoverGallery` are deliberately never paired into a half-width column — each
carries a horizontal rail, and a rail in a half-width column is exactly the
"broken carousel" failure `src/constants/layout.ts` was written to prevent
(see its header comment: a proportion-scaled card stops reading as a rail card
and starts reading as one and a half). The two rows that do pair are both
compact, self-contained cards with no rail inside them — that's the test for
whether a future row is a pairing candidate, not just whether it "fits."

## Tablets: one gutter, one measure, and grids that tile

The pairing above uses the extra width for _density_. Three further faults were
about the feed having no notion of width at all, and they share one cause: five
separate `paddingHorizontal: 16` literals with nothing keying them to the
window. On an iPad Pro 13" landscape every heading started 16pt from the bezel.

**`sectionGutter(width, phone)` (`src/constants/layout.ts`) is now the feed's
one left edge** — 16 (or whatever the caller's existing phone literal is) below
700pt, 24 at tablet, 32 at wide. It exists alongside `pagePadding` rather than
replacing it because `pagePadding`'s phone value is **15** and Explore's
sections were tuned at **16**: adopting it wholesale would have shifted every
heading on every phone by a point. The phone value is a parameter, so only the
tablet widths are unified. Adopted by `browseHead`, `seeAllRow`, `sponsorWrap`
and `footer` in `app/(tabs)/explore.tsx`, plus `HallOfFame`, `FeaturedRivalry`
and `CategoryPodGrid`.

**`sectionGap(width, phone)` (`src/components/home/homeGeometry.ts`) is the
vertical counterpart** — the same shape, the same reason. Measured down an iPad
in portrait, the four dark-stage boundaries were **23.5 / 18.5 / 12.5 / 28pt**,
and the tightest one separated the two loudest elements on the page: the engage
cards and the full-bleed orange ticker. They were four numbers rather than one
because the boundary was **additive** — the section above contributed a bottom
padding and the section below a top padding, so no component could see, let
alone set, the gap it was half of.

At tablet widths the boundary is therefore owned entirely by the section
**below** it: every section pads its top by `SECTION_GAP` (24) and pads its
bottom by nothing. Adopted by `TodaysMatchup`, `PulseTicker` and
`RightNowBand`, with `publisherGrid()` zeroing its bottom. The billboard seam
is deliberately **not** one of them — the deck's bottom gap, the stage's -14
overlap and the pods' top padding compose a design device that already measures
23.5pt. Phone values pass through untouched, and the test asserts that.

**Rails still bleed past it.** The gutter is for non-rail sections; a
horizontal rail keeps its own inset and scrolls to the physical edge, which is
the rule in CLAUDE.md and is not an exception to this one.

**The cap goes on the text, never on the block.** A section head keeps its left
edge on the gutter so every row shares one edge — centring some sections and
not others is the ragged-gutter fault Arena had. Body copy that would otherwise
run 1312pt gets `PROSE_MAX_WIDTH` (560) on the `Text` itself: aligned left,
wrapped at a readable measure, centred nowhere.

**Two cards were portrait designs stretched into letterboxes.** Both are fixed
heights that were fine at a phone's width and absurd at 1312pt:

- `HallOfFame`'s #1 plate is 320pt tall. Unbounded that is a **4.1:1** band and
  the crop lands on an ear. Above 700pt the section becomes **two columns** —
  plate left at 420pt tall, the ranked 02–07 rows right — capped together at
  `CONTENT_MAX_WIDTH` and left-aligned. The plate comes back to roughly square
  (1.09:1 at 834pt, 0.95:1 at 1376pt), and the rows stop putting 1300pt between
  a name and its publisher.
- `FeaturedRivalry` is 240pt tall and would be a **5.5:1** strip in which both
  faces are foreheads. Capped at `CONTENT_MAX_WIDTH` and 320pt tall above 700pt
  — 2.8:1, the shape the two 50%-wide face crops were composed for.

**A grid over a closed set needs a column count that divides it.**
`BROWSE_PODS` is twelve tiles and its own comment promises the grid never
strands a lone one. The count was clamped to 2–5, and **five is the one value
in that range twelve does not divide** — so a landscape iPad drew 5 / 5 / 2
with three empty slots. `snappedColumns(width, pad, legal)` snaps to the
nearest legal divisor instead of rounding off a target width, and
`src/components/home/podGrid.ts` holds the geometry apart from the component so
it can be unit-tested (same reason `deckSelection.ts` exists — a constant
inside a file that imports `expo-linear-gradient` cannot be imported by a
test, and a test that re-declares the value passes while the screen draws
something else). Twelve tiles now land 2-up on a phone, 4-up at 1032pt and 6-up
at 1376pt, always in full rows.

**Two things changed on the phone too, deliberately.** Chapter heads gained the
standfirst web has always had (`browseSubtitle`), and Hall of Fame moved
**above** the Library chapter break rather than below it — the standfirst
promises the tile grid ("archetypes, teams, media, origins and power
rankings"), so a ranked canon list between the promise and the tiles makes the
sentence describe the wrong thing. Web has always had this order.

**The accent bars are gone** (`HomeHeroRow`, `TodaysMatchup`). A coloured
vertical stripe beside a heading decorates without labelling, which is a
standing rule in this project. It was also causing a real misalignment: bar (4)

- gap (11) pushed the heading to 30pt while the rail's own cards start at 15pt,
  so a row's title never lined up with the row.

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
- `docs/superpowers/specs/2026-08-15-tablet-adaptation-design.md` — the daily
  pair at `wide`.

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

| Width                              | State     | What renders                                                            |
| ---------------------------------- | --------- | ----------------------------------------------------------------------- |
| < `SPOTLIGHT_DECK_MIN_WIDTH` (720) | `stacked` | web-only; native keeps today's full-bleed `SpotlightCarousel` unchanged |
| 720–999                            | `caption` | one correctly-proportioned card beside the panel, no deck               |
| 1000–1279                          | `duo`     | active card + two slivers                                               |
| ≥ 1280                             | `gallery` | active card + a tapering deck, ghost name as scenery                    |

Above `SPOTLIGHT_DECK_MIN_WIDTH`, `SpotlightCarousel` renders `SpotlightDeck`
(`src/components/home/SpotlightDeck.tsx`) instead of the phone carousel.
`deckSelection.ts` (`src/components/home/deckSelection.ts`) — named to dodge a
macOS case-insensitive collision with `SpotlightDeck.tsx` — is the pure
selection logic: `deckCards()` returns **one entry per hero**, in the heroes
array's own stable order, each carrying the width its distance from the
active index assigns. Nothing is reordered by taper position, so a card holds
its slot across an advance and the view animates its width in place — that
400ms width/opacity morph (`SpotlightDeckCard.tsx`, eased to match web's
`cubic-bezier(0.16, 1, 0.3, 1)`) _is_ the carousel's motion. `resolveActiveIndex()`
exists because a feed refetch can shrink `heroes` out from under a still-mounted
`active` index; without it the panel and the deck's front card disagree or crash.

**The panel** is a glass card at web parity: eyebrow, name (the link — see
below), real name, publisher + alignment chip, summary, INT/STR/SPD stat
pills, first appearance (`gallery` only, via `detail === 'full'`), and a plate
number (`03 / 08`) beside the reused `SpotlightProgress` dwell rail. What the
panel carries shrinks with `layout.detail` (`full` → `trim` → `lean`) as the
state narrows.

**The panel's height comes from the card deck beside it, not from its own
content** — which is why trimming its copy does not shrink it, it just leaves a
hole above the bottom-pinned pager. Two measured faults came out of that. At
`duo` the panel was dropping the first-appearance line for space it in fact
had, leaving 146pt of nothing; `detail` is now `full` at `duo` as well as
`gallery`. And the summary was clamped to a fixed four lines with 45pt still
empty beneath it — `summaryLineBudget(stageHeight, nameLines)`
(`src/constants/spotlightLayout.ts`) now hands the surplus to the summary,
which is the only elastic thing in the panel. `nameLines` is a parameter, not a
constant, because the 38pt Flame name wraps to two lines for much of the
featured pool and costs 47pt — nearly the whole surplus. The panel is
`overflow: hidden`, so over-granting clips the pager rather than overflowing
visibly; the component measures the name with `onTextLayout` and asks. Residual
slack is content-driven (a hero with no `full_name`, or a short `summary`) and
cannot be closed by layout.

It has **no "View Profile" CTA** — a deliberate native
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
_View_ opacity driven instead.

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
