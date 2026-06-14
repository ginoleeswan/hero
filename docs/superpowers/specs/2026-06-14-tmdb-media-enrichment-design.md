# TMDB Media Enrichment — Design

**Date:** 2026-06-14
**Status:** Approved (design)
**Lane:** 1 of 4 in the broader DB-enrichment effort (this spec covers media only;
LLM narrative, deeper factual data, and richer relationships are separate future
spec cycles).

## Goal

Make hero detail screens visually rich by surfacing real film/TV media — proper
posters, backdrops, trailers, "where to watch", cast, and stills — sourced from
**TMDB**. ComicVine already tells us *which* films a character appears in, but its
movie data is thin (`year` almost always null, no revenue, spotty ratings, no
trailers, no streaming providers, no backdrops). TMDB fills exactly those gaps.

## Source roles

The two sources are complementary, not competing:

- **ComicVine** — the *appearance source*. It is the only source that knows which
  films/series a given character features in. We keep using it for that.
- **TMDB** — the *film-richness source*. Given a film title (+ optional year), it
  returns release date, artwork, ratings, runtime, revenue, trailer keys, watch
  providers, cast, and still images.

They join through a normalized `films` table so each film's heavy media payload is
stored exactly once and reused across every hero that appears in it.

## Why normalized (rejected alternatives)

The current `movies` data is a `jsonb[]` array stored **per hero** (Batman: 110
entries, Superman: 77), with heavy overlap — every Justice League member lists the
same shared films. Two alternatives were considered and rejected:

- **Enrich the `movies` jsonb in place** — smallest change, but re-fetches and
  re-stores the same film's TMDB payload (trailers, providers, stills) once per
  hero. Massive duplication, no cross-hero reuse, no path to a film-centric
  screen. Would be redone as the normalized version within weeks.
- **Side-table keyed by `tmdb_id`, jsonb keeps the list** — dedupes heavy media
  but leaves two sources of truth for "what films exist" and messier joins.

Chosen: a normalized `films` table + `hero_film_appearances` join. It dedupes the
expensive TMDB calls (key rate-limit insurance), sets up a future film/episode
detail screen and "where to watch", and matches how the project already normalized
`hero_relationships` and `hero_relatives` into their own tables.

## Data model (new migration)

### `films` — one row per matched TMDB title

| Column | Type | Notes |
| --- | --- | --- |
| `tmdb_id` | text | PK (namespaced by media_type if needed) |
| `media_type` | text | `'movie' \| 'tv'` (check constraint) |
| `title` | text | |
| `release_date` | date | nullable |
| `year` | int | generated from `release_date` |
| `poster_url` | text | nullable |
| `backdrop_url` | text | nullable |
| `overview` | text | nullable |
| `vote_average` | numeric | nullable |
| `runtime` | int | nullable |
| `revenue` | bigint | nullable |
| `trailer_key` | text | YouTube key, nullable |
| `watch_providers` | jsonb | by region, nullable |
| `cast` | jsonb | top N cast, nullable |
| `stills` | jsonb | array of image URLs, nullable |
| `tmdb_enriched_at` | timestamptz | nullable |
| `tmdb_status` | text | `'pending' \| 'done' \| 'unmatched' \| 'failed'`, default `'pending'` — mirrors `comicvine_status` |

### `hero_film_appearances` — join

| Column | Type | Notes |
| --- | --- | --- |
| `hero_id` | text | FK → `heroes.id` |
| `tmdb_id` | text | FK → `films.tmdb_id` |
| `cv_name` | text | provenance: original CV movie title |
| `cv_url` | text | provenance: original CV url |
| `rank` | int | popularity ordering (like relationships), nullable |

PK `(hero_id, tmdb_id)`. **Both new tables get a public-read RLS policy** — RLS is
auto-enabled on new tables, and without an explicit anon-read policy the client
reads 0 rows and queries silently return empty.

The existing `heroes.movies` jsonb is left untouched and serves as a fallback for
any hero whose films have not yet been drained.

## Matching (the one hard part)

A `films` row originates from a distinct CV movie title. The matcher runs in two
phases to keep noisy per-hero matching separate from clean per-film enrichment:

**Phase 1 — match & link (per CV movie entry):**
1. Pull a batch of CV `movies` entries (across heroes, popularity-ordered) not yet
   linked to a `tmdb_id`.
2. `GET /search/movie` by title (and `/search/tv` for series); pick the best match
   using title similarity + a year hint when CV provides one.
3. No confident match → record the film as `tmdb_status = 'unmatched'` so it is not
   retried forever (retryable explicitly via a flag).
4. On match, upsert into `films` by `tmdb_id` (status stays `pending` for phase 2)
   and insert the `hero_film_appearances` edge.

**Phase 2 — enrich (per unique film):**
5. For `films` rows still `pending`, issue one TMDB details call with
   `append_to_response=videos,watch/providers,images,credits` and populate the
   media columns; set `tmdb_status = 'done'`.

## Pipeline

- New edge function `enrich-tmdb-batch`, mirroring `enrich-comicvine-batch`:
  resumable, popularity-ordered, `POST { limit?: number, retryUnmatched?: boolean }`.
- Logs runs to `enrichment_runs` and call counts to `api_usage`.
- Cron drain on a cadence. TMDB dropped its hard rate limit in 2019 (practical
  guidance ~50 req/sec per IP) and tolerates steady automated use, so this drain
  can run hotter than the CV drain. A small politeness delay is still applied.
- `TMDB_API_KEY` added to `app.config.ts` `extra` and `.env.example`; read
  **server-side only** in the edge function via `Deno.env.get`. Never inlined into
  the client bundle.

## Client

- New `src/lib/db/films.ts` query module (screens never import `supabase`
  directly — project convention). `getHeroFilms(heroId)` joins
  `hero_film_appearances` → `films`, ordered by `rank`.
- `MovieStrip` upgrades to consume `films` rows: real posters, year badges, a play
  affordance on cards that have a `trailer_key`, and provider badges. Falls back to
  the legacy `heroes.movies` jsonb when a hero has no drained films yet.
- `MovieDetailSheet` gains: trailer playback (embed the YouTube `trailer_key` —
  web iframe / native via `expo-video` or `react-native-webview`), a stills
  gallery, cast list, and watch-provider badges.

## Testing

Per the project's testing convention (unit-test pure logic with mocked
fetch/Supabase; no screen/render tests):

- Matcher: title normalization, year tie-breaking, the unmatched threshold.
- Mapper: TMDB details response → `films` row, from fixture JSON.

## Out of scope (separate spec cycles)

- A dedicated film/TV **detail screen**.
- Linking TMDB `cast` → a future voice-actor / people table.
- The other three enrichment lanes: LLM narrative, deeper factual data
  (Wikidata/Marvel), richer relationships.
