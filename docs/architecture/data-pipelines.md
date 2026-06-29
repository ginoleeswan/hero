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

```
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

| Domain | Authoritative source | Notes |
| --- | --- | --- |
| Comic canon (issues, teams, enemies, powers, first issue) | **ComicVine** | `comicvine_id` is the key |
| Identity / base stats (name, gender, alignment, powerstats) | **SuperheroAPI** (legacy) → migrating to ComicVine | numeric ids only; being phased out |
| Cross-linking + popularity signal | **Wikidata** (`wikidata_qid`, P5905 = ComicVine id) | drives sitelinks → fame |
| Screen appearances ("On Screen") | **TMDB** (`titles` + `hero_media_appearances`) | the legacy `heroes.movies` jsonb is **deprecated** — UI reads `hero_media_appearances` |
| Pageview popularity | **Wikipedia** | `enwiki_title` → pageviews |
| Portraits / AI stats | **AI** (Gemini/Imagen) | generated, not sourced |

**Convergence direction (the simplification path):** SuperheroAPI → ComicVine
for identity; `heroes.movies` → `hero_media_appearances` for screen. When those
are complete, two legacy data paths disappear.

## The drain pattern (every per-row enrichment is this)

```
┌─ pg_cron (every N min) ── net.http_post ──▶ edge function ─┐
│                                                            │
│   1. select next batch where <status> = 'pending'         │
│      order by issue_count desc   (popularity-first)        │
│   2. call upstream API (rate-limit aware: retry on 429)    │
│   3. write columns, flip <status> = 'done' | 'failed'      │
│      | 'unmatched'  (terminal states leave the backlog)    │
└────────────────────────────────────────────────────────────┘
```

Properties: **idempotent, resumable** (no cursor table — status column *is* the
queue), **popularity-ordered** (users land on enriched rows first), and
**self-healing** (a transient failure stays `pending` for the next run).

### The 6 drains

| Cron job | Every | Edge function | Gate column | Fills |
| --- | --- | --- | --- | --- |
| `enrich-comicvine-pending` | 15 min | `enrich-comicvine-batch` | `comicvine_status` | publisher, issues, teams, enemies/friends, powers, desc, first issue |
| `enrich-wikidata-pending` | 15 min | `enrich-wikidata-batch` | `wikidata_status='resolved'` | sitelinks, `hero_media_appearances`, creators/aliases |
| `enrich-tmdb-pending` | 15 min | `enrich-tmdb-batch` | `titles.enrich_status` | title details, **`cast_members`**, posters |
| `resolve-enwiki-title-drain` | 5 min | `resolve-enwiki-title` | `enwiki_title IS NULL` | Wikipedia article title |
| `sync-wiki-pageviews-cycle` | 10 min | `sync-wiki-pageviews` | (rotates) | `pageviews_week` |
| `enrich-blurhash-pending` | 2 min | `enrich-blurhash-batch` | `portrait_blurhash` empty | LQIP placeholder hash |

> ⚠️ **Wikidata is two steps:** `resolve-wikidata-batch` sets the `qid`
> (deterministic P5905 ComicVine-id → QID; fuzzy name fallback), _then_
> `enrich-wikidata-batch` uses the qid. Resolution currently runs **manually**
> (no cron) — most unresolved heroes have no Wikidata item, so it's low value.

## Maintenance jobs (pure SQL — no API, no cost)

Fold **new SQL housekeeping here. Do not add new crons for it.**

| Cron job | When | Runs |
| --- | --- | --- |
| `nightly-maintenance` | daily 03:40 | `nightly_maintenance()` = `rebuild_hero_relationships()` + `link_tmdb_cast()` |
| `refresh-fame-weekly` | Sun 04:00 | `refresh_fame()` = auto-tier unrated pool + recompute fame scores |
| `catalog-health-snapshot` | daily 00:05 | `snapshot_catalog_health()` |

- **`rebuild_hero_relationships()`** resolves the `enemies`/`friends`/`teams`
  name arrays into ally/enemy/teammate **cards**. ~50 s, full TRUNCATE+rebuild
  under an ACCESS EXCLUSIVE lock → **daily only**. Must run after any
  enrich/merge that changes those arrays, or the cards stay empty.
- **`link_tmdb_cast()`** writes `titles.cast_members` → `hero_media_appearances`
  (`source='tmdb_cast'`). Matches the alias part of a "Civilian / Hero Alias"
  credit for precision. Reversible: `delete … where source='tmdb_cast'`.

## Signal / freshness syncs

`sync-new-comics-hourly`, `sync-tmdb-trending-daily`, `refresh-tmdb-trending`
(weekly) keep the discovery surfaces fresh. These are **pushes** (pull a feed,
upsert), not per-row drains.

## Maturity & roadmap

**Mature (cron + drain + status gating):** all 6 drains, the 3 maintenance jobs,
the freshness syncs.

**Gaps (intentionally not automated):**

- **Portraits** (`generate-hero-portrait`) — 💸 AI, on-demand only; ~76 famous
  heroes lack one, and nothing regenerates when source `image_url` changes.
  Needs a fame-ranked drain — **costs money, needs sign-off.**
- **AI stats** (`generate-hero-stats`) — 💸 AI, on-demand, ~20k null.
- **`narrative_status`** — column exists (~33k "pending") but **no writer**.
  Decide: build a generator or drop the column.
- **Wikidata resolution** — no cron (low value, see above).

**Cleanup debt:**

- `get-comicvine-hero` (on-view) duplicates `enrich-comicvine-batch` (drain) —
  same parsing, drifts. Reconcile.
- `backfill-enemies`, `backfill-family` — one-off, superseded by the drain.
- `backfill-cv-meta`, `resolve-cv-id` — one-off dedup tooling; both
  `verify_jwt:false` **public DB-writers** (so are `seed-comicvine-characters`,
  `enrich-tmdb-batch`). Lock or `supabase functions delete`.

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
2. New SQL-only derive? Add it to `nightly_maintenance()` — **no new cron**.
3. Always: popularity-order the batch, gate on a terminal status (not field
   nullness), make it idempotent, log to `enrichment_runs`.
