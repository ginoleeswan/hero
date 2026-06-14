# Wikidata Cross-Media Appearance Backbone — Design

**Date:** 2026-06-14
**Status:** Approved (design)
**Lane:** 3 of 4 in the DB-enrichment effort
**Part of:** `2026-06-14-enrichment-roadmap.md`
**Brief:** `2026-06-14-deeper-factual-lane-brief.md`
**Couples with:** `2026-06-14-tmdb-media-enrichment-design.md` (the shipped film lane this generalizes)

## Goal

Two interlocking jobs, both anchored on **Wikidata**:

1. **Cross-media appearance backbone (the big one).** Source *which* films, TV
   series, and video games each hero appears in. Wikidata stores the external IDs
   we need as first-class properties, so appearance edges arrive typed and
   ID-stamped — no fuzzy title matching. This becomes the single source of
   "appears-in" edges, generalizing Lane 1's film-only `films` tables into a
   media-agnostic `titles` backbone.
2. **Encyclopedic facts.** Voice actors/performers, canonical first-appearance
   dates, creator credits, awards — structured data SuperheroAPI and ComicVine
   don't provide.

This lane **owns** the media backbone: it renames and extends Lane 1's tables and
edits the On-Screen UI. The shipped film experience must not regress.

## Decisions (resolved in brainstorming)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Generalize `films`→`titles` in place vs. parallel tables | **In place** — rename + extend, one migration, single source of truth. |
| 2 | Wikidata-only vs. +Marvel for facts | **Wikidata-only for v1.** Every fact table carries a `source` column so Marvel/ComicVine can layer in later without a migration. |
| 3 | On-Screen split by media type vs. interleave | **Typed shelves** (Films / TV / Games) under one "On Screen" section; each renders only if non-empty. Film shelf visually unchanged. |
| 4 | IGDB now vs. fast-follow | **Wikidata + TV now; games stored-but-deferred.** Game edges persist from day one; IGDB enrichment + Games shelf are a separate fast-follow spec. |
| 5 | Entity-resolution confidence + manual review | **Conservative auto-accept** (high precision); `resolved`/`ambiguous`/`unresolved` tiers; ambiguous marquee heroes reviewed in the existing **command center** admin (no new admin app). |
| 6 | Which facts surface in UI | **"Portrayed by"** = one new section; creators + first-appearance enrich existing surfaces; awards stored DB-only. |

## Why Wikidata makes the backbone clean

Wikidata models a fictional character and the works it appears in, and stores the
**external IDs we need as properties** — so we skip the title-matching the film
lane had to do:

- Character → works via **present in work** (P1441) / **characters** (P674) /
  **performer** (P175), classified by the work's type (film / TV series / video
  game).
- Works carry **TMDB movie ID** (P4947), **TMDB TV series ID** (P4983), **IGDB
  game ID** (P5794) as first-class properties.

One SPARQL query per resolved hero yields a typed, ID-stamped list of appearances
across all three media types. Resolution effort is front-loaded onto the
*character* (resolve the QID once); the *media* IDs then come for free.

SPARQL endpoint: `https://query.wikidata.org/sparql` (free, no key; be polite —
descriptive `User-Agent`, modest batch sizes, cache the QID).

## Source roles (unchanged division of labour)

- **Wikidata (this lane)** = appearance edges + external IDs + encyclopedic facts.
- **TMDB (Lane 1, generalized here)** = enrich **film and TV** titles (posters,
  backdrops, trailers, cast, stills, providers).
- **IGDB (fast-follow)** = enrich games.
- **ComicVine** stays as the supplementary film source / fallback for heroes
  Wikidata doesn't cover (the existing `heroes.movies` jsonb is untouched).

## Live schema baseline (as inspected)

- `films` — 723 rows, **all `tmdb_status='done'`**. PK `tmdb_id text`. Already has
  a `media_type` column (currently all `'movie'`).
- `hero_film_appearances` — 2,867 rows. PK `(hero_id, tmdb_id)` + `cv_name`,
  `cv_url`, `rank`.
- `tmdb_match_queue` — 791 rows; drives the CV-title → TMDB match phase.
- `register_film_match(p_cv_name, p_tmdb_id, p_media_type, p_title)` RPC — inserts
  a `films` stub and fans appearance edges to every hero whose `movies` jsonb
  contains the CV title (rank = `issue_count`).
- `heroes` — 3,041 rows; disambiguation hints available: `publisher`,
  `first_appearance` (text), `aliases[]`, `full_name`, `creators[]`, `issue_count`.

## Data model (one migration, rename-and-generalize)

### `titles` (rename + extend `films`)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text | **New surrogate PK** `'<source>:<external_id>'` (e.g. `tmdb:603`, `igdb:1020`). Prevents bare-integer collisions across sources. |
| `source` | text | `'tmdb' \| 'igdb'`. Check constraint. |
| `media_type` | text | `'film' \| 'tv' \| 'game'`. Check constraint. (Existing `'movie'` rows remap to `'film'`.) |
| `external_id` | text | The raw source id (TMDB or IGDB), retained for API calls. |
| `tmdb_id` | text | **Kept** during transition for the compat path; equals `external_id` for tmdb rows. |
| `title` | text | |
| `release_date` | date | nullable |
| `year` | int | generated from `release_date` |
| `poster_url` / `backdrop_url` | text | nullable (game box-art reuses `poster_url`) |
| `overview` | text | nullable |
| `vote_average` | numeric | nullable |
| `trailer_key` | text | YouTube key, nullable |
| `watch_providers` | jsonb | nullable |
| `cast_members` | jsonb | nullable |
| `stills` | jsonb | nullable |
| `runtime` | int | film only, nullable |
| `revenue` | bigint | film only, nullable |
| `details` | jsonb | **New** — source/media-specific extras (TV: seasons, networks, episode_count; game: platforms, metacritic). Escape hatch to avoid column sprawl. |
| `enrich_status` | text | **Renamed** from `tmdb_status`. `'pending' \| 'done' \| 'unmatched' \| 'failed'`. |
| `enriched_at` | timestamptz | **Renamed** from `tmdb_enriched_at`. |

### `hero_media_appearances` (rename + extend `hero_film_appearances`)

| Column | Type | Notes |
| --- | --- | --- |
| `hero_id` | text | FK → `heroes.id` |
| `title_id` | text | FK → `titles.id` |
| `media_type` | text | denormalized for cheap per-shelf filtering |
| `source` | text | provenance of the edge (`'wikidata' \| 'comicvine'`) |
| `rank` | int | popularity ordering = `issue_count`, nullable |
| `cv_name` / `cv_url` | text | provenance for ComicVine-sourced edges, nullable |

PK `(hero_id, title_id)`.

### `heroes` (new columns — 1-to-1)

| Column | Type | Notes |
| --- | --- | --- |
| `wikidata_qid` | text | resolved once, reused. Nullable. |
| `wikidata_status` | text | `'pending' \| 'resolved' \| 'ambiguous' \| 'unresolved'`, default `'pending'`. |
| `wikidata_candidates` | jsonb | top candidate QIDs + scores, for the ambiguous-review path. Nullable. |
| `wikidata_enriched_at` | timestamptz | last successful fact/edge enrichment. Nullable. |

### `hero_people` (new side-table — 1-to-many facts)

| Column | Type | Notes |
| --- | --- | --- |
| `hero_id` | text | FK → `heroes.id` |
| `person_name` | text | |
| `role` | text | `'voice_actor' \| 'performer' \| 'creator'` |
| `title_id` | text | nullable FK → `titles.id` (which work they're credited on, when known) |
| `source` | text | `'wikidata'` for v1; column exists so Marvel/CV can append later. |

PK `(hero_id, person_name, role, title_id)` (a person can voice across multiple
titles). Public-read RLS.

### `hero_facts` (new side-table — scalar facts not surfaced yet)

A minimal key/value store so awards (and any future scalar facts) are captured
without column sprawl or a per-fact table.

| Column | Type | Notes |
| --- | --- | --- |
| `hero_id` | text | FK → `heroes.id` |
| `key` | text | e.g. `'award'` |
| `value` | text | e.g. the award label/year |
| `source` | text | `'wikidata'` for v1 |

PK `(hero_id, key, value)`. Public-read RLS. **Not surfaced in v1** — awards UI is
a later cycle; this just prevents the data being thrown away.

### RLS

**Every new/renamed table gets a public-read RLS policy.** RLS is auto-enabled on
new tables; without an explicit anon-read policy the client reads 0 rows and
queries silently return empty (a known project gotcha).

### RPC changes

- `register_film_match` → **`register_media_match(p_cv_name, p_external_id,
  p_source, p_media_type, p_title)`** — same fan-out logic, writing the composite
  `id` and the generalized appearance table. A thin `register_film_match` wrapper
  may remain temporarily so the unchanged TMDB matcher keeps working until it is
  cut over.
- New **`resolve_hero_qid(p_hero_id, p_qid)`** (SECURITY DEFINER) — sets
  `wikidata_qid`, flips `wikidata_status='resolved'`, clears candidates. Backs the
  admin manual-review action.

### Backfill (in the migration)

1. Add columns; populate `titles.source='tmdb'`, `external_id=tmdb_id`,
   `id='tmdb:'||tmdb_id`, remap `media_type 'movie'→'film'`, copy
   `tmdb_status→enrich_status`, `tmdb_enriched_at→enriched_at`.
2. Repoint `hero_media_appearances.title_id = 'tmdb:'||tmdb_id`, set
   `media_type='film'`, `source='comicvine'` (existing edges came via CV).
3. Recreate PK/FK/constraints; add RLS policies; install the generalized RPCs.

After the migration, **regenerate `src/types/database.generated.ts`** via the
Supabase MCP (never hand-edit).

## Entity resolution (the crux): hero → QID

Front-loaded, conservative, high-precision. Wrong appearance edges (showing the
wrong character's film) are worse in an encyclopedia than a temporarily-empty
section.

**Candidate search:** SPARQL search by `name` + `aliases[]`; hard-filter to
`instance of` fictional character/superhero (P31).

**Scoring signals** (per candidate QID):
- publisher match (P1080 narrative universe / P123 publisher) vs. `heroes.publisher`
- first-appearance/inception year proximity vs. `heroes.first_appearance`
- creator overlap (P170) vs. `heroes.creators[]`
- alias/name overlap

**Outcome tiers (stored on `heroes`):**
- **`resolved`** — clear single winner above threshold → store `wikidata_qid`,
  proceed to enrich.
- **`ambiguous`** — multiple close candidates or winner below the confidence gap →
  store top candidates in `wikidata_candidates`, status `ambiguous`, **not
  auto-retried**. Surfaced to admin review.
- **`unresolved`** — no plausible candidate → status `unresolved`, **not retried
  forever** (mirrors the TMDB `unmatched` pattern); explicitly retryable via a flag.

**Manual review (existing command center, no new app):** a new panel in
`OperationsDomain` lists `ambiguous` heroes ordered by `issue_count` (marquee
first) with their candidate QIDs/labels and a **"set QID"** action wired through a
new `catalogHealth` mutation → `resolve_hero_qid` RPC. Reuses the existing
per-row busy-state + react-query invalidation pattern (the `reenrichHero` flow is
the template). No user-facing review UI.

## Pipelines (edge functions)

All mirror the `enrich-comicvine-batch` / `enrich-tmdb-batch` drain pattern:
resumable, popularity-ordered, `POST { limit?, ... }`, logging runs to
`enrichment_runs` and call counts to `api_usage`. Each registers its own cron;
check combined API-budget load.

### `resolve-wikidata-batch` (new)
Take `heroes` with `wikidata_status='pending'` (popularity-ordered), run candidate
search + scoring, write the outcome tier. SPARQL is free but be polite (descriptive
`User-Agent`, small batches, delay between calls).

### `enrich-wikidata-batch` (new)
For `resolved` heroes (cache-fill gating on `wikidata_status`, **not** a timestamp,
to avoid the ComicVine read-through coupling mistake), one SPARQL query returns:
- typed appearance works with external IDs → upsert `titles` stubs
  (`enrich_status='pending'`, correct `source`/`media_type`/`id`), insert
  `hero_media_appearances` edges (`source='wikidata'`, rank = `issue_count`).
- facts → `hero_people` (performers/voice actors/creators) and fill `heroes` fact
  gaps (canonical first-appearance date, creators). Awards stored (table TBD-light:
  may live in `details`/a small `hero_facts` extension) but **not surfaced** in v1.
- Game edges (`source='igdb'`) are written but left `enrich_status='pending'` — no
  IGDB drain in this lane.

### `enrich-tmdb-batch` (generalize the shipped function)
Branch the enrich phase on `media_type`: `/movie/{id}` (existing) and `/tv/{id}`
(new — maps TV-specific fields into `details`: seasons, networks, episode_count;
reuses poster/backdrop/overview/cast/trailer/providers/stills mapping). The match
phase stays for the legacy CV-title path; Wikidata-sourced titles arrive
pre-matched (ID-stamped) and skip straight to enrich.

## Client + UI

- **`src/lib/db/films.ts` → `src/lib/db/titles.ts`** (generalized). `getHeroTitles`
  joins `hero_media_appearances → titles`, returns items grouped/filterable by
  `media_type`. `getTitleById`, `getTitleHeroes` generalize their film
  equivalents. Update the few consumers (`MovieStrip`, `/film/[tmdbId]`,
  `[id].tsx`); keep a thin `films.ts` re-export only if a clean cutover proves
  noisy.
- **`MovieStrip`** renders **typed shelves**: Films, TV (Games hidden until the
  fast-follow), each only if non-empty. Film shelf renders exactly as today
  (featured backdrop + decade shelves on web, strip on native). Game cards =
  portrait box-art (reuse poster card), added with IGDB.
- **`/film/[tmdbId]` → `/title/[id]`** — generalized detail screen; metadata rows
  branch by `media_type` (film: runtime/box-office; TV: seasons/networks; game:
  platforms/metacritic). **`/film/[tmdbId]` kept as a redirect** to
  `/title/tmdb:<id>` so existing links and the Lane 1 code path don't regress.
- **New "Portrayed by" section** on `app/character/[id].tsx` — its own section
  component reading `hero_people` (voice actors/performers), placed with a single
  import + one placement line per the roadmap's collision rule. Pairs naturally
  with the cross-media shelves.
- **Creators + canonical first-appearance** enrich the existing Quick Facts /
  dossier surfaces (no new section). **Awards** stay DB-only in v1.

## Testing

Project convention — unit-test pure logic with mocked fetch/SPARQL; no
screen/render tests:

- **QID scorer** — signal weighting, the auto-accept threshold, the ambiguous gap,
  tier assignment.
- **Wikidata SPARQL → edges/facts mapper** — from fixture JSON: typed works with
  external IDs → `titles` stubs + edges; performers/creators → `hero_people`.
- **TMDB TV mapper** — `/tv/{id}` details → `titles` row (`details` fields).
- **ID namespacing** — `tmdb:`/`igdb:` composite id construction + parsing.

## Sequencing

1. **Migration + backfill** → regenerate types. Verify the film path is unbroken
   (titles.ts + MovieStrip + `/title` redirect) **before** any new drain.
2. **`resolve-wikidata-batch`** drain + admin ambiguous-review panel.
3. **`enrich-wikidata-batch`** drain (edges + facts; game edges stored).
4. **Generalize `enrich-tmdb-batch`** for TV; TV shelf renders.
5. **"Portrayed by"** section + creators/first-appearance fact surfacing.

**Out of scope (fast-follow spec):** `enrich-igdb-batch` (Twitch OAuth
client-credentials → bearer token, server-side only; APICalypse query API), the
Games shelf, and game-detail metadata. The row shape already supports games, so
the follow-up adds a drain + a shelf with zero schema churn. Marvel API facts and
awards UI are likewise deferred.

## Collision notes (per roadmap)

- `src/types/database.generated.ts` — regenerate after the migration; resolve any
  cross-lane conflict by re-running the generator, not hand-merging.
- `app/character/[id].tsx` — one new section component + one placement line.
- `app.config.ts` `extra` — IGDB (Twitch) keys land in the **fast-follow**, not
  this lane; this lane adds no client-read keys (Wikidata needs none; TMDB key
  already a Supabase secret).
- This lane edits Lane 1's tables and On-Screen UI — coordinate closely; favor an
  isolated git worktree if run alongside other lanes.
</content>
</invoke>
