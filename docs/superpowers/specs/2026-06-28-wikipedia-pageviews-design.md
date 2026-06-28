# Wikipedia Trending (pageview spike) — freshness engine #3

**Date:** 2026-06-28
**Status:** Design — approved, pending spec review
**Engine:** #3 of 4 in the freshness-engines roadmap (#1 comics shipped)

## Context

Engine #3 of the freshness roadmap. Where #1 (comics) and #2 (TMDB) track the
**release calendar**, this one tracks **public attention**: a character whose
Wikipedia pageviews suddenly jump is one the world is looking up right now — a
trailer dropped, casting news broke, an actor died, a meme took off. The Wikimedia
Pageviews REST API is **free, no key**, and we already resolved `wikidata_qid` +
`wikidata_sitelinks` for ~4,700 heroes — so we have the hook to find each hero's
article. This is the engine that makes the app feel plugged into the culture, not
just the publishing schedule.

Same proven shape as #1/#2: edge-function drains on `pg_cron` → an RPC → a rail in
the Explore "Right Now" band.

## Goal

A **"Trending this week"** character-card rail ranked by **week-over-week pageview
spike** — who jumped the most, not who's biggest — with a small **▲ +N%** cue.
Renews itself daily, free, audience-independent.

## Decisions (locked)

- **Ranking:** week-over-week **spike** (this-7-days vs prior-7-days), **not**
  absolute pageviews (which would show the same icons every week).
- **Noise floor:** only rank heroes with `pageviews_week ≥ 1000`, so a low-traffic
  article doesn't "spike" 500% off a handful of hits.
- **Surface:** a character rail in the Explore Right Now band.
- **Scope:** all heroes with a resolvable enwiki article (subset of the ~4,700 QID
  heroes); the daily drain processes them in fame order so the famous ones refresh
  first.

## Architecture

| Layer | This engine | Mirrors |
| --- | --- | --- |
| Backfill | `resolve-enwiki-title` edge fn + cron drain → `heroes.enwiki_title` | resolve-wikidata-batch |
| Ingest | `sync-wiki-pageviews` edge fn + daily cron drain → pageview columns | enrich-*-batch drains |
| Read | `get_trending_heroes_wiki` RPC + `db/trending.ts` | get_trending_titles |
| UI | character-card rail "Trending this week" in RightNowBand | personalized strip |

### 1. Data model (migration)

```sql
alter table public.heroes add column if not exists enwiki_title text;      -- English Wikipedia article title
alter table public.heroes add column if not exists pageviews_week integer;  -- last 7 available days
alter table public.heroes add column if not exists pageviews_prev integer;  -- the 7 days before that
alter table public.heroes add column if not exists pageviews_spike numeric; -- (week+1)/(prev+1), for ranking
alter table public.heroes add column if not exists pageviews_at timestamptz;-- last refresh
create index if not exists heroes_pageviews_spike_idx on public.heroes (pageviews_spike desc) where pageviews_week is not null;
```

Columns on `heroes` (not a new table) — one row per hero, rewritten on each refresh.

### 2. Backfill — `resolve-enwiki-title` edge function (one-time)

For heroes with `wikidata_qid` and `enwiki_title is null`: call the Wikidata API
`wbgetentities` with up to **50 QIDs per request**
(`?action=wbgetentities&ids=Q1|Q2|…&props=sitelinks&sitefilter=enwiki&format=json`),
read `entities[qid].sitelinks.enwiki.title`, store it (or `''` sentinel when there
is no enwiki sitelink, so it isn't retried). A `pg_cron` drain clears the ~4,700
backlog quickly (≈95 batched calls). Send a descriptive `User-Agent` (Wikimedia
requires one). Runs to completion then no-ops.

### 3. Ingest — `sync-wiki-pageviews` edge function (daily drain)

For a batch of heroes with a non-empty `enwiki_title`, ordered by `fame_score desc`
(famous first), processing those with the **stalest `pageviews_at`** each run:

1. For each, GET the Wikimedia Pageviews REST endpoint
   `…/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/{ENCODED_TITLE}/daily/{start}/{end}`
   where the window is the last **~16 days ending today−2** (the API lags ~1–2
   days). Title is underscore-joined + URL-encoded.
2. Sum the most recent 7 days → `pageviews_week`; the 7 days before → `pageviews_prev`.
   `pageviews_spike = (week + 1) / (prev + 1)`. Store all four + `pageviews_at`.
3. `User-Agent` header required; small sleep between calls (polite). 404 (no such
   article / no data) → store zeros so it isn't hammered.
4. POST body `{ limit?, triggeredBy? }`. A `pg_cron` migration drains it every few
   minutes (e.g. `*/5`) until all rows are fresh, then it's a cheap no-op cycling
   the oldest rows daily.

### 4. Read — `get_trending_heroes_wiki` RPC + `db/trending.ts`

```sql
get_trending_heroes_wiki(p_limit int default 12, p_min_week int default 1000)
returns table ( id text, name text, image_url text, portrait_url text,
                pageviews_week integer, pageviews_spike numeric )
```

- `where pageviews_week >= p_min_week and pageviews_spike is not null
   and (portrait_url is not null or image_url is not null)`
- `order by pageviews_spike desc limit p_limit`.
- `db/trending.ts` `getTrendingHeroesWiki()` maps rows; degrades to `[]` on error.
- `grant execute … to anon, authenticated, service_role`.

### 5. UI

- A **"Trending this week"** rail in both `RightNowBand` views — character cards
  (reuse the personalized-strip card / `HeroImage`), each routing to
  `/character/[id]`, with a small **▲ +{round((spike-1)*100)}%** chip.
- Threaded through `useExploreData` (`getTrendingHeroesWiki()` → `wikiTrending`).
- Hidden when empty.

## Failure modes & edge cases

- **No enwiki sitelink:** `enwiki_title = ''` sentinel → skipped, not retried.
- **Article redirects / renames:** pageviews 404 → zeros; the hero just won't rank
  (acceptable; a redirect-resolution pass is a fast-follow).
- **Wikimedia API lag/down:** window ends today−2; a failed run leaves prior values
  (stale-but-present); next run retries.
- **Spike noise:** the `pageviews_week ≥ 1000` floor excludes low-traffic articles.
- **Disambiguation collisions:** the QID→enwiki sitelink is the canonical article,
  so we avoid title-guessing ambiguity.

## Out of scope (future / other specs)

- Pageviews for non-English wikis / global rollup.
- Redirect resolution for renamed articles.
- A per-character "trending" badge on the character page (fast-follow).
- Tying spikes to *why* (news headlines) — a separate enrichment.

## Open questions

None blocking. The noise floor (1000), drain cadence, and `p_limit` are tunable
post-launch without schema change.
