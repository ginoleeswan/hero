# TMDB Trending on Screen — freshness engine #2

**Date:** 2026-06-28
**Status:** Design — approved, pending spec review
**Engine:** #2 of 4 in the freshness-engines roadmap (#1 ComicVine comics shipped)

## Context

The freshness audit found the app should lean on self-renewing external signals.
Engine #1 (ComicVine weekly comics) shipped. This is **#2: TMDB Trending** — a
daily-renewing rail driven by TMDB's global trending feed, mapped onto the
catalogue characters in those titles. It reuses the established freshness shape:
an edge function on a `pg_cron` drain → an RPC → a rail in the Explore "Right Now"
band, exactly like the comics engine and the existing `get_trending_titles` rail.

We already sync TMDB into `titles` (`popularity`, `trailer_key`, `release_date`,
`external_id`, `media_type`, `source`) via `enrich-tmdb-batch`, and titles link to
catalogue characters through `hero_media_appearances`. So the data backbone exists;
this engine adds a daily "what's trending right now" ranking on top of it.

## Goal

A **"Trending on Screen"** poster rail in the Right Now band, refreshed daily from
TMDB's `/trending/all/day` list, showing the trending films/TV that have catalogue
characters — each tappable to its title page, with a **▶ Trailer** affordance
(reusing the `trailer_key` we already store). Renews itself daily with no curation.

## Decisions (locked)

- **Source:** TMDB `/trending/all/day` (a true daily-renewing global list), **not**
  the stored `popularity` field (volatile, not "trending").
- **Surface:** a rail in the Explore Right Now band (sibling of "On Screen Now").
- **Gate:** only titles already in our `titles` table (which, by construction, have
  catalogue characters) — the intersection is exactly "trending character content."
- **Out of scope (v1):** "new trailer dropped *this week*" recency badging — that
  needs per-video publish dates we don't store. Trailer **playback** (we have the
  key) is in; recency framing is a fast-follow.

## Architecture

| Layer | This engine | Mirrors |
| --- | --- | --- |
| Storage | `titles.trending_rank` + `titles.trending_at` columns | comic_issues fields |
| Ingest | `sync-tmdb-trending` edge fn + daily `pg_cron` | enrich-tmdb-batch + schedule_tmdb_drain |
| Read | `get_trending_on_screen` RPC + `db/trending.ts` | get_trending_titles |
| UI | `TitlePosterRail` "Trending on Screen" in RightNowBand | existing On-Screen rail |

### 1. Data model (migration)

```sql
alter table public.titles add column if not exists trending_rank smallint; -- 1..N today, else null
alter table public.titles add column if not exists trending_at timestamptz; -- when last marked trending
create index if not exists titles_trending_rank_idx on public.titles (trending_rank) where trending_rank is not null;
```

No new table — a daily-rewritten rank on the rows we already have.

### 2. Ingest — `sync-tmdb-trending` edge function

Mirrors `enrich-tmdb-batch`'s shape (Deno, `TMDB_API_KEY`, CORS, `api_usage` log).

1. Fetch `GET /trending/all/day?api_key=…` (optionally pages 1–2 for ~40 results).
   Keep `media_type in ('movie','tv')`; drop `person`.
2. For each trending result, map TMDB id → our `titles` by
   `external_id = String(tmdb_id)` and `source = 'tmdb'` and matching media type
   (`movie`→`film`). Collect the matched `titles.id`s **in trending order**.
3. In one pass: clear yesterday's marks (`update titles set trending_rank = null
   where trending_rank is not null`), then set `trending_rank = <ordinal>,
   trending_at = now()` for each matched title (ordinal = its position in the
   trending list).
4. POST body `{ triggeredBy? }`. Returns `{ fetched, matched }`.

**Schedule:** a `pg_cron` migration firing `net.http_post` into it **daily**
(`0 8 * * *`), mirroring `schedule_tmdb_drain`. To pause: `cron.unschedule(...)`.

### 3. Read — `get_trending_on_screen` RPC + `db/trending.ts`

```sql
get_trending_on_screen(p_limit int default 12, p_chars_per_title int default 10)
returns table ( title_id text, title text, media_type text, release_date date,
                poster_url text, backdrop_url text, trailer_key text, provider text,
                hero_id text, hero_name text, hero_image_url text, hero_portrait_url text )
```

- `where t.trending_rank is not null and exists (catalogue char with portrait)`
- `order by t.trending_rank asc`; characters within a title by fame.
- Flat rows grouped client-side in `db/trending.ts` (a `getTrendingOnScreen()`
  beside `getTrendingTitles`, returning the existing `TrendingTitle` shape so it
  reuses the rail unchanged — plus `trailer_key` for the play affordance).
- `grant execute … to anon, authenticated, service_role`.

### 4. UI

- A **"Trending on Screen"** rail in both `RightNowBand` views via the existing
  `TitlePosterRail` (label "Trending Today", title "Trending on Screen"), fed from
  `useExploreData` (`getTrendingOnScreen()` → `trendingOnScreen` field).
- A small **▶** badge on cards whose `trailer_key` is set; tapping the card opens
  the title page (where the trailer already plays). No new trailer screen.
- Hidden when empty (`length === 0`) — some days the trending∩catalogue set is
  small; the rail simply doesn't render.

## Failure modes & edge cases

- **TMDB down / non-200:** function logs + exits; the previous day's marks remain
  (stale-but-present). Never errors the band.
- **No catalogue intersection today:** RPC returns `[]`; rail hides.
- **Stale marks:** every successful run clears all marks first, so a title only
  shows while it's trending today.
- **Person results / wrong media type:** filtered out at ingest.

## Out of scope (future / other specs)

- "New trailer this week" recency (needs `/videos` publish dates → a small extra
  fetch + a `trailer_published_at` column).
- Ingesting trending titles **not** yet in our catalogue (would need on-the-fly
  title + character ingestion).
- Per-character "trending on screen" badges (a fast-follow once the rail exists).

## Open questions

None blocking. The daily cron hour and `p_limit` are tunable post-launch.
