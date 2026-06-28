# ComicVine Weekly Comics — "New This Week" freshness engine

**Date:** 2026-06-28
**Status:** Built & shipped — see _Revision: volume-roster ingest_ below for the
one design change forced by ComicVine's live API.
**Engine:** #1 of 4 in the "freshness engines" roadmap (see _Context_)

> ## Revision: volume-roster ingest (implementation finding)
>
> The original ingest (below) assumed ComicVine's `/issues` **list** endpoint
> returns each issue's `character_credits`. It does **not** — credits live only on
> the per-issue **detail** endpoint, which is harshly rate-limited (`status 107,
> "slow down cowboy"` after a small burst). So "read credits off the weekly list"
> is impossible.
>
> **Pivot (built):** attribute an issue's characters from its **series (volume)
> roster** instead of per-issue credits. A new service-role-only cache table
> `comic_volumes` stores each volume's resolved catalogue characters; the edge
> function resolves a volume's roster **once** (capped per run, backs off on 107)
> and thereafter attributes new issues of that series with **zero** detail calls.
> Lead character = the catalogue hero whose name the **series name** contains
> (e.g. "Absolute Superman" → Superman), falling back to centrality/fame for team
> books — because the roster's `count` field is too sparse to pick a lead.
>
> Everything else in this spec held: `comic_issues` / `comic_issue_appearances`,
> `get_new_comics`, `db/comics.ts`, the rail, and `/issue/[id]` are unchanged — the
> pivot was contained to the ingest. Cron runs hourly (clears the one-time
> volume-resolution backlog in ~a day, then no-ops). Plan:
> `docs/superpowers/plans/2026-06-28-comicvine-weekly-comics.md`.

## Context

The app's `/explore` "Right Now" band feels current because it is fed by a
**self-renewing external signal** — the TMDB film/TV release calendar
(`titles` + `hero_media_appearances`, surfaced via `get_trending_titles`). An
audit found this is one of only three renewable freshness engines in the app:
the TMDB calendar, the date itself (daily hero game / daily matchup), and user
behaviour (real but empty — cold-start, ~1 user). Everything else on Explore is
ranked-but-static catalogue.

To make the whole app feel current, we add more **TMDB-class engines**:
external, self-renewing, free-or-already-keyed, and cleanly mappable to
characters. The agreed roadmap, each its own spec → build cycle:

1. **ComicVine weekly comics** ← _this spec_. Comic-native sibling of the TMDB
   calendar; renews every Wednesday; we already hold the ComicVine key and
   `comicvine_id` covers 99.8% of heroes (33,904 / 33,984).
2. TMDB trending/trailers — extend the existing sync (cheapest).
3. Wikipedia pageviews — free "world attention" layer over the 4,729 QID heroes.
4. On This Day — anniversaries; **reuses the comic-issue `cover_date` data this
   engine stands up**, which is why it comes last.

This document specifies engine #1 only.

## Goal

A **"New This Week"** rail in the Right Now band showing the comic issues that
shipped in the last 7 days, **curated to issues featuring a recognizable
catalogue character** (catalogue + fame-gated). Tapping a cover opens a
lightweight **issue page**. The feed renews itself weekly with no curation.

## Curation rule (decided)

Surface an issue **only if at least one of its credited characters is in our
catalogue _and_ that character clears a fame bar** — the issue's `max_fame`
(highest `fame_score` among its catalogue characters) must be `>= p_min_fame`.
This mirrors the proven `get_trending_titles` gate ("must have catalogue
characters with portraits") and keeps the rail premium ("the books people
know") rather than a 200-issue-a-week firehose. `p_min_fame` is a **tunable RPC
parameter** (default `25`), so the bar can move without re-ingesting.

## Architecture

Three layers, each mirroring an existing analogue so the boundaries are already
proven in this codebase:

| Layer | This engine | Existing analogue |
| --- | --- | --- |
| Storage | `comic_issues`, `comic_issue_appearances` | `titles`, `hero_media_appearances` |
| Ingest | `sync-new-comics` edge fn + `pg_cron` drain | `enrich-tmdb-batch` + `schedule_tmdb_drain` |
| Read | `get_new_comics` RPC + `db/comics.ts` | `get_trending_titles` + `db/trending.ts` |
| UI | `ComicCoverRail` in Right Now band + `/issue/[id]` | `TitlePosterRail` + `/title/[id]` |

### 1. Data model

```sql
create table public.comic_issues (
  id            text primary key,        -- 'cvi:<comicvine_issue_id>'
  comicvine_id  integer unique not null, -- ComicVine issue id
  volume_name   text,                    -- series, e.g. "Batman"
  volume_id     integer,                 -- ComicVine volume id (for future grouping)
  issue_number  text,                    -- ComicVine sends strings ("1", "1.MU")
  cover_url     text,                    -- image.original_url / medium_url
  store_date    date,                    -- on-sale date — the freshness key
  cover_date    date,                    -- masthead date (used by On This Day later)
  publisher     text,                    -- derived from the lead catalogue hero
  lead_hero_id  text references public.heroes(id),  -- highest-fame catalogue char
  max_fame      numeric,                 -- denormalized for cheap ranking + gate
  synced_at     timestamptz default now()
);

create table public.comic_issue_appearances (
  issue_id text references public.comic_issues(id) on delete cascade,
  hero_id  text references public.heroes(id) on delete cascade,
  primary key (issue_id, hero_id)
);

create index on public.comic_issues (store_date desc);
create index on public.comic_issue_appearances (hero_id);
```

- **RLS:** enable on both, add a **public-read** policy (`for select using (true)`)
  — without it, anon reads 0 rows and the rail silently empties
  (known gotcha in this repo).
- We store **only catalogue-character appearances** (non-catalogue credits are
  dropped at ingest), and only issues with `>= 1` catalogue character. This keeps
  table volume modest while leaving the fame gate tunable at read time.

### 2. Ingest — `sync-new-comics` edge function

Follows the `enrich-tmdb-batch` shape exactly.

1. Query ComicVine `GET /issues` with
   `filter=store_date:<today-14d>|<today>`, `sort=store_date:desc`,
   `field_list=id,issue_number,store_date,cover_date,image,volume,character_credits`.
   Paginate (100/page; a fortnight is ~2–4 pages).
   - 14-day lookback (not 7) so late-arriving / corrected `store_date`s are
     caught; the **read** layer is what enforces the 7-day display window.
2. Load a `comicvine_id → { hero_id, fame_score, publisher }` map for catalogue
   heroes once (single query, cached for the run).
3. For each issue: intersect `character_credits` with the map. **Skip** if the
   intersection is empty or its best `fame_score` is null. Otherwise compute
   `lead_hero_id` (max fame), `max_fame`, and `publisher` (from the lead hero).
4. `upsert` the issue + its catalogue appearances (idempotent on
   `comicvine_id` / composite PK — safe to re-run daily).
5. Skip issues with **no `store_date`** (`cover_date` runs months ahead of sale
   and would pollute "this week").

**Schedule:** a `pg_cron` migration firing `net.http_post` into the function,
matching `schedule_tmdb_drain`. Comics ship Wednesdays; run **daily**
(`0 9 * * *`) so corrections land and the function is a cheap no-op on quiet
days. To pause: `select cron.unschedule('sync-new-comics-daily')`.

### 3. Read — `get_new_comics` RPC + `db/comics.ts`

```sql
get_new_comics(
  p_days integer default 7,       -- display window
  p_min_fame numeric default 25,  -- tunable curation bar
  p_limit integer default 12,     -- covers
  p_chars_per_issue integer default 8
) returns table (
  issue_id text, volume_name text, issue_number text, cover_url text,
  store_date date, publisher text, max_fame numeric,
  hero_id text, hero_name text, hero_image_url text, hero_portrait_url text
)
```

- `where store_date between current_date - p_days and current_date and max_fame >= p_min_fame`
- `order by store_date desc, max_fame desc` for issues; characters within an
  issue ordered by `fame_score desc` (lead first).
- Flat rows (issue fields repeated per character) → grouped in `db/comics.ts`
  into `NewComic { id, volumeName, issueNumber, coverUrl, storeDate, publisher,
  characters[] }`, exactly like `getTrendingTitles` groups its flat rows.
- `grant execute ... to anon, authenticated, service_role`.

### 4. UI

- **`ComicCoverRail`** — a sibling to `TitlePosterRail` (not an overload: the
  data type and badge differ, and clean boundaries beat a polymorphic rail).
  Comic covers are ~2:3, so the card geometry matches the poster card. Badge =
  "New" / the on-sale day; label/title = "This Week" / "New Comics".
- Rendered inside **both** `RightNowBand` views (native + web), below
  "On Screen Now", gated on `newComics.length > 0`.
- Data threaded through `useExploreData` (`getNewComics()` fetch, `newComics`
  field) just like `onScreen` / `streaming`.
- **`/issue/[id]`** — new lightweight route (native + web, per the
  `.web.tsx` pairing rule). Big cover, `volumeName #issueNumber`, on-sale date +
  publisher, and the credited catalogue characters as tappable chips routing to
  `/character/[id]`. A platform-neutral `useIssueDetail(id)` hook holds the
  fetch (`getIssueById`), per the thin-view-layer convention.

## Failure modes & edge cases

- **ComicVine down / rate-limited (429):** function logs + exits; cron retries
  next run. Rail just shows last successful sync (stale-but-present), never errors.
- **Empty week / all below bar:** RPC returns `[]`; rail hides (`length > 0` gate).
- **Issue with only obscure characters:** dropped at ingest (no catalogue
  intersection) — never stored.
- **Cover art missing:** skip the issue (a cover rail with a blank card is worse
  than one fewer card).
- **Duplicate ingest:** upserts are idempotent on `comicvine_id` / composite PK.
- **`store_date` null:** skipped (see ingest step 5).

## Out of scope (future / other specs)

- Per-character "appears in N new issues this week" badge on character pages
  (a fast-follow once the data layer exists).
- Pull-list / follow-a-series personalization (needs the empty audience).
- Engines #2–#4 (separate specs). On This Day will reuse `comic_issues.cover_date`.

## Open questions

None blocking. `p_min_fame` default (25) and the daily cron hour are tunable
post-launch without schema change.
