# Live Events + The Pulse — design & handoff

**Date:** 2026-07-26
**Status:** Detection layer built and pushed (branch `claude/explore-right-now-freshness-4jo1wp`).
Migration **not yet applied**. UI not wired.
**Visual proposal:** https://claude.ai/code/artifact/18490f5f-7323-4041-bcce-ba1e78becb42

---

## 1. Problem & goal

Explore's "Right Now" band is accurate but doesn't feel current. Every rail in it
reports a **state** — in cinemas, on Disney+, 197k pageviews, 12 comics this week
— and a state stays true for months, so it never gives anyone a reason to open
the app *today*.

Audit findings from the same session (all verified against the live DB via
`get_explore_bundle`):

- The section **is** genuinely dynamic and today's data **is** fresh. Rolling
  windows are `current_date`-relative; the crons are all running.
- `"Updated today"` in the band header is a **hardcoded string** —
  `src/components/home/RightNowBand.tsx:244` and
  `src/components/web/home/RightNowBand.tsx:523`. True today, but it's an
  unconditional claim; if a cron stalls it lies.
  `explore_bundle_cache.refreshed_at` exists but `get_explore_bundle` returns
  only `payload`, so the client can't know.
- `get_new_comics` orders each issue's cast by **global** `fame_score`, so Joker
  leads Green Lantern #37 and Action Comics #1100. Manga anthologies also carry
  junk `comic_issue_appearances` links (Weekly Young Jump → Joker, Batman,
  Godzilla, Saitama). Correctness, not freshness.
- `get_trending_heroes_wiki` gates only on `pageviews_week >= 1000` and sorts by
  raw spike, so general-encyclopedia traffic dominates: 6 of 14 Trending Movers
  slots were Greek mythology (Charybdis, Orestes, Pasiphae, Patroclus, Memnon,
  Ajax).

**Goal:** re-model the same catalogue around **timestamped events** so the band
can be ranked by recency, described in relative time ("3h ago"), and pushed.

---

## 2. The reframe: states vs events

| Today's band says | It could say |
| --- | --- |
| Toy Story 5 is in cinemas | A trailer dropped 3 hours ago |
| The Fantastic 4 is on Disney+ | Fantastic 4 landed on Disney+ Tuesday |
| Doctor Doom has 197,899 pageviews | Doom is surging — here's why |
| 12 comics came out this week | Amazing Spider-Man #33 is out today |
| Star Wars #1 debuted in July 1977 | Hall H is live right now |

Not more data sources — the same data, re-modelled with timestamps.

---

## 3. Two findings: data already fetched and thrown away

### 3.1 Trailer drop dates (zero extra API cost)

`supabase/functions/enrich-tmdb-batch/index.ts:166-170` requests TMDB with
`append_to_response=videos`, parses `d.videos.results`, and keeps exactly one
field: `.key`. TMDB video objects also carry **`published_at`**, **`type`**
(Trailer / Teaser / Clip / Featurette), **`official`** and **`name`** — all
discarded.

So "New trailer · 3h ago" costs **no additional API calls**. Needed:

- Persist the video list — a `title_videos` table, or a `videos jsonb` column on
  `titles`.
- A **daily** sweep of the release window. `refresh-tmdb-trending` only re-flips
  rows whose `enriched_at` is older than 14 days
  (`supabase/migrations/20260713140000_fix_refresh_tmdb_trending_cron.sql`),
  far too slow to catch a trailer on the day it lands.

> Not verified live — there's no TMDB key in the web container (`.env.local` is
> gitignored). Confirm the field names against one real response before building.

### 3.2 The daily pageview series (already fetched, 12 of 14 days discarded)

`supabase/functions/sync-wiki-pageviews/index.ts` fetches **14 daily**
datapoints per hero, then sums them into two 7-day integers
(`pageviews_week`, `pageviews_prev`) and drops the per-day array. That array is
the **curve shape**, and shape is what separates an announcement from a
happening (see §5.3).

---

## 4. Comic-Con: the table already existed and was empty

`supabase/migrations/20260615190000_phase3_campaigns_and_personal_trending.sql`
describes `featured_campaigns` as *"admin-scheduled editorial moments TMDB
popularity can't see (premieres, **Comic-Con**, game launches)"* — with
`starts_at`, `ends_at`, `priority`, an accent hex, and a full admin CRUD screen
at `src/components/admin/health/domains/CampaignsDomain.tsx`.

Live campaigns at audit time: **zero**. Scaffolding built, idle, and with only
one visual slot. A convention weekend should change the room, not add a row.

---

## 5. How the event is found (built — see §6)

### 5.1 Wikidata is a dead end (checked)

Querying every dated comic convention (`?e wdt:P31/wdt:P279* wd:Q3070220` with
`P580`/`P585`) returns **16 rows**, newest **2022**, mostly German regional cons.
No SDCC 2026, no NYCC. Future editions simply aren't modelled. There is no
schedule to read.

The repo does have a working SPARQL client at
`supabase/functions/enrich-wikidata-batch/index.ts:67` if a future source appears.

### 5.2 So detect the event from attention instead

Two free, key-less, independent signals on the event's own Wikipedia article:

| Signal | Lag | Role |
| --- | --- | --- |
| Daily pageviews | 1–2 days | High signal, but too slow alone |
| Article edit rate | **none** | Catches an event the morning it opens |

Measured over the **same 28 days**, captured 2026-07-26 while SDCC 2026 was
actually running:

| | SDCC (live) | NYCC (dormant) |
| --- | --- | --- |
| Pageview lift | **3.35×** (1,099 → 3,688) | 1.74× (143 → 250) |
| Edits in 4 days | **13** | 1 |
| Edit-rate burst | ~65× | ~5× |
| Verdict | `live` | `idle` |

**Both signals are required.** Pageviews alone would have flagged NYCC too — a
quiet news week lifts every convention article a little.

**`EDITS_ABS_MIN` is the guard that actually rejects a dormant con.** NYCC's
single edit still scored ~5× against a years-dormant baseline, clearing the
ratio gate. One edit is not a burst regardless of ratio. (An earlier draft of
this design assumed the ratio would do the rejecting; it doesn't. There's a test
asserting exactly this.)

**Result:** from attention alone, with no schedule consulted, the detector placed
SDCC's window at **2026-07-23 → 07-25, ongoing**. 07-23 was opening day.

### 5.3 Curve shape classifies the event type

| Article | Baseline | Peak | Shape | Reading |
| --- | --- | --- | --- | --- |
| `Doctor_Doom` | 2,764 | **62,256** (one day) | `decaying` | Discrete announcement |
| `Masters_of_the_Universe` | 1,368 | **12,598** (still climbing) | `sustained` | Ongoing run |
| `San_Diego_Comic-Con` | 1,099 | 3,688 | `sustained` | Event in progress |

Different shapes want different copy and different decay half-lives. A single
week-over-week ratio flattens all three.

---

## 6. What shipped on this branch

Commit `7e9e763` — `yarn typecheck` clean, `yarn test:ci` **944 passing / 128
suites**, eslint + prettier clean.

| File | Role |
| --- | --- |
| `src/lib/events/detect.ts` | Pure detector. Clock-free (`asOf` injected) so it's deterministic in tests. Exports tunable thresholds. |
| `__tests__/lib/events/detect.test.ts` | 18 tests. Fixtures are the real measured curves above, inlined (no helper files under `__tests__` — jest treats every `.ts` there as a suite). |
| `supabase/migrations/20260726150000_watched_events.sql` | `watched_events` table, 20 seeded events, `get_live_events()`, 3 admin RPCs, cron at `7,37 * * * *`. |
| `supabase/functions/sync-watched-events/index.ts` | Poller. Mirrors `detect.ts` (Deno can't import from `src/`) — same convention as `enrich-tmdb-batch` mirroring `src/lib/tmdb/mapFilm.ts`. **Change both together.** |
| `src/lib/db/events.ts` + test | Client reader. Uses `as never` on the RPC until types are regenerated. |

### Thresholds (`src/lib/events/detect.ts`)

```
RECENT_DAYS       = 4     days counted as "recent" for both signals
SPIKE_MIN         = 2.5   pageview lift required   (SDCC 3.35 / NYCC 1.74)
EDIT_BURST_MIN    = 4     edit-rate multiple       (SDCC ~65)
EDITS_ABS_MIN     = 3     absolute recent edits    (the real NYCC veto)
MIN_EDIT_BASELINE = 0.05  floor, avoids ÷~0
WINDOW_ENTER      = 2     multiple to count a day as inside the window
```

### Seeded watch list (20 rows)

All `enwiki_title` values were resolved through the MediaWiki API with redirects
followed — `D23 Expo` → `D23_(Disney)`, `Comic Con Experience` → `CCXP`,
`MCM London Comic Con` → `MCM_Comic_Con_London`. **A wrong title fails silently
as a permanently idle row**, so keep them canonical.

SDCC, NYCC, D23, Star Wars Celebration, Anime Expo, Comiket, Gamescom,
DC FanDome, MCM London, ECCC, WonderCon, Dragon Con, Fan Expo Canada, CCXP,
Lucca, Angoulême, Nintendo Direct, The Game Awards, Summer Game Fest, PAX.

### Deliberate non-behaviour

Detection **activates nothing.** The sync writes verdict/window only; `approval`
stays `pending` and only an admin flips it. `get_live_events()` returns approved
rows exclusively, with a grace on `live_to` (3 days if `ongoing`, else 1) that
absorbs the pageview lag so a finished event ages out on its own.

A false positive would re-skin the whole front page. That shouldn't ride on
thresholds tuned against two samples.

---

## 7. Next actions (need the Supabase MCP — do these on the Mac)

1. **Apply the migration** via `mcp__supabase__apply_migration` —
   `supabase/migrations/20260726150000_watched_events.sql`. Confirm 20 seed rows
   landed and the `sync-watched-events` cron is registered.
2. **Regenerate types** with `mcp__supabase__generate_typescript_types` into
   `src/types/database.generated.ts`, then drop the `as never` casts in
   `src/lib/db/events.ts` (the comment there marks the spot).
3. **Deploy the edge function** and invoke it once with
   `{"triggeredBy":"manual"}`. Expected: `processed: 20`, and — if SDCC 2026 is
   still inside its window — `live: ["sdcc"]`. Then check the row's
   `spike_ratio`, `shape`, `live_from`/`live_to` against §5.2.
4. **Approve SDCC** via `admin_set_watched_event_approval('sdcc','approved')`
   and confirm `get_live_events()` returns it.

## 8. Then, in impact order

1. **Persist the TMDB videos** (§3.1) — highest value, no new API cost.
2. **Make the freshness label true** — expose `refreshed_at` in the bundle
   payload, derive the label from the freshest event, delete the hardcoded
   `"Updated today"` from both band files.
3. **Give the auto-hero a news sense** — `synthesizeCampaignFromPool` currently
   uses `Math.random()` over the trending pool
   (`src/lib/db/trending.ts:352`). A trailer inside 72h should beat a random pick.
4. **Build the Pulse rail** — a `get_pulse_events` RPC over the unified score
   below, folded into `get_explore_bundle` so Explore stays one round trip.
   Countdown chips ride along here.
5. **Takeover mode + approve gate** — one `takeover` flag re-skins the band from
   the campaign accent, renames the kicker ("SDCC 2026 · Live"), swaps in an
   event hero. Cards may go live on detection alone; the skin needs the tap.
6. **Event push** — `send-daily-push` already runs a VAPID pipeline. Match new
   events against favourites. **Cap volume hard from day one** or you train
   people to disable notifications and lose the channel permanently.

### The ranking model

```
score = w_type × exp(−ln2 × age_hours / half_life) × relevance
relevance = catalogue_characters_with_art × (max_fame / 100)
```

| Event type | Source | Half-life |
| --- | --- | --- |
| Live event window | `watched_events` (approved) | pinned |
| Trailer / teaser drop | TMDB `videos.published_at` | 48h |
| Streaming debut | TMDB `watch_providers` delta | 72h |
| New issue on shelves | `comic_issues.store_date` | 96h |
| Pageview surge | `heroes.pageviews_spike` | 24h |

Events with an explicit window pin above the decay curve for their duration —
that's what makes a convention outrank a good trailer, and what makes it vanish
cleanly on Monday. `relevance` must gate on characters **with art**, or the rail
inherits the Greek-mythology problem from §1.

### Other automatable sources, not yet built

- **TMDB `/movie/changes` + `/tv/changes`** — IDs modified in a 24h window; a
  proper "what moved today" firehose. Unverified (no key in the web container).
- **Ingest-volume anomaly detection** — during a big event TMDB floods with
  trailer publishes. 8× the baseline daily trailer count means something is on
  even if it's not in `watched_events`. Self-calibrating backstop for a surprise
  Nintendo Direct.
- **Wikimedia EventStreams** (`stream.wikimedia.org/v2/stream/recentchange`) —
  free real-time SSE if polling every 30 min ever feels slow.

### Explicitly out of scope

**Panel-level detail** ("Hall H, 11am, Marvel Studios"). It exists only on SDCC's
own site — no API, fragile to scrape, ToS-dubious. Event-window granularity plus
the announcements coming *out of* the event is the part people actually want.

---

## 9. Tuning caveats

- Thresholds are seeded from **one live event and one dormant one**. Before
  trusting `live` unattended, let it run through NYCC in October and compare.
  `views_daily` stores the full series, so the curves will be there to tune against.
- The detector anchors its recent window to the **newest day present in the
  data**, not to `asOf` — the pageviews API lags, and anchoring to today would
  slide the window off the end and read a live event as flat. There's a test for it.
- **An events feed that stalls is worse than no feed.** A live pulse animating
  above week-old cards signals an abandoned app. Every piece of this should fail
  toward the honest state — fewer cards, older timestamp, no pulse — never toward
  a confident lie.
