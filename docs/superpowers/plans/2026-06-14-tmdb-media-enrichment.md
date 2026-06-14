# TMDB Media Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich hero film data with TMDB — real posters/backdrops, YouTube trailers, "where to watch" providers, cast, and stills — stored in a normalized `films` table reused across every hero that appears in a film.

**Architecture:** ComicVine remains the *appearance source* (which films a hero is in, via `heroes.movies` jsonb). TMDB becomes the *film-richness source*. A one-time staging queue (`tmdb_match_queue`) holds the distinct CV film titles; a resumable edge-function drain matches each title to a `tmdb_id` (writing `films` + `hero_film_appearances` via an RPC), then enriches each unique `films` row with one TMDB detail call. The client reads films through a new `src/lib/db/films.ts` module and renders them in the existing `MovieStrip`/`MovieDetailSheet`, falling back to the legacy `heroes.movies` jsonb for un-drained heroes.

**Tech Stack:** Supabase (Postgres + pg_cron/pg_net + Deno edge functions), TMDB v3 REST API, React Native / Expo, jest-expo + @testing-library/react-native.

**Scope note:** CV's `movies` relation is films, so v1 matches only `/search/movie`. The `films.media_type` column defaults to `'movie'` and exists for a future TV pass; no `/search/tv` calls in v1.

---

## File structure

| File | Responsibility | Created/Modified |
| --- | --- | --- |
| `supabase/migrations/20260614120000_create_films_tables.sql` | `films`, `hero_film_appearances`, `tmdb_match_queue` tables + RLS + indexes + queue populate + `register_film_match` RPC | Create |
| `supabase/migrations/20260614130000_schedule_tmdb_drain.sql` | pg_cron schedule for the drain | Create |
| `src/lib/tmdb/match.ts` | Pure title-matching logic (normalize, score, pick best) | Create |
| `src/lib/tmdb/mapFilm.ts` | Pure TMDB-detail-response → `films` row mapper + image URL helpers | Create |
| `supabase/functions/enrich-tmdb-batch/index.ts` | Resumable match + enrich drain (self-contained; mirrors `enrich-comicvine-batch`) | Create |
| `src/lib/db/films.ts` | `getHeroFilms(heroId)` query module | Create |
| `src/types/index.ts` | Add `HeroFilm` type + optional TMDB fields on `MovieAppearance` | Modify |
| `src/components/MovieStrip.tsx` | Accept `HeroFilm[]`, render trailer affordance + provider badge | Modify |
| `src/components/MovieDetailSheet.tsx` | Trailer embed, stills gallery, cast, provider badges | Modify |
| `app/character/[id].tsx` | Fetch films via `getHeroFilms`, pass to `MovieStrip` (one placement) | Modify |
| `app.config.ts` | `tmdbApiKey` in `extra` | Modify |
| `.env.example` | `TMDB_API_KEY` | Modify |
| `src/types/database.generated.ts` | Regenerated after migration | Modify (generated) |
| `__tests__/lib/tmdb/match.test.ts` | Matcher tests | Create |
| `__tests__/lib/tmdb/mapFilm.test.ts` | Mapper tests | Create |
| `__tests__/lib/db/films.test.ts` | `getHeroFilms` query test | Create |

---

## Task 1: Database schema — films, appearances, match queue, RPC

**Files:**
- Create: `supabase/migrations/20260614120000_create_films_tables.sql`

Apply via `mcp__supabase__apply_migration` (name: `create_films_tables`), not by hand in the dashboard.

- [ ] **Step 1: Write the migration SQL**

```sql
-- TMDB media enrichment, lane 1. CV stays the appearance source (heroes.movies);
-- TMDB is the film-richness source. films is normalized (one row per tmdb_id) so
-- shared films (Justice League, etc.) are fetched once and reused across heroes.

-- ── films: one row per matched TMDB title ────────────────────────────────────
create table if not exists public.films (
  tmdb_id          text primary key,
  media_type       text not null default 'movie'
                     check (media_type in ('movie', 'tv')),
  title            text not null,
  release_date     date,
  year             int generated always as (extract(year from release_date)::int) stored,
  poster_url       text,
  backdrop_url     text,
  overview         text,
  vote_average     numeric,
  runtime          int,
  revenue          bigint,
  trailer_key      text,
  watch_providers  jsonb,
  cast_members     jsonb,  -- 'cast' is a reserved word in Postgres; never name a column that
  stills           jsonb,
  tmdb_enriched_at timestamptz,
  tmdb_status      text not null default 'pending'
                     check (tmdb_status in ('pending', 'done', 'unmatched', 'failed'))
);

-- ── hero_film_appearances: which hero appears in which film ───────────────────
create table if not exists public.hero_film_appearances (
  hero_id  text not null references public.heroes(id) on delete cascade,
  tmdb_id  text not null references public.films(tmdb_id) on delete cascade,
  cv_name  text,
  cv_url   text,
  rank     int,
  primary key (hero_id, tmdb_id)
);

create index if not exists hero_film_appearances_hero_idx
  on public.hero_film_appearances (hero_id);

-- ── tmdb_match_queue: distinct CV film titles awaiting a TMDB match ───────────
create table if not exists public.tmdb_match_queue (
  cv_name   text primary key,
  cv_year   text,
  tmdb_id   text,
  status    text not null default 'pending'
              check (status in ('pending', 'matched', 'unmatched')),
  attempts  int  not null default 0
);

-- Populate the queue once from existing heroes.movies. Distinct on lowercased
-- title; keep one example year. Future ingestion re-runs this insert (idempotent
-- via on conflict do nothing).
insert into public.tmdb_match_queue (cv_name, cv_year)
select distinct on (lower(m->>'name'))
       m->>'name'  as cv_name,
       m->>'year'  as cv_year
from public.heroes h,
     lateral jsonb_array_elements(to_jsonb(h.movies)) as m
where h.movies is not null
  and coalesce(m->>'name', '') <> ''
order by lower(m->>'name')
on conflict (cv_name) do nothing;

-- ── RLS: public read (graph is public data; without this anon reads 0 rows) ───
alter table public.films enable row level security;
alter table public.hero_film_appearances enable row level security;

create policy "Public read access" on public.films
  for select to anon, authenticated using (true);
create policy "Public read access" on public.hero_film_appearances
  for select to anon, authenticated using (true);
-- tmdb_match_queue is server-only (service role bypasses RLS); no anon policy.
alter table public.tmdb_match_queue enable row level security;

-- ── register_film_match: called by the drain once a CV title resolves to a ────
-- tmdb_id. Upserts a stub films row (status pending → enriched in phase 2) and
-- fans out appearance edges to every hero whose movies list that exact title.
create or replace function public.register_film_match(
  p_cv_name    text,
  p_tmdb_id    text,
  p_media_type text,
  p_title      text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.films (tmdb_id, media_type, title)
  values (p_tmdb_id, coalesce(p_media_type, 'movie'), p_title)
  on conflict (tmdb_id) do nothing;

  insert into public.hero_film_appearances (hero_id, tmdb_id, cv_name, cv_url, rank)
  select h.id,
         p_tmdb_id,
         m->>'name',
         m->>'url',
         h.issue_count
  from public.heroes h,
       lateral jsonb_array_elements(to_jsonb(h.movies)) as m
  where h.movies is not null
    and lower(m->>'name') = lower(p_cv_name)
  on conflict (hero_id, tmdb_id) do nothing;

  update public.tmdb_match_queue
     set status = 'matched', tmdb_id = p_tmdb_id
   where cv_name = p_cv_name;
end;
$$;
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with name `create_films_tables` and the SQL above.
Expected: success, no error.

- [ ] **Step 3: Verify tables and queue populated**

Run via `mcp__supabase__execute_sql`:
```sql
select
  (select count(*) from public.films) as films,
  (select count(*) from public.tmdb_match_queue) as queued,
  (select count(*) from public.hero_film_appearances) as edges;
```
Expected: `films` = 0, `queued` > 0 (a few hundred to low thousands), `edges` = 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260614120000_create_films_tables.sql
git commit -m "feat(db): films + hero_film_appearances + tmdb match queue"
```

---

## Task 2: Regenerate database types

**Files:**
- Modify: `src/types/database.generated.ts`

- [ ] **Step 1: Regenerate**

Use `mcp__supabase__generate_typescript_types` and write the output to `src/types/database.generated.ts` (overwrite). Never hand-edit this file.

- [ ] **Step 2: Verify the new tables are present**

Run:
```bash
grep -c "films\|hero_film_appearances\|tmdb_match_queue" src/types/database.generated.ts
```
Expected: a non-zero count (the generated rows for the new tables).

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.generated.ts
git commit -m "chore(types): regenerate after films tables migration"
```

---

## Task 3: Pure title matcher (`src/lib/tmdb/match.ts`)

**Files:**
- Create: `src/lib/tmdb/match.ts`
- Test: `__tests__/lib/tmdb/match.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/tmdb/match.test.ts
import { normalizeTitle, pickBestMatch, type TmdbSearchResult } from '../../../src/lib/tmdb/match';

const r = (id: number, title: string, date: string | null): TmdbSearchResult => ({
  id,
  title,
  release_date: date,
});

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation and articles', () => {
    expect(normalizeTitle('The Batman: Part II')).toBe('batman part ii');
    expect(normalizeTitle('Spider-Man  (2002)')).toBe('spiderman 2002');
  });
});

describe('pickBestMatch', () => {
  it('returns the exact-title candidate', () => {
    const best = pickBestMatch('Superman', [r(1, 'Superman Returns', '2006'), r(2, 'Superman', '1978')], null);
    expect(best?.id).toBe(2);
  });

  it('uses the year hint to break ties', () => {
    const best = pickBestMatch('Batman', [r(1, 'Batman', '1989'), r(2, 'Batman', '1966')], '1966');
    expect(best?.id).toBe(2);
  });

  it('returns null when nothing clears the similarity threshold', () => {
    expect(pickBestMatch('Aztec Batman Clash of Empires', [r(1, 'Unrelated Film', '2001')], null)).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(pickBestMatch('Anything', [], null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/tmdb/match.test.ts`
Expected: FAIL — cannot find module `src/lib/tmdb/match`.

- [ ] **Step 3: Implement `src/lib/tmdb/match.ts`**

```ts
// Pure TMDB title-matching logic. No Deno/React deps so it is jest-testable.
// NOTE: the enrich-tmdb-batch edge function carries a parallel copy of this
// scoring (edge functions deploy self-contained, no cross-imports) — keep them
// in sync; this file is the tested source of truth.

export interface TmdbSearchResult {
  id: number;
  title: string;
  release_date: string | null;
}

const ARTICLES = /^(the|a|an)\s+/;

/** Lowercase, drop a leading article, strip punctuation, collapse whitespace. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(ARTICLES, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Token Jaccard similarity in [0,1] between two normalized titles. */
function similarity(a: string, b: string): number {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

const THRESHOLD = 0.6;

/**
 * Pick the best TMDB candidate for a CV title, or null if none is confident.
 * Score = title similarity, with a small bonus when the release year matches the
 * CV year hint (breaks ties between same-named films).
 */
export function pickBestMatch(
  cvTitle: string,
  candidates: TmdbSearchResult[],
  yearHint: string | null,
): TmdbSearchResult | null {
  const q = normalizeTitle(cvTitle);
  let best: TmdbSearchResult | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    let score = similarity(q, normalizeTitle(c.title));
    if (yearHint && c.release_date?.startsWith(yearHint)) score += 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= THRESHOLD ? best : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/tmdb/match.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tmdb/match.ts __tests__/lib/tmdb/match.test.ts
git commit -m "feat(tmdb): pure title matcher with tests"
```

---

## Task 4: Pure film mapper (`src/lib/tmdb/mapFilm.ts`)

**Files:**
- Create: `src/lib/tmdb/mapFilm.ts`
- Test: `__tests__/lib/tmdb/mapFilm.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/tmdb/mapFilm.test.ts
import { mapTmdbDetailsToFilm, type TmdbDetails } from '../../../src/lib/tmdb/mapFilm';

const details: TmdbDetails = {
  id: 268,
  title: 'Batman',
  release_date: '1989-06-23',
  overview: 'The Dark Knight...',
  vote_average: 7.2,
  runtime: 126,
  revenue: 411348924,
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  videos: { results: [
    { site: 'YouTube', type: 'Teaser', key: 'aaa' },
    { site: 'YouTube', type: 'Trailer', key: 'bbb' },
  ] },
  'watch/providers': { results: { US: { flatrate: [{ provider_name: 'Max' }] } } },
  credits: { cast: [
    { name: 'Michael Keaton', character: 'Batman', profile_path: '/mk.jpg' },
    { name: 'Jack Nicholson', character: 'Joker', profile_path: null },
  ] },
  images: { backdrops: [{ file_path: '/s1.jpg' }, { file_path: '/s2.jpg' }] },
};

describe('mapTmdbDetailsToFilm', () => {
  it('maps core fields and builds image URLs', () => {
    const f = mapTmdbDetailsToFilm(details);
    expect(f.title).toBe('Batman');
    expect(f.release_date).toBe('1989-06-23');
    expect(f.poster_url).toBe('https://image.tmdb.org/t/p/w500/poster.jpg');
    expect(f.backdrop_url).toBe('https://image.tmdb.org/t/p/w1280/backdrop.jpg');
    expect(f.runtime).toBe(126);
    expect(f.revenue).toBe(411348924);
  });

  it('picks the YouTube Trailer key', () => {
    expect(mapTmdbDetailsToFilm(details).trailer_key).toBe('bbb');
  });

  it('keeps providers, top cast, and still URLs', () => {
    const f = mapTmdbDetailsToFilm(details);
    expect(f.watch_providers).toEqual({ US: { flatrate: [{ provider_name: 'Max' }] } });
    expect(f.cast_members).toHaveLength(2);
    expect(f.cast_members?.[0]).toEqual({ name: 'Michael Keaton', character: 'Batman', profile_url: 'https://image.tmdb.org/t/p/w185/mk.jpg' });
    expect(f.stills).toEqual([
      'https://image.tmdb.org/t/p/w780/s1.jpg',
      'https://image.tmdb.org/t/p/w780/s2.jpg',
    ]);
  });

  it('tolerates missing optional sections', () => {
    const f = mapTmdbDetailsToFilm({ id: 1, title: 'X', release_date: null });
    expect(f.trailer_key).toBeNull();
    expect(f.poster_url).toBeNull();
    expect(f.cast).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/tmdb/mapFilm.test.ts`
Expected: FAIL — cannot find module `src/lib/tmdb/mapFilm`.

- [ ] **Step 3: Implement `src/lib/tmdb/mapFilm.ts`**

```ts
// Pure mapper: TMDB /movie/{id}?append_to_response=videos,watch/providers,
// credits,images  →  a films table row. jest-testable; mirrored (kept in sync)
// inside the enrich-tmdb-batch edge function.

const IMG = 'https://image.tmdb.org/t/p';
const img = (path: string | null | undefined, size: string): string | null =>
  path ? `${IMG}/${size}${path}` : null;

interface TmdbVideo { site: string; type: string; key: string }
interface TmdbCastMember { name: string; character?: string; profile_path: string | null }

export interface TmdbDetails {
  id: number;
  title: string;
  release_date: string | null;
  overview?: string | null;
  vote_average?: number | null;
  runtime?: number | null;
  revenue?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  videos?: { results?: TmdbVideo[] };
  'watch/providers'?: { results?: Record<string, unknown> };
  credits?: { cast?: TmdbCastMember[] };
  images?: { backdrops?: { file_path: string }[] };
}

export interface FilmRow {
  tmdb_id: string;
  title: string;
  release_date: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  vote_average: number | null;
  runtime: number | null;
  revenue: number | null;
  trailer_key: string | null;
  watch_providers: Record<string, unknown> | null;
  cast_members: { name: string; character: string | null; profile_url: string | null }[] | null;
  stills: string[] | null;
}

const CAST_CAP = 10;
const STILLS_CAP = 8;

export function mapTmdbDetailsToFilm(d: TmdbDetails): FilmRow {
  const trailer =
    d.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
    d.videos?.results?.find((v) => v.site === 'YouTube');

  const cast = d.credits?.cast?.slice(0, CAST_CAP).map((c) => ({
    name: c.name,
    character: c.character?.trim() ? c.character : null,
    profile_url: img(c.profile_path, 'w185'),
  }));

  const stills = d.images?.backdrops
    ?.slice(0, STILLS_CAP)
    .map((b) => img(b.file_path, 'w780'))
    .filter((u): u is string => u !== null);

  const providers = d['watch/providers']?.results ?? null;

  return {
    tmdb_id: String(d.id),
    title: d.title,
    release_date: d.release_date ?? null,
    poster_url: img(d.poster_path, 'w500'),
    backdrop_url: img(d.backdrop_path, 'w1280'),
    overview: d.overview?.trim() ? d.overview : null,
    vote_average: typeof d.vote_average === 'number' ? d.vote_average : null,
    runtime: typeof d.runtime === 'number' ? d.runtime : null,
    revenue: typeof d.revenue === 'number' && d.revenue > 0 ? d.revenue : null,
    trailer_key: trailer?.key ?? null,
    watch_providers: providers && Object.keys(providers).length > 0 ? providers : null,
    cast_members: cast && cast.length > 0 ? cast : null,
    stills: stills && stills.length > 0 ? stills : null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/tmdb/mapFilm.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tmdb/mapFilm.ts __tests__/lib/tmdb/mapFilm.test.ts
git commit -m "feat(tmdb): pure film mapper with tests"
```

---

## Task 5: Edge function `enrich-tmdb-batch`

**Files:**
- Create: `supabase/functions/enrich-tmdb-batch/index.ts`

Self-contained (no cross-function imports), mirroring `enrich-comicvine-batch`. Carries its own copy of the `match.ts`/`mapFilm.ts` logic (keep in sync with the tested src versions).

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/enrich-tmdb-batch/index.ts
//
// Resumable TMDB drain. Two phases per run:
//   match  — take pending tmdb_match_queue rows, /search/movie, on confident
//            match call register_film_match (creates films stub + appearance
//            edges); otherwise mark the queue row 'unmatched'.
//   enrich — take films rows still tmdb_status='pending', one detail call with
//            append_to_response, write media columns, flip to 'done'.
// TMDB has no hard rate limit (~50 req/s tolerated); a small delay keeps us polite.
//
// POST body: { limit?: number (1-50, default 25), phase?: 'match'|'enrich'|'both',
//              retryUnmatched?: boolean, triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const img = (p: string | null | undefined, size: string) => (p ? `${IMG}/${size}${p}` : null);

// ── matcher (mirror of src/lib/tmdb/match.ts) ───────────────────────────────
const ARTICLES = /^(the|a|an)\s+/;
const normalizeTitle = (t: string) =>
  t.toLowerCase().replace(/[’']/g, '').replace(ARTICLES, '').replace(/[^a-z0-9]+/g, ' ').trim();
function similarity(a: string, b: string): number {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}
interface SearchResult { id: number; title: string; release_date: string | null }
function pickBestMatch(cvTitle: string, cands: SearchResult[], yearHint: string | null): SearchResult | null {
  const q = normalizeTitle(cvTitle);
  let best: SearchResult | null = null;
  let bestScore = 0;
  for (const c of cands) {
    let score = similarity(q, normalizeTitle(c.title));
    if (yearHint && c.release_date?.startsWith(yearHint)) score += 0.15;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= 0.6 ? best : null;
}

// ── mapper (mirror of src/lib/tmdb/mapFilm.ts) ──────────────────────────────
function mapDetails(d: Record<string, any>) {
  const videos: any[] = d.videos?.results ?? [];
  const trailer = videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ?? videos.find((v) => v.site === 'YouTube');
  const cast = (d.credits?.cast ?? []).slice(0, 10).map((c: any) => ({
    name: c.name, character: c.character?.trim() ? c.character : null, profile_url: img(c.profile_path, 'w185'),
  }));
  const stills = (d.images?.backdrops ?? []).slice(0, 8).map((b: any) => img(b.file_path, 'w780')).filter(Boolean);
  const providers = d['watch/providers']?.results ?? null;
  return {
    title: d.title, release_date: d.release_date || null,
    poster_url: img(d.poster_path, 'w500'), backdrop_url: img(d.backdrop_path, 'w1280'),
    overview: d.overview?.trim() ? d.overview : null,
    vote_average: typeof d.vote_average === 'number' ? d.vote_average : null,
    runtime: typeof d.runtime === 'number' ? d.runtime : null,
    revenue: typeof d.revenue === 'number' && d.revenue > 0 ? d.revenue : null,
    trailer_key: trailer?.key ?? null,
    watch_providers: providers && Object.keys(providers).length > 0 ? providers : null,
    cast_members: cast.length > 0 ? cast : null,
    stills: stills.length > 0 ? stills : null,
  };
}

async function runMatch(sb: SB, limit: number, retryUnmatched: boolean): Promise<number> {
  const statuses = retryUnmatched ? ['pending', 'unmatched'] : ['pending'];
  const { data: rows } = await sb
    .from('tmdb_match_queue').select('cv_name, cv_year').in('status', statuses).limit(limit);
  if (!rows || rows.length === 0) return 0;
  let calls = 0;
  for (const row of rows as Array<{ cv_name: string; cv_year: string | null }>) {
    calls++;
    try {
      const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(row.cv_name)}${row.cv_year ? `&year=${encodeURIComponent(row.cv_year)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) { await sleep(250); continue; } // transient: leave pending
      const body = await res.json();
      const best = pickBestMatch(row.cv_name, (body.results ?? []) as SearchResult[], row.cv_year);
      if (best) {
        await sb.rpc('register_film_match', {
          p_cv_name: row.cv_name, p_tmdb_id: String(best.id), p_media_type: 'movie', p_title: best.title,
        });
      } else {
        await sb.from('tmdb_match_queue').update({ status: 'unmatched' }).eq('cv_name', row.cv_name);
      }
    } catch (err) {
      console.error('[enrich-tmdb-batch] match threw', row.cv_name, err); // leave pending
    }
    await sleep(120);
  }
  return calls;
}

async function runEnrich(sb: SB, limit: number): Promise<number> {
  const { data: films } = await sb
    .from('films').select('tmdb_id').eq('tmdb_status', 'pending').limit(limit);
  if (!films || films.length === 0) return 0;
  let calls = 0;
  for (const f of films as Array<{ tmdb_id: string }>) {
    calls++;
    try {
      const url = `${TMDB_BASE}/movie/${f.tmdb_id}?api_key=${TMDB_API_KEY}&append_to_response=videos,watch/providers,credits,images`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) await sb.from('films').update({ tmdb_status: 'failed' }).eq('tmdb_id', f.tmdb_id);
        await sleep(250); continue;
      }
      const mapped = mapDetails(await res.json());
      await sb.from('films').update({ ...mapped, tmdb_status: 'done', tmdb_enriched_at: new Date().toISOString() }).eq('tmdb_id', f.tmdb_id);
    } catch (err) {
      console.error('[enrich-tmdb-batch] enrich threw', f.tmdb_id, err); // leave pending
    }
    await sleep(120);
  }
  return calls;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  const startedAt = Date.now();
  let limit = 25, phase: 'match' | 'enrich' | 'both' = 'both', retryUnmatched = false, triggeredBy = 'cron';
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 50);
    if (body?.phase === 'match' || body?.phase === 'enrich' || body?.phase === 'both') phase = body.phase;
    if (body?.retryUnmatched === true) retryUnmatched = true;
    if (typeof body?.triggeredBy === 'string') triggeredBy = body.triggeredBy;
  } catch { /* empty body ok */ }

  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  const { data: runRow } = await sb.from('enrichment_runs').insert({
    run_type: 'tmdb_drain', triggered_by: triggeredBy, status: 'running',
    started_at: new Date(startedAt).toISOString(),
  }).select('id').single();
  const runId = (runRow as { id?: number } | null)?.id ?? null;

  let matchCalls = 0, enrichCalls = 0;
  try {
    if (phase === 'match' || phase === 'both') matchCalls = await runMatch(sb, limit, retryUnmatched);
    if (phase === 'enrich' || phase === 'both') enrichCalls = await runEnrich(sb, limit);
  } catch (err) {
    if (runId != null) await sb.from('enrichment_runs').update({ status: 'error' }).eq('id', runId);
    return json({ error: String(err) }, 500);
  }

  const totalCalls = matchCalls + enrichCalls;
  if (totalCalls > 0) await sb.from('api_usage').insert({ api: 'tmdb', endpoint: phase, units: totalCalls });
  if (runId != null) await sb.from('enrichment_runs').update({
    status: 'done', done: totalCalls, processed: totalCalls, duration_ms: Date.now() - startedAt,
  }).eq('id', runId);

  return json({ phase, matchCalls, enrichCalls, message: totalCalls === 0 ? 'nothing to do' : 'ok' });
});
```

- [ ] **Step 2: Deploy the function**

Use `mcp__supabase__deploy_edge_function` (name: `enrich-tmdb-batch`) with the file above. Ensure the `TMDB_API_KEY` secret is set on the project (Supabase dashboard → Edge Functions → Secrets, or `supabase secrets set TMDB_API_KEY=...`).

- [ ] **Step 3: Smoke-test one small match+enrich batch**

Invoke with `{ "limit": 3, "triggeredBy": "manual-smoke" }` (via `mcp__supabase__execute_sql` net.http_post, or curl with the anon bearer). Then:
```sql
select status, count(*) from public.tmdb_match_queue group by status;
select tmdb_status, count(*) from public.films group by tmdb_status;
```
Expected: a few queue rows now `matched`/`unmatched`; a few `films` rows now `done` with non-null `poster_url`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/enrich-tmdb-batch/index.ts
git commit -m "feat(edge): enrich-tmdb-batch match+enrich drain"
```

---

## Task 6: Schedule the drain (cron)

**Files:**
- Create: `supabase/migrations/20260614130000_schedule_tmdb_drain.sql`

- [ ] **Step 1: Write the migration**

Reuse the project URL and anon bearer from `20260612140000_schedule_comicvine_drain.sql` (same project). TMDB is generous, so a 2-minute cadence at limit 25 drains quickly then no-ops.

```sql
-- Unattended TMDB drain. Mirrors the ComicVine schedule: pg_cron fires an async
-- net.http_post into enrich-tmdb-batch. Matches pending queue rows + enriches
-- pending films each run; a no-op once both backlogs hit zero. New films from
-- future ingestion (queue re-populate) are picked up automatically.
-- To PAUSE: select cron.unschedule('enrich-tmdb-pending');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'enrich-tmdb-pending',
  '*/2 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/enrich-tmdb-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('limit', 25),
    timeout_milliseconds := 120000
  );
  $cron$
);
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` (name: `schedule_tmdb_drain`).
Expected: success.

- [ ] **Step 3: Verify the job is registered**

```sql
select jobname, schedule from cron.job where jobname = 'enrich-tmdb-pending';
```
Expected: one row, schedule `*/2 * * * *`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260614130000_schedule_tmdb_drain.sql
git commit -m "feat(db): schedule tmdb enrichment drain"
```

---

## Task 7: Client query module (`src/lib/db/films.ts`)

**Files:**
- Create: `src/lib/db/films.ts`
- Test: `__tests__/lib/db/films.test.ts`

- [ ] **Step 1: Write the failing test**

Mirror the existing `__tests__/lib/db/` mocking style (mock `../../../src/lib/supabase`).

```ts
// __tests__/lib/db/films.test.ts
import { getHeroFilms } from '../../../src/lib/db/films';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

describe('getHeroFilms', () => {
  it('returns flattened, rank-ordered films for a hero', async () => {
    const rows = [
      { rank: 50, films: { tmdb_id: '268', title: 'Batman', year: 1989, poster_url: 'p', backdrop_url: 'b', vote_average: 7.2, runtime: 126, overview: 'o', trailer_key: 'bbb', watch_providers: null, cast_members: null, stills: null } },
    ];
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const films = await getHeroFilms('69');
    expect(supabase.from).toHaveBeenCalledWith('hero_film_appearances');
    expect(films).toHaveLength(1);
    expect(films[0]).toMatchObject({ tmdbId: '268', title: 'Batman', year: 1989, trailerKey: 'bbb' });
  });

  it('returns [] on error', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ order }) }) });
    expect(await getHeroFilms('1')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/db/films.test.ts`
Expected: FAIL — cannot find module `src/lib/db/films`.

- [ ] **Step 3: Implement `src/lib/db/films.ts`**

```ts
import { supabase } from '../supabase';

export interface HeroFilmCastMember {
  name: string;
  character: string | null;
  profile_url: string | null;
}

export interface HeroFilm {
  tmdbId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  runtime: number | null;
  overview: string | null;
  trailerKey: string | null;
  watchProviders: Record<string, unknown> | null;
  cast: HeroFilmCastMember[] | null;
  stills: string[] | null;
}

interface JoinRow {
  rank: number | null;
  films: {
    tmdb_id: string;
    title: string;
    year: number | null;
    poster_url: string | null;
    backdrop_url: string | null;
    vote_average: number | null;
    runtime: number | null;
    overview: string | null;
    trailer_key: string | null;
    watch_providers: Record<string, unknown> | null;
    cast_members: HeroFilmCastMember[] | null;
    stills: string[] | null;
  } | null;
}

/** Films a hero appears in, richest-first (by appearance rank = issue_count). */
export async function getHeroFilms(heroId: string): Promise<HeroFilm[]> {
  const { data, error } = await supabase
    .from('hero_film_appearances')
    .select(
      'rank, films ( tmdb_id, title, year, poster_url, backdrop_url, vote_average, runtime, overview, trailer_key, watch_providers, cast_members, stills )',
    )
    .eq('hero_id', heroId)
    .order('rank', { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  return (data as unknown as JoinRow[])
    .filter((r) => r.films !== null)
    .map((r) => {
      const f = r.films!;
      return {
        tmdbId: f.tmdb_id,
        title: f.title,
        year: f.year,
        posterUrl: f.poster_url,
        backdropUrl: f.backdrop_url,
        voteAverage: f.vote_average,
        runtime: f.runtime,
        overview: f.overview,
        trailerKey: f.trailer_key,
        watchProviders: f.watch_providers,
        cast: f.cast_members,
        stills: f.stills,
      };
    });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/db/films.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/films.ts __tests__/lib/db/films.test.ts
git commit -m "feat(db): getHeroFilms query module"
```

---

## Task 8: Wire films into the character screen

**Files:**
- Modify: `app/character/[id].tsx`
- Modify: `src/components/MovieStrip.tsx`
- Modify: `src/components/MovieDetailSheet.tsx`

This task upgrades the UI to prefer TMDB films and fall back to the legacy `movies` jsonb. Keep `[id].tsx` changes to a fetch + one render branch.

- [ ] **Step 1: Add a films fetch + prefer-films render branch in `[id].tsx`**

Near the other imports (after line 61 `GalleryStrip` import):
```tsx
import { getHeroFilms, type HeroFilm } from '../../src/lib/db/films';
```

Add state alongside the other `useState` hooks in the component:
```tsx
const [films, setFilms] = useState<HeroFilm[] | null>(null);
```

After `data` is set for a hero (in the same effect that loads the hero row — find where `heroRow.id` is available), fetch films once:
```tsx
useEffect(() => {
  if (!data?.stats.id) return;
  let active = true;
  getHeroFilms(data.stats.id).then((f) => {
    if (active) setFilms(f);
  });
  return () => {
    active = false;
  };
}, [data?.stats.id]);
```

Find the existing `MovieStrip` render (where `data.details.movies` is passed) and branch to prefer films:
```tsx
{films && films.length > 0 ? (
  <MovieStrip films={films} totalCount={films.length} contentInset={CONTENT_PAD} bleedMargin={CONTENT_PAD} />
) : data.details.movies?.length ? (
  <MovieStrip movies={data.details.movies} totalCount={data.details.movieCount ?? data.details.movies.length} contentInset={CONTENT_PAD} bleedMargin={CONTENT_PAD} />
) : null}
```
(Use whatever `contentInset`/`bleedMargin` values the existing call already passes — copy them verbatim.)

- [ ] **Step 2: Make `MovieStrip` accept either `films` or legacy `movies`**

In `src/components/MovieStrip.tsx`, update `Props` and normalize to one internal shape. Add to imports:
```tsx
import type { HeroFilm } from '../lib/db/films';
```
Replace the `Props` interface:
```tsx
interface Props {
  movies?: MovieAppearance[];
  films?: HeroFilm[];
  totalCount: number;
  contentInset?: number;
  bleedMargin?: number;
}
```
At the top of the component body, normalize both inputs to a common card model (add this type near the top of the file):
```tsx
interface StripItem {
  key: string;
  title: string;
  year: string | null;
  posterUrl: string | null;
  hasTrailer: boolean;
  film?: HeroFilm;
  movie?: MovieAppearance;
}
```
Build `items` from whichever prop is present (films take precedence), then render the existing card list over `items` instead of over `movies`. Films map to `{ key: f.tmdbId, title: f.title, year: f.year ? String(f.year) : null, posterUrl: f.posterUrl, hasTrailer: !!f.trailerKey, film: f }`; legacy movies map to `{ key: m.name, title: m.name, year: m.year, posterUrl: m.imageUrl, hasTrailer: false, movie: m }`. On press, open `MovieDetailSheet` with either `item.film` or `item.movie`. Render a small play-glyph badge on cards where `hasTrailer` is true (reuse the `Ionicons` already imported: `<Ionicons name="play-circle" size={22} color="#fff" />` positioned over the poster).

- [ ] **Step 3: Extend `MovieDetailSheet` to show trailer, providers, cast, stills**

In `src/components/MovieDetailSheet.tsx`, accept an optional `film?: HeroFilm` prop alongside the existing movie prop. When `film` is present and `film.trailerKey` is set, render a trailer play button that opens the YouTube video. Use a WebView embed:
```tsx
import { WebView } from 'react-native-webview';
// ...
{film?.trailerKey && showTrailer ? (
  <WebView
    style={styles.trailer}
    source={{ uri: `https://www.youtube.com/embed/${film.trailerKey}?autoplay=1` }}
    allowsFullscreenVideo
  />
) : null}
```
(On web, render an `<iframe>` instead via `Platform.OS === 'web'`.) Below the trailer, render: `film.watchProviders` region badges (provider names from the user's region, falling back to `US`), a horizontal `film.cast` list (name + character + `profile_url` avatar via `expo-image`), and a `film.stills` horizontal gallery (reuse the existing `ImageLightbox` if the sheet already imports it). Keep each block guarded so a film with null fields renders nothing for that block.

- [ ] **Step 4: Verify install of `react-native-webview`**

WebView may not be installed. Check and add if missing:
```bash
grep -q react-native-webview package.json && echo present || yarn expo install react-native-webview
```
Expected: `present`, or a successful install.

- [ ] **Step 5: Run the full test suite + typecheck**

Run: `yarn test:ci && yarn tsc --noEmit`
Expected: all tests pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add app/character/\[id\].tsx src/components/MovieStrip.tsx src/components/MovieDetailSheet.tsx package.json yarn.lock
git commit -m "feat(ui): render TMDB films with trailers, providers, cast, stills"
```

---

## Task 9: Config — TMDB API key

**Files:**
- Modify: `app.config.ts`
- Modify: `.env.example`

The key is used **server-side only** (edge function via `Deno.env.get` + Supabase secret). Adding it to `app.config.ts` `extra` is only for parity/local scripts; it is NOT read in the client data path.

- [ ] **Step 1: Add the key to `.env.example`**

Add after the `COMICVINE_API_KEY=` line:
```
TMDB_API_KEY=
```

- [ ] **Step 2: Add to `app.config.ts` extra**

In the `extra` block (after `comicvineApiKey`):
```ts
    tmdbApiKey: process.env.TMDB_API_KEY,
```

- [ ] **Step 3: Confirm the Supabase secret is set**

The edge function reads `TMDB_API_KEY` from the Supabase project secrets (set in Task 5 Step 2). Verify with `supabase secrets list` (should list `TMDB_API_KEY`) or the dashboard.

- [ ] **Step 4: Commit**

```bash
git add app.config.ts .env.example
git commit -m "chore(config): add TMDB_API_KEY"
```

---

## Task 10: Full-catalog drain + verification

**Files:** none (operational)

- [ ] **Step 1: Let the cron drain, or kick it manually**

The cron drains automatically. To accelerate, invoke `enrich-tmdb-batch` repeatedly with `{ "limit": 50, "triggeredBy": "manual-drain" }` until both backlogs are empty.

- [ ] **Step 2: Verify progress**

```sql
select status, count(*) from public.tmdb_match_queue group by status;
select tmdb_status, count(*) from public.films group by tmdb_status;
select count(*) from public.hero_film_appearances;
```
Expected: queue mostly `matched`/`unmatched` (0 `pending`); films mostly `done`; appearance edges in the thousands.

- [ ] **Step 3: Spot-check a marquee hero end to end**

```sql
select f.title, f.year, f.poster_url is not null as has_poster, f.trailer_key is not null as has_trailer
from public.hero_film_appearances a
join public.films f on f.tmdb_id = a.tmdb_id
where a.hero_id = '69'  -- Batman
order by a.rank desc nulls last
limit 10;
```
Expected: real Batman films with years, posters, and several trailers.

- [ ] **Step 4: Manual UI check**

Open Batman in the app. Expected: the movie strip shows TMDB posters with year badges, a play badge on trailer-bearing cards; opening one shows the trailer, providers, cast, and stills. A hero with no drained films still shows the legacy strip.

---

## Notes for the executor

- Work directly on `master` (project convention).
- Never hand-edit `src/types/database.generated.ts` — regenerate (Task 2).
- The edge function's inlined matcher/mapper are mirrors of `src/lib/tmdb/*` — if you change the scoring threshold or image sizes, change both.
- Supabase/PostgREST caps at 1000 rows; the drain batches are ≤50 so this is not a concern here, but `getHeroFilms` is per-hero (small) and fine.
