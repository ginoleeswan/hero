# Data Enrichment Architecture

> How `hero` gets its data, the one pattern every pipeline follows, and the
> source-of-truth for each field. Read this before adding or changing any
> enrichment cron / edge function.

## Mental model (read this first)

The app's database is a **read-optimised cache of 5 upstream sources**. Almost
every field on a hero or title traces back to exactly **one authoritative
source**. "Enrichment" just means pulling from those sources into our tables on
a schedule, so the app never calls a third-party API on the render path.

Everything is one of three kinds of work:

1. **Seed** — where rows come from (a hero/title first appears).
2. **Drain** — per-row enrichment from an upstream API, gated by a `*_status`
   column. _This is the same pattern repeated 6 times — learn it once._
3. **Derive** — pure-SQL aggregates computed from already-fetched data
   (no API), run as nightly/weekly maintenance.

```text
SOURCES                    →  TABLES        →  DERIVED / SIGNALS
─────────────────────────────────────────────────────────────────
SuperheroAPI (legacy) ─┐
ComicVine ─────────────┴─→  heroes ─┐
TMDB ──────────────────────→ titles │
                                    │
  per-row DRAINS (one cron each):   │
   ComicVine  → comic canon ────────┤
   Wikidata   → qid, sitelinks,     │
                screen appearances  │
   TMDB       → title details, cast │
   Wikipedia  → article, pageviews  │
                                    │
                                    ▼   DERIVE (nightly, pure SQL)
                       enemies/friends/teams[] → hero_relationships (cards)
                       titles.cast_members     → hero_media_appearances
                       wikidata/movie/issue    → fame_score (weekly)
                                    │
                                    ▼   AI (on-demand, COSTS MONEY)
                                 portrait_url, powerstats
```

## Source of truth (which source owns what)

| Domain                                                      | Authoritative source                                | Notes                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Comic canon (issues, teams, enemies, powers, first issue)   | **ComicVine**                                       | `comicvine_id` is the key                                                              |
| Identity / base stats (name, gender, alignment, powerstats) | **SuperheroAPI** (legacy) → migrating to ComicVine  | numeric ids only; being phased out                                                     |
| Cross-linking + popularity signal                           | **Wikidata** (`wikidata_qid`, P5905 = ComicVine id) | drives sitelinks → fame                                                                |
| Screen appearances ("On Screen")                            | **TMDB** (`titles` + `hero_media_appearances`)      | the legacy `heroes.movies` jsonb is **deprecated** — UI reads `hero_media_appearances` |
| Pageview popularity                                         | **Wikipedia**                                       | `enwiki_title` → pageviews                                                             |
| Portraits / AI stats                                        | **AI** (Gemini/Imagen)                              | generated, not sourced                                                                 |

**Convergence direction (the simplification path):** SuperheroAPI → ComicVine
for identity; `heroes.movies` → `hero_media_appearances` for screen. When those
are complete, two legacy data paths disappear.

## The drain pattern (every per-row enrichment is this)

```text
┌─ pg_cron ── invoke_edge_function() ── net.http_post ──▶ edge function ─┐
│                    │                                                   │
│                    └─▶ edge_invocations (request id, then the response) │
│                                                                        │
│   1. select next batch where <status> = 'pending'                      │
│      order by issue_count desc   (popularity-first)                    │
│   2. call upstream API (rate-limit aware: retry on 429)                 │
│   3. write columns, flip <status> = 'done' | 'failed'                   │
│      | 'unmatched'  (terminal states leave the backlog)                 │
└────────────────────────────────────────────────────────────────────────┘
```

**Every posting cron goes through `invoke_edge_function(fn, body, jobname)`.**
Never write a raw `net.http_post` into a cron command. The helper reads the
project URL and service-role key from the vault, adds `triggeredBy: 'cron'`, and
— the point of it — records the pg_net request id so the response can be
attributed back to the job. See "Knowing a job worked" below.

Properties: **idempotent, resumable** (no cursor table — status column _is_ the
queue), **popularity-ordered** (users land on enriched rows first), and
**self-healing** (a transient failure stays `pending` for the next run).

### The 6 drains

Cadences below are the live ones as of 2026-08-16. They are slower than the
minute-level ones this table used to list, and deliberately so: these are
backfills of an already-built catalogue, and on the free tier a fleet of
high-frequency crons drains the disk-IO burst budget that user requests share.

| Cron job                     | Every  | Edge function            | Gate column                  | Fills                                                                |
| ---------------------------- | ------ | ------------------------ | ---------------------------- | -------------------------------------------------------------------- |
| `enrich-comicvine-pending`   | daily  | `enrich-comicvine-batch` | `comicvine_status`           | publisher, issues, teams, enemies/friends, powers, desc, first issue |
| `enrich-wikidata-pending`    | 6 h    | `enrich-wikidata-batch`  | `wikidata_status='resolved'` | sitelinks, `hero_media_appearances`, creators/aliases                |
| `enrich-tmdb-pending`        | daily  | `enrich-tmdb-batch`      | `titles.enrich_status`       | title details, **`cast_members`**, posters                           |
| `resolve-enwiki-title-drain` | 6 h    | `resolve-enwiki-title`   | `enwiki_title IS NULL`       | Wikipedia article title                                              |
| `sync-wiki-pageviews-cycle`  | 30 min | `sync-wiki-pageviews`    | (rotates)                    | `pageviews_week`, `views_daily`                                      |

> `enrich-blurhash-pending` used to be listed here at a 2-minute cadence. There
> is no such job scheduled — the backfill drained and it was unscheduled, which
> is the right end state for a one-time drain. A stopped job costs nothing; a
> job left running slowly costs something forever.

> ⚠️ **Wikidata is two steps:** `resolve-wikidata-batch` sets the `qid`
> (deterministic P5905 ComicVine-id → QID; fuzzy name fallback), _then_
> `enrich-wikidata-batch` uses the qid. Resolution currently runs **manually**
> (no cron) — most unresolved heroes have no Wikidata item, so it's low value.

### The attention chain (and why one broken link blanks the surge lane)

`views_daily` is the only measurement Mythique has of what an **audience** did
rather than what a studio announced, and it is reached through four links that
each silently disable the next:

```text
wikidata_qid  →  enwiki_title  →  views_daily  →  pageviews_spike  →  Pulse surge
```

No QID means no article title; no title means no curve; no curve means a
character can never be seen to move, however famous it is. Audited 2026-08-15:

- **`enwiki_title = ''` is a sentinel, not a gap.** 1,019 heroes carry it and it
  means "resolved, no article exists" — the same convention `portrait_blurhash`
  uses. The sweep skips them correctly. Every hero with a real title has a curve.
- **The real gap is QIDs.** 94 heroes at `fame_score >= 40` have none, and the
  ones left are mostly not comic characters (Harry Potter, Gollum, Solid Snake,
  Katniss, Rey), which is why `resolve-wikidata-batch` ordering by `issue_count`
  never reached them. It orders by `fame_score` now; the first run after that
  took the figure from 112 to 94.
- **What remains is name ambiguity, not queue order.** The stragglers are marked
  `unresolved` because a Wikidata search for "Leonardo" returns da Vinci and
  "Raphael" returns the painter. Retrying the same algorithm will not fix it;
  disambiguating with publisher/franchise context is separate work.
- **A failed pageview fetch must never overwrite a curve.** It used to, and the
  damage is unrecoverable — the Wikimedia API serves a rolling window, so a
  series blanked today loses whatever has since fallen out of it.

## Maintenance jobs (pure SQL — no API, no cost)

Fold **new SQL housekeeping here. Do not add new crons for it.**

| Cron job                  | When          | Runs                                                                                                                                                                      |
| ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nightly-maintenance`     | daily 03:40   | `nightly_maintenance()` = `rebuild_hero_relationships()` + `link_tmdb_cast()` + `snapshot_catalog_health()` + `prune_operational_logs()` + `refresh_admin_metrics('all')` |
| `refresh-fame-weekly`     | Sun 04:00     | `refresh_fame()` = auto-tier unrated pool + recompute fame scores                                                                                                         |
| `refresh-explore-bundle`  | hourly at :50 | `refresh_explore_bundle()` — the explore feed's one cached payload                                                                                                        |
| `refresh-admin-catalog`   | 6 h at :20    | `refresh_admin_metrics('catalog')` — the three full-catalogue aggregates                                                                                                  |
| `refresh-admin-community` | hourly at :15 | `refresh_admin_metrics('community')` — votes / takes / profiles                                                                                                           |

- **`rebuild_hero_relationships()`** resolves the `enemies`/`friends`/`teams`
  name arrays into ally/enemy/teammate **cards**. ~50 s, full TRUNCATE+rebuild
  under an ACCESS EXCLUSIVE lock → **daily only**. Must run after any
  enrich/merge that changes those arrays, or the cards stay empty.
- **`link_tmdb_cast()`** writes `titles.cast_members` → `hero_media_appearances`
  (`source='tmdb_cast'`). Matches a credit segment against `heroes.name`, taking
  the most famous hero per name. Three segment shapes qualify: any segment after
  the first ("Civilian / **Hero Alias**"), the first segment of a split credit
  ("**Batman** / Bruce Wayne" — in an animated film this is the lead), and an
  unsplit credit that is multi-word ("Severus Snape"). A bare one-word segment is
  trusted only as a first segment and only above `fame_score` 10; a blocklist
  drops generic role credits (Narrator, Scientist, Mom), which exist as hero rows
  here and would otherwise match thousands of parts. Parenthetical suffixes
  (`(voice)`, `(uncredited)`) are stripped before matching.

  A fourth shape covers **live action**, which credits one actor per character so
  the whole credit is a bare single word (`Supergirl` 2026 ships as
  `["Supergirl","Lobo","Zor-El","Superman", …]`). Those need a guard that fame
  cannot provide — ranking by fame gives `Luigi` → Cars and `Bishop` → Aliens,
  because the famous character is precisely the one that wins a cross-universe
  name collision. The working guard is **universe coherence**: take a bare
  single-word credit only when the title already links a hero of the same
  `publisher`. That plus a `fame_score` floor of 20 measured ~95% precision;
  fame alone measured ~70%.
  Reversible: `delete … where source='tmdb_cast'`.

  Not attempted, deliberately: matching against `heroes.aliases`. It measures
  ~70% precision and the failure is structural, not tunable — when a credit says
  "Wolverine" the canonical hero holds that as his **name**, so only successors
  and variants carry it as an **alias**, and fame ranking then routes the credit
  to the derivative (`diana prince` → Kingdom Come Wonder Woman, `barry allen` →
  Black Flash). Those land on the highest-traffic pages.

- **`heroes.movies` backfill** (migrations `20260815120000` / `20260815130000`)
  swept the legacy ComicVine movie array into `hero_media_appearances`
  (`source='comicvine'`). `register_media_match()` only fans these out when a NEW
  title is matched, so any hero enriched after its films were already in `titles`
  was never fanned out — 4,231 pairs ComicVine explicitly asserted sat unlinked.
  The hero side needs no name resolution (the array hangs off the row), so the
  only ambiguity is the title side; names resolving to more than one title are
  skipped rather than guessed.

## Knowing a job worked (and what it cost)

**A posting cron's pg_cron status is not evidence.** `net.http_post` queues a
request and returns in about 60 ms; pg_cron records `succeeded` and the edge
function behind it may have 500'd, timed out, or not been deployed. For seven
days the fourteen posting jobs reported zero failures, which meant nothing.

The response does exist in `net._http_response`, but it is unusable raw: it
carries an id and no url, `net.http_request_queue` (which has the url) is drained
as requests complete, and the response itself is deleted after roughly six hours.
So there is no path from a response back to the job, and by morning the night's
outcomes are gone.

`invoke_edge_function()` closes both gaps. It keeps the request id at the moment
of creation, when the job name is still in scope, and `reconcile_edge_invocations()`
copies the outcome into `edge_invocations` before pg_net drops it. Reconciliation
is **not a new cron** — `invoke_edge_function` reconciles pending rows on its way
in, and since at least one job posts every hour nothing can age past the
six-hour window unread.

`admin_cron_status()` therefore reports, per job: `last_ms` / `avg_ms_7d` (what
it costs), `runs_24h` / `fails_24h` (pg_cron's own view), and `http_status` /
`http_fails_24h` (what the function actually answered). The command center's dot
is green only when the job ran **and** the thing it triggered came back clean;
`http_*` is null for the SQL-only jobs, which is absent rather than missing.

### Retention

`prune_operational_logs()`, inside `nightly_maintenance()`, is the only thing in
this database that deletes anything: `cron.job_run_details` and
`edge_invocations` at 30 days, `enrichment_runs` and `api_usage` at 90.
`enrichment_run_heroes` follows its parent down via `ON DELETE CASCADE`.

pg_cron never removes a run row on its own — at ~300 rows a day that is roughly
64 MB a year against a 500 MB free-tier cap, and it was the one log with a real
growth problem. The other windows delete nothing today; they are bounds put in
place before they are needed. Add new operational tables to this function when
you add them, not after they matter.

## Signal / freshness syncs

`sync-new-comics-hourly`, `sync-tmdb-trending-daily`, `refresh-tmdb-trending`
(weekly) keep the discovery surfaces fresh. These are **pushes** (pull a feed,
upsert), not per-row drains.

### Trailers come from two sources, and only one of them is fast

`sync-title-videos-hourly` sweeps TMDB `/videos`; `sync-channel-videos-hourly`
reads the official studio channels' YouTube RSS feeds. Both are needed, and the
split is not redundancy:

- **TMDB is richer and slower.** It is community-maintained, so on 2026-08-15 —
  hours into D23 — it held no Avengers: Doomsday "Special Look", no Ahsoka
  season-2 teaser and no VisionQuest trailer. The sweep was correct, current, and
  empty. You cannot sweep your way to data the source does not have.
- **YouTube RSS is immediate and thin.** `youtube.com/feeds/videos.xml?channel_id=`
  needs **no API key and has no quota**, and returns the 15 newest uploads with
  exact publish times. Marvel's own channel had the Doomsday Special Look at
  04:06 UTC that morning.

`sync-channel-videos` only ingests, into `channel_videos`. All judgement lives in
`match_channel_videos()` so it can be re-run over history without re-fetching:

1. **Match** — longest catalogue title contained in the video title, but ranked
   **active-first** (`20260815102000_…`). Length alone matched Star Wars' own
   "Star Wars: Ahsoka Season 2 | Teaser Trailer" to _Star Wars_ (1977), because
   that is the longer substring.
2. **Promote** — only trailer-shaped videos, only onto titles that could still be
   getting a trailer, into `title_videos` as `yt:<videoId>` so the Pulse trailer
   lane needs no changes at all. Marvel's "The X-Men are coming to the MCU."
   matches _X-Men (2000)_ and is correctly never promoted.

Matching is cheap to get wrong (a bad row in a table nothing renders); promoting
is expensive (a false "New trailer" on the front page). Hence two stages with
different tolerances.

**Known gap:** the rail's `trailer_cast` join is an INNER join, so a title with
no `hero_media_appearances` is dropped however good its trailer is. VisionQuest
has zero and does not appear. That is an enrichment gap, not a rail bug.

## Maturity & roadmap

**Mature (cron + drain + status gating):** all 6 drains, the 3 maintenance jobs,
the freshness syncs.

**Gaps (intentionally not automated):**

- **Portraits** (`generate-hero-portrait`) — 💸 AI, on-demand only; ~76 famous
  heroes lack one, and nothing regenerates when source `image_url` changes.
  Needs a fame-ranked drain — **costs money, needs sign-off.**
- **AI stats** (`generate-hero-stats`) — 💸 AI, on-demand, ~20k null.
- **Narrative / TraitBand** — a _live_ feature: `hero_narrative_facts` +
  `hero_tags` render the TraitBand via `useHeroNarrative`. But **stalled** —
  ~1,063 heroes populated, gated by `narrative_status`, and there's **no
  generator cron** (it's AI). Build the generator (💸) or leave as-is. Do **not**
  drop `narrative_status` — it gates a live feature.
- **Wikidata resolution** — no cron (low value, see above).

**Cleanup debt:**

- `get-comicvine-hero` (on-view) duplicates `enrich-comicvine-batch` (drain) —
  same parsing, drifts. Reconcile.
- `backfill-enemies` — superseded by the ComicVine drain (harmless; leave or
  delete). **`backfill-family` is NOT dead** — it is the only writer of
  `hero_relatives` (the family tree); keep it.
- Public `verify_jwt:false` functions still deployed: `seed-comicvine-characters`,
  `enrich-tmdb-batch`, `get-hero-gallery` are cron/render-used, so locking them
  needs their callers updated — don't flip blindly.

### Why not consolidate the drains behind one dispatcher?

Tempting (6 crons → 1), but it trades **declarative, readable** pg_cron
schedules for imperative dispatch logic and a single point of failure. The
drains have **different rate limits, budgets, and cadences** — keeping them
separate is the mature choice. Simplify instead by: (1) this doc, (2) the shared
pattern above, (3) folding SQL housekeeping into `nightly_maintenance()`, and
(4) deleting the cleanup-debt functions.

## Adding a new pipeline (the convention)

1. New per-row enrichment? Add a `<thing>_status` column, write a
   `enrich-<thing>-batch` edge function following the drain pattern, add one
   `enrich-<thing>-pending` cron. Name the cron `<verb>-<thing>-<cadence>`.
   Its command is **one line**:
   `select public.invoke_edge_function('enrich-<thing>-batch', jsonb_build_object('limit', 25), '<jobname>');`
   Never a raw `net.http_post` — that is how the URL, the key and the timeout
   drifted into fourteen slightly different copies, and it is how a failing
   function stays invisible.
2. New SQL-only derive? Add it to `nightly_maintenance()` — **no new cron**.
3. Always: popularity-order the batch, gate on a terminal status (not field
   nullness), make it idempotent, log to `enrichment_runs`.
4. **Pick the cadence from how fast the answer changes, not from how fresh you
   would like it to be.** Two jobs here were recomputing on a clock unrelated to
   their inputs: the explore bundle rebuilt "which characters debuted this
   month" 24 times a day for a value that changes 12 times a year, and the admin
   metrics scanned the whole 243 MB `heroes` heap every 20 minutes to observe
   enrichment that runs every 6 hours. Neither was slow because the SQL was bad.
5. If a job's `'limit'` is meant to be editable from the command center, keep the
   literal `'limit', N` in its command — `admin_reschedule_cron` rewrites batch
   sizes with a regex against exactly that text.
