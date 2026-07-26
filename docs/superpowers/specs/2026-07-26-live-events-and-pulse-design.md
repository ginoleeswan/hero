# Live Events + The Pulse — design & handoff

**Date:** 2026-07-26
**Status:** Detection layer built and **live** — §7 done 2026-07-26, now on `main`.
Migration applied (as version `20260726183108`), function deployed, cron running,
SDCC approved. §8 steps 1-3 built (step 1 awaits an apply; 2-3 are live in the
band already). Steps 4-6 remain.
**Visual proposal:** https://claude.ai/code/artifact/18490f5f-7323-4041-bcce-ba1e78becb42

---

## 1. Problem & goal

Explore's "Right Now" band is accurate but doesn't feel current. Every rail in it
reports a **state** — in cinemas, on Disney+, 197k pageviews, 12 comics this week
— and a state stays true for months, so it never gives anyone a reason to open
the app _today_.

Audit findings from the same session (all verified against the live DB via
`get_explore_bundle`):

- The section **is** genuinely dynamic and today's data **is** fresh. Rolling
  windows are `current_date`-relative; the crons are all running.
- ~~`"Updated today"` in the band header is a **hardcoded string**~~ — **fixed,
  §8.2a.** It was an unconditional claim: true that day, but it would keep
  asserting freshness over week-old content if a cron stalled.
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

| Today's band says                 | It could say                          |
| --------------------------------- | ------------------------------------- |
| Toy Story 5 is in cinemas         | A trailer dropped 3 hours ago         |
| The Fantastic 4 is on Disney+     | Fantastic 4 landed on Disney+ Tuesday |
| Doctor Doom has 197,899 pageviews | Doom is surging — here's why          |
| 12 comics came out this week      | Amazing Spider-Man #33 is out today   |
| Star Wars #1 debuted in July 1977 | Hall H is live right now              |

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

**Independently confirmed 2026-07-26:** `titles.details` stores `writers`,
`certification`, `productionCountries`, `collection`, `keywords`, `voteCount`,
`reviews`, `genres`, `tagline`, `externalIds`, `budget`, `recommendations`,
`originalLanguage`, `status`, `director`, `spokenLanguages`,
`productionCompanies` (+ `networks`, `seasons`, `episodes`, `episode_runtime`
for TV) — and **no `videos`**. Everything but `.key` really is dropped.

The documented video object is:

```
iso_639_1, iso_3166_1, name, key, site, size, type, official, published_at, id
```

`published_at` is ISO-8601 UTC, `type` ∈ Trailer / Teaser / Clip / Featurette /
Behind the Scenes / Bloopers, `id` is TMDB's video id (distinct from `key`, the
YouTube id already kept).

> `site`, `type` and `key` are confirmed by working production code —
> `enrich-tmdb-batch:168` filters on `v.type === 'Trailer'` and trailers do land.
> `published_at` and `official` are from the documented schema only; there's no
> TMDB key in either checkout. Read them **defensively** (warn when absent) so a
> naming surprise is a one-line fix, not a blocker.

### 3.2 The daily pageview series (already fetched, 12 of 14 days discarded)

`supabase/functions/sync-wiki-pageviews/index.ts` fetches **14 daily**
datapoints per hero, then sums them into two 7-day integers
(`pageviews_week`, `pageviews_prev`) and drops the per-day array. That array is
the **curve shape**, and shape is what separates an announcement from a
happening (see §5.3).

---

## 4. Comic-Con: the table already existed and was empty

`supabase/migrations/20260615190000_phase3_campaigns_and_personal_trending.sql`
describes `featured_campaigns` as _"admin-scheduled editorial moments TMDB
popularity can't see (premieres, **Comic-Con**, game launches)"_ — with
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

| Signal            | Lag      | Role                                  |
| ----------------- | -------- | ------------------------------------- |
| Daily pageviews   | 1–2 days | High signal, but too slow alone       |
| Article edit rate | **none** | Catches an event the morning it opens |

Measured over the **same 28 days**, captured 2026-07-26 while SDCC 2026 was
actually running:

|                 | SDCC (live)               | NYCC (dormant)    |
| --------------- | ------------------------- | ----------------- |
| Pageview lift   | **3.35×** (1,099 → 3,688) | 1.74× (143 → 250) |
| Edits in 4 days | **13**                    | 1                 |
| Edit-rate burst | **21.5×**                 | 4.32×             |
| Verdict         | `live`                    | `idle`            |

Burst figures are the **production** values from the §7 run. An earlier draft of
this doc claimed ~65× / ~5× from the test fixtures; that was wrong, and the
reason is worth knowing — see §5.4.

**Both signals are required.** Pageviews alone would have flagged NYCC too — a
quiet news week lifts every convention article a little.

**`EDITS_ABS_MIN` is the guard that actually rejects a dormant con.** NYCC's
single edit scored 4.32× against a years-dormant baseline, clearing
`EDIT_BURST_MIN = 4`. One edit is not a burst regardless of ratio. (An earlier
draft assumed the ratio would do the rejecting; it doesn't. There's a test
asserting exactly this, and production confirmed it.)

**Result:** from attention alone, with no schedule consulted, the detector placed
SDCC's window at **2026-07-23 → 07-25, ongoing**. 07-23 was opening day.

### 5.3 Curve shape classifies the event type

| Article                   | Baseline | Peak                        | Shape       | Reading               |
| ------------------------- | -------- | --------------------------- | ----------- | --------------------- |
| `Doctor_Doom`             | 2,764    | **62,256** (one day)        | `decaying`  | Discrete announcement |
| `Masters_of_the_Universe` | 1,368    | **12,598** (still climbing) | `sustained` | Ongoing run           |
| `San_Diego_Comic-Con`     | 1,099    | 3,688                       | `sustained` | Event in progress     |

Different shapes want different copy and different decay half-lives. A single
week-over-week ratio flattens all three.

### 5.4 Two threshold corrections from the production run

**The edit-burst ratio can report a floor, not a rate.** The test fixtures keep
every recent revision plus one old anchor, so their older-edit density is far
below what the live function sees (it samples 100 revisions). With so few older
edits `olderPerDay` falls under `MIN_EDIT_BASELINE`, and the ratio becomes
`recentPerDay ÷ 0.05` — a constant. That's the whole 65× vs 21.5× gap: same days,
same 13 recent edits, different denominator. Feeding 87 older revisions across
the real ~575-day span reproduces 21.48 exactly. Both numbers are now pinned by
tests so nobody "fixes" the discrepancy later.

Consequence for tuning: **`EDIT_BURST_MIN` is a weaker gate than it looks** on
any sparsely-edited article, because the floor inflates it. The `live` verdict
leans on `EDITS_ABS_MIN`, which is what production demonstrated.

**A ratio is meaningless on a low-traffic article — so there's now a peak floor.**
Measured medians on the smallest watched articles:

| Article               | Median/day | 2.5× gate | Noise peak (28d) |
| --------------------- | ---------- | --------- | ---------------- |
| CCXP                  | 40         | 100       | 93               |
| Angoulême             | 61         | 152       | 198              |
| Lucca Comics & Games  | 66         | 166       | 218              |
| WonderCon             | 108        | 271       | 154              |
| PAX                   | 194        | 485       | 230              |
| Comiket               | 293        | 732       | 373              |

CCXP's ordinary noise already reaches 2.3× — a hair under `SPIKE_MIN`. Three
edits from one keen editor and it would have read as a live convention. So
`viewsHot` now also requires **`peak >= MIN_PEAK_VIEWS` (250)**, which sits above
every noise peak measured here (max 230) and far below SDCC's 3,688.

The cost is real and worth stating: a convention that is genuinely large but
small *on en.wikipedia* — CCXP is a ~250k-attendee Brazilian show read mostly in
Portuguese — now needs real English traffic to trigger. Revisit the first time
one of those actually runs, and consider a per-row override column rather than a
global constant.

---

## 6. What shipped on this branch

Landed on `main` via `08418f96`. Thresholds since revised — see §5.4.

| File                                                    | Role                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/events/detect.ts`                              | Pure detector. Clock-free (`asOf` injected) so it's deterministic in tests. Exports tunable thresholds.                                                             |
| `__tests__/lib/events/detect.test.ts`                   | 23 tests. Fixtures are the real measured curves above, inlined (no helper files under `__tests__` — jest treats every `.ts` there as a suite).                      |
| `supabase/migrations/20260726150000_watched_events.sql` | `watched_events` table, 20 seeded events, `get_live_events()`, 3 admin RPCs, cron at `7,37 * * * *`.                                                                |
| `supabase/functions/sync-watched-events/index.ts`       | Poller. Mirrors `detect.ts` (Deno can't import from `src/`) — same convention as `enrich-tmdb-batch` mirroring `src/lib/tmdb/mapFilm.ts`. **Change both together.** |
| `src/lib/db/events.ts` + test                           | Client reader. Typed against the generated RPC, widened to the nullable row shape it guards for.                                                                    |

### Thresholds (`src/lib/events/detect.ts`)

```
RECENT_DAYS       = 4     days counted as "recent" for both signals
SPIKE_MIN         = 2.5   pageview lift required   (SDCC 3.35 / NYCC 1.74)
MIN_PEAK_VIEWS    = 250   absolute peak floor      (added §5.4 — kills tiny-article noise)
EDIT_BURST_MIN    = 4     edit-rate multiple       (SDCC 21.5 in production)
EDITS_ABS_MIN     = 3     absolute recent edits    (the real NYCC veto)
MIN_EDIT_BASELINE = 0.05  floor, avoids ÷~0        (but see §5.4 — it can dominate)
WINDOW_ENTER      = 2     multiple to count a day as inside the window
```

`live` requires `spikeRatio >= SPIKE_MIN` **and** `peak >= MIN_PEAK_VIEWS` **and**
`editsRecent >= EDITS_ABS_MIN` **and** `editBurstRatio >= EDIT_BURST_MIN`. Any
subset is `watch`.

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

## 7. Next actions (need the Supabase MCP — do these on the Mac) — **DONE 2026-07-26**

All four ran clean. Measured result: `processed: 20`, `live: ["sdcc"]`, with SDCC at
`spike_ratio` 3.35 / `sustained` / 2026-07-23 → 07-25 / `ongoing` — the §5.2 numbers
reproduced exactly. NYCC came back `idle` on 1 recent edit despite an
`edit_burst_ratio` of 4.32 clearing `EDIT_BURST_MIN`, so `EDITS_ABS_MIN` really is
the veto §5.2 says it is.

One gotcha for whoever automates the gate: `admin_set_watched_event_approval`
checks `auth.uid()`, which is null over the MCP service role, so it raises
`not authorized` there. Approval was set with the equivalent `update` instead.

### The full run — all 20 rows, 2026-07-26

Kept because it's the only baseline sample of the whole watch list in a quiet
week, which is what `MIN_PEAK_VIEWS` was calibrated against.

| slug              | verdict | spike | shape       | window                | ongoing |
| ----------------- | ------- | ----- | ----------- | --------------------- | ------- |
| `sdcc`            | live    | 3.35  | sustained   | 2026-07-23 → 07-25    | yes     |
| `nycc`            | idle    | 1.74  | sustained   | —                     | no      |
| `d23`             | idle    | 1.54  | sustained   | 2026-07-14 → 07-14    | no      |
| `gamescom`        | idle    | 1.54  | easing      | —                     | no      |
| `wondercon`       | idle    | 1.42  | sustained   | —                     | no      |
| `swce`            | idle    | 1.34  | sustained   | —                     | no      |
| `eccc`            | idle    | 1.31  | sustained   | 2026-07-01 → 07-02    | no      |
| `dragon-con`      | idle    | 1.28  | easing      | —                     | no      |
| `ccxp`            | idle    | 1.27  | sustained   | 2026-07-14 → 07-14    | no      |
| `mcm-london`      | idle    | 1.26  | sustained   | —                     | no      |
| `fan-expo-canada` | idle    | 1.25  | decaying    | 2026-07-14 → 07-14    | no      |
| `dc-fandome`      | idle    | 1.21  | sustained   | —                     | no      |
| `comiket`         | idle    | 1.15  | flat        | —                     | no      |
| `nintendo-direct` | idle    | 1.15  | flat        | —                     | no      |
| `lucca`           | idle    | 1.14  | flat        | 2026-07-01 → 07-01    | no      |
| `angouleme`       | idle    | 1.13  | flat        | 2026-07-07 → 07-07    | no      |
| `pax`             | idle    | 1.03  | flat        | —                     | no      |
| `game-awards`     | idle    | 1.00  | flat        | —                     | no      |
| `summer-game-fest`| idle    | 0.97  | flat        | —                     | no      |
| `anime-expo`      | idle    | 0.65  | flat        | 2026-07-02 → 07-08    | no      |

Two things to read out of it:

- **Single-day windows on quiet articles are noise**, not events (`d23`, `ccxp`,
  `fan-expo-canada` all landed on 07-14). They're harmless because `verdict`
  gates surfacing, and `get_live_events` gates again on the window containing
  today — but they're the exact failure mode `MIN_PEAK_VIEWS` now blocks.
- **`anime-expo` at 0.65 with a real 07-02 → 07-08 window** is the detector
  working backwards correctly: Anime Expo ran in early July, so its recent peak
  now sits *below* its own median. Historical windows are reported but never
  surfaced.

### Outstanding — needs a redeploy

Batch these into one trip (nothing breaks meanwhile — the live detector is just
slightly more permissive than the code, and the trailer feature is inert until
applied):

1. **Redeploy `sync-watched-events`** — `MIN_PEAK_VIEWS` was added after the run
   above (§5.4) and the deployed copy predates it.
2. **Apply `20260726210000_title_videos.sql`** (§8.1a).
3. **Regenerate types**, then drop the `as never` in `src/lib/db/videos.ts`.
4. **Deploy `sync-title-videos`**, and **redeploy `enrich-tmdb-batch`** (it now
   persists videos via `_shared/videos.ts`).
5. **Invoke `sync-title-videos`** with `{"limit":40,"triggeredBy":"manual"}` and
   report `{checked, upserted, undated, trailerKeysChanged}`. **`undated` is the
   number that matters** — if it equals `upserted`, TMDB's `published_at` is named
   something else and the mapper needs a one-line fix. A loud `console.warn` fires
   in that case.
6. **Spot-check** `get_recent_trailers(720, 12)` — a 30-day window, since a
   72-hour one may legitimately be empty on any given day.
The RPC is fine from a signed-in admin client — it just can't be driven from MCP.

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

1. ~~**Persist the TMDB videos**~~ — **BUILT 2026-07-26, awaiting apply. See §8.1a.**
2. ~~**Make the freshness label true**~~ — **BUILT 2026-07-26. See §8.2a.**
3. ~~**Give the auto-hero a news sense**~~ — **BUILT 2026-07-26. See §8.2a.**
4. **Build the Pulse rail** — a `get_pulse_events` RPC over the unified score
   below, folded into `get_explore_bundle` so Explore stays one round trip.
   Countdown chips ride along here.
5. **Takeover mode + approve gate** — one `takeover` flag re-skins the band from
   the campaign accent, renames the kicker ("SDCC 2026 · Live"), swaps in an
   event hero. Cards may go live on detection alone; the skin needs the tap.
6. **Event push** — `send-daily-push` already runs a VAPID pipeline. Match new
   events against favourites. **Cap volume hard from day one** or you train
   people to disable notifications and lose the channel permanently.

### 8.1a Trailer events — built, awaiting apply

| File | Role |
| --- | --- |
| `supabase/migrations/20260726210000_title_videos.sql` | `title_videos` table + partial recency index, `titles.videos_checked_at` cursor, `get_recent_trailers()`, cron `40 6 * * *`. |
| `supabase/functions/_shared/videos.ts` | The mapper, shared by both consumers (`_shared` is the repo's existing convention — see `comicvineMatch.ts`). |
| `src/lib/tmdb/mapVideos.ts` + 21 tests | The TS original the `_shared` copy mirrors. All parsing rules are pinned here. |
| `supabase/functions/sync-title-videos/index.ts` | The daily `/videos` sweep. |
| `supabase/functions/enrich-tmdb-batch/index.ts` | Now persists the video list it was already fetching. |
| `src/lib/db/videos.ts` + 6 tests | Client reader. `as never` until types are regenerated. |

Decisions worth not re-litigating:

- **A table, not `videos jsonb` on `titles`.** The query that matters is "event-worthy
  videos published in the last N hours, newest first, across the catalogue" — an
  indexed range scan here, a full scan plus unnest against jsonb.
- **A dedicated sweep, not a wider `refresh-tmdb-trending`.** That job only
  re-flips rows untouched for 14 days, which can't catch a same-day trailer, and
  driving it harder would re-run the full `append_to_response` (credits, images,
  reviews) to re-read one array. `/videos` is a tiny endpoint.
- **`videos_checked_at` lives on `titles`, not derived from `title_videos`.**
  "Checked, found nothing" and "never checked" must be distinguishable or a title
  with no videos is re-fetched forever.
- **`pickTrailerKey` reproduces the incumbent precedence exactly** (first YouTube
  `Trailer`, else first YouTube anything), with a test asserting it, so persisting
  the full list can't quietly change which trailer the app already plays.
- **Everything about `published_at` is defensive.** Absent or malformed yields
  null plus an `undated` count, and the sweep logs a loud warning if *every* video
  in a run parses undated — which is exactly what a wrong field name looks like.
  Nothing is `NOT NULL`, so a naming surprise costs a one-line mapper fix, not a
  failed migration.

**Not yet done:** `get_recent_trailers` isn't folded into `get_explore_bundle` and
no UI consumes it. That's step 4.

### 8.2a Honest freshness label + news-sense hero — built, no migration

| File | Role |
| --- | --- |
| `src/lib/home/freshness.ts` + 17 tests | Pure, clock-injectable. Derives the header claim from the freshest real event in the band. |
| `src/components/home/RightNowBand.tsx` | Hardcoded `"Updated today"` gone. `PulseDot` now takes `animate`. |
| `src/components/web/home/RightNowBand.tsx` | Same, plus the chip hides entirely when there's no claim. |
| `src/lib/db/trending.ts` + 16 tests | `synthesizeCampaignFromPool` prefers a recent trailer drop over the random pick. `Campaign` gains `trailer_key`. |
| `src/lib/query/exploreQueries.ts`, `keys.ts` | Two new cached reads: `getLiveEvents`, `getRecentTrailers`. |
| `app/(tabs)/explore.tsx`, `explore.web.tsx` | Thread `liveEvent` to the band. |

**The doc's own recommendation for step 2 was wrong and is superseded.** It said to
expose `explore_bundle_cache.refreshed_at`. But that cache recomputes every ten
minutes whether or not content changed, so `refreshed_at` is *always* under ten
minutes old — a label built on it would be a more precise version of the same lie.
The label now measures the freshest actual **event**, which is the thing a reader
means by "updated". No migration needed, and it gets sharper on its own as event
sources land.

The policy, not just the formatting:

- `JUST NOW` → `3H AGO` → `YESTERDAY` → `4D AGO`, then **null past 7 days** — the
  caller renders nothing rather than "9D AGO". Silence is the honest presentation
  of a stalled pipeline.
- The pulse dot stops animating at **48h**, before the label disappears at 7 days.
  A four-day-old band should say so quietly, not throb.
- A running `liveEvent` outranks every timestamp: `SAN DIEGO COMIC-CON · LIVE`.
  This is the first thing on screen that uses the detector.
- Bare `store_date` values parse as UTC midnight, which *understates* freshness by
  up to a day. That's the right direction to be wrong in.

**Visible change today:** the band will read `4D AGO` rather than `Updated today`,
because the freshest dated content is Wednesday's comics. That's the point — it
was never "today". It becomes hours once trailer events land (§8.1a).

For the hero: a trailer or teaser inside `TRAILER_HERO_MAX_AGE_HOURS` (72) now
beats the `Math.random()` pick, labelled `New Trailer` / `New Teaser`, and the
search spans **all** pools so a streaming title with this morning's trailer beats
a theatrical one with none. Past the window it falls back to the random pick —
deliberately, since rotation is what keeps the hero from being pinned for a whole
staleTime. `Campaign.trailer_key` is carried but not yet rendered; the play
affordance is §8.4.

**Note on round trips:** this adds two queries to a hook that was deliberately
consolidated to one. Both are React-Query cached and degrade to empty on error.
§8.4 folds them into `get_explore_bundle` and takes it back to one.

### The ranking model

```
score = w_type × exp(−ln2 × age_hours / half_life) × relevance
relevance = catalogue_characters_with_art × (max_fame / 100)
```

| Event type            | Source                       | Half-life |
| --------------------- | ---------------------------- | --------- |
| Live event window     | `watched_events` (approved)  | pinned    |
| Trailer / teaser drop | TMDB `videos.published_at`   | 48h       |
| Streaming debut       | TMDB `watch_providers` delta | 72h       |
| New issue on shelves  | `comic_issues.store_date`    | 96h       |
| Pageview surge        | `heroes.pageviews_spike`     | 24h       |

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
the announcements coming _out of_ the event is the part people actually want.

---

## 9. Driving this from a session

This is **not** a one-prompt feature. §7 is deterministic plumbing; §8 step 4 is a
real UI build across the native/web view pair, and steps 4–5 involve calls you'll
want to see and react to rather than have decided for you.

Note also that §8's ordering is by impact, not by visibility: **nothing renders
until step 4.** If you want something on screen early, do step 2 second — it's
small and immediately visible.

Suggested split, one message each:

| Session | Scope                     | Why it ends there                                                                                                                                                                                 |
| ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | §7 (all four) + §8 step 2 | Plumbing plus the first visible change. Small, safe, no design calls.                                                                                                                             |
| 2       | §8 step 1, then step 3    | Trailer events must exist before the rail has anything interesting to show. Verify TMDB's field names against a real response first — a key is needed and wasn't available when this was written. |
| 3       | §8 step 4                 | The Pulse rail: `get_pulse_events`, fold into the bundle, then the component for **both** `RightNowBand.tsx` and `RightNowBand.web.tsx`. Stop here and look at it.                                |
| 4       | §8 steps 5–6              | Takeover skin + approve UI, then push with hard volume caps.                                                                                                                                      |

Dependency that matters: **step 1 before step 4.** Without trailer events the rail
is only comics, spikes and live events, which undersells it.

## 10. Tuning caveats

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
