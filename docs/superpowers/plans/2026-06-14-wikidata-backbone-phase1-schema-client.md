# Wikidata Backbone — Phase 1: Schema Generalization + Client Cutover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize Lane 1's `films`/`hero_film_appearances` tables into a media-agnostic `titles`/`hero_media_appearances` backbone (plus Wikidata resolution scaffolding), and cut the client over from `films.ts`/`/film` to `titles.ts`/`/title` — with the shipped On-Screen film experience working unchanged end-to-end.

**Architecture:** One Supabase migration renames + extends the two film tables in place (composite PK `id = '<source>:<external_id>'`, `media_type` remapped `'movie'`→`'film'`), adds `wikidata_*` columns to `heroes` and the `hero_people`/`hero_facts` side-tables, and installs a generalized `register_media_match` RPC (with a `register_film_match` wrapper so the live drain keeps working) plus `resolve_hero_qid`. The existing `enrich-tmdb-batch` edge function is updated to the renamed schema. The client gains `src/lib/db/titles.ts`; `films.ts` is deleted and all 7 consumers are cut over; a new `/title/[id]` detail screen replaces `/film/[tmdbId]`, which becomes a redirect.

**Tech Stack:** Supabase (Postgres + MCP `apply_migration`/`generate_typescript_types`), Deno edge functions, Expo Router 4, React Native, TypeScript, jest-expo.

**Scope note:** This phase establishes the backbone and keeps film working. It does **not** add TV/game rendering, the Wikidata drains, or the admin review panel — those are later phases (resolve drain + admin → wikidata enrich → TMDB-TV → Portrayed-by). The migration creates the `wikidata_*` columns and `hero_people`/`hero_facts` tables now (one migration is cleaner than four), but nothing writes to them yet.

**Reference:** Design spec `docs/superpowers/specs/2026-06-14-wikidata-media-backbone-design.md`.

---

## File Structure

**Created:**
- `supabase/migrations/20260614153000_wikidata_media_backbone.sql` — the rename/extend/backfill migration.
- `src/lib/db/titles.ts` — generalized query module (replaces `films.ts`).
- `__tests__/lib/titles.test.ts` — unit tests for the pure helpers.
- `app/title/[id].tsx` — generalized media detail screen.

**Modified:**
- `supabase/functions/enrich-tmdb-batch/index.ts` — renamed schema (`titles`, `enrich_status`, `external_id`).
- `src/components/MovieStrip.tsx` — consume `HeroTitle[]`, route to `/title/<id>`.
- `src/components/film/FilmBackdropHeader.tsx`, `CastRail.tsx`, `WhereToWatch.tsx` — type imports from `titles.ts`.
- `app/character/[id].tsx`, `app/character/[id].web.tsx` — `getHeroTitles`/`HeroTitle`.
- `app/film/[tmdbId].tsx` — replaced by a redirect to `/title/tmdb:<id>`.
- `src/types/database.generated.ts` — regenerated (never hand-edited).

**Deleted:**
- `src/lib/db/films.ts` — fully cut over to `titles.ts`.

---

## Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/20260614153000_wikidata_media_backbone.sql`
- Regenerate: `src/types/database.generated.ts`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260614153000_wikidata_media_backbone.sql`:

```sql
-- Lane 3 Phase 1: generalize films -> titles backbone; add Wikidata resolution
-- scaffolding (columns/tables created now, written by later phases). The live
-- TMDB drain keeps working: register_film_match remains as a wrapper, and the
-- edge function is updated to the renamed schema in the same deploy.

begin;

-- ── 1. films -> titles ───────────────────────────────────────────────────────
alter table public.films rename to titles;

alter table public.titles add column if not exists id          text;
alter table public.titles add column if not exists source      text;
alter table public.titles add column if not exists external_id text;
alter table public.titles add column if not exists details     jsonb;

-- Backfill identity/source from the existing tmdb_id; remap media_type values.
update public.titles
   set source      = 'tmdb',
       external_id = tmdb_id,
       id          = 'tmdb:' || tmdb_id,
       media_type  = case when media_type = 'movie' then 'film' else media_type end
 where id is null;

alter table public.titles rename column tmdb_status      to enrich_status;
alter table public.titles rename column tmdb_enriched_at to enriched_at;

-- Drop the FK from the join table first so we can move the films PK.
alter table public.hero_film_appearances
  drop constraint hero_film_appearances_tmdb_id_fkey;

-- Swap PK from tmdb_id to the composite id. (tmdb_id column is kept for transition.)
alter table public.titles drop constraint films_pkey;
alter table public.titles alter column id          set not null;
alter table public.titles alter column source      set not null;
alter table public.titles alter column external_id set not null;
alter table public.titles add primary key (id);

-- Replace the old movie/tv check with the generalized film/tv/game one.
alter table public.titles drop constraint films_media_type_check;
alter table public.titles
  add constraint titles_media_type_chk check (media_type in ('film','tv','game'));
alter table public.titles
  add constraint titles_source_chk check (source in ('tmdb','igdb'));

-- ── 2. hero_film_appearances -> hero_media_appearances ───────────────────────
alter table public.hero_film_appearances rename to hero_media_appearances;

alter table public.hero_media_appearances add column if not exists title_id   text;
alter table public.hero_media_appearances add column if not exists media_type text;
alter table public.hero_media_appearances add column if not exists source     text;

update public.hero_media_appearances
   set title_id   = 'tmdb:' || tmdb_id,
       media_type = 'film',
       source     = 'comicvine'
 where title_id is null;

alter table public.hero_media_appearances drop constraint hero_film_appearances_pkey;
alter table public.hero_media_appearances alter column title_id set not null;
alter table public.hero_media_appearances add primary key (hero_id, title_id);
alter table public.hero_media_appearances
  add constraint hero_media_appearances_title_id_fkey
  foreign key (title_id) references public.titles(id) on delete cascade;

-- ── 3. heroes: Wikidata resolution columns (1-to-1) ──────────────────────────
alter table public.heroes add column if not exists wikidata_qid         text;
alter table public.heroes add column if not exists wikidata_status      text not null default 'pending';
alter table public.heroes add column if not exists wikidata_candidates  jsonb;
alter table public.heroes add column if not exists wikidata_enriched_at timestamptz;
alter table public.heroes
  add constraint heroes_wikidata_status_chk
  check (wikidata_status in ('pending','resolved','ambiguous','unresolved'));

-- ── 4. hero_people: voice actors / performers / creators (1-to-many) ─────────
create table if not exists public.hero_people (
  hero_id     text not null references public.heroes(id) on delete cascade,
  person_name text not null,
  role        text not null check (role in ('voice_actor','performer','creator')),
  title_id    text references public.titles(id) on delete set null,
  source      text not null default 'wikidata',
  primary key (hero_id, person_name, role, title_id)
);
create index if not exists hero_people_hero_idx on public.hero_people (hero_id);

-- ── 5. hero_facts: scalar facts not surfaced yet (awards, etc.) ──────────────
create table if not exists public.hero_facts (
  hero_id text not null references public.heroes(id) on delete cascade,
  key     text not null,
  value   text not null,
  source  text not null default 'wikidata',
  primary key (hero_id, key, value)
);
create index if not exists hero_facts_hero_idx on public.hero_facts (hero_id);

-- ── 6. RLS: public read on the new tables (anon reads 0 rows without this) ────
alter table public.hero_people enable row level security;
alter table public.hero_facts  enable row level security;
create policy "Public read access" on public.hero_people
  for select to anon, authenticated using (true);
create policy "Public read access" on public.hero_facts
  for select to anon, authenticated using (true);

-- ── 7. register_media_match: generalized fan-out (source/media-aware) ────────
create or replace function public.register_media_match(
  p_cv_name     text,
  p_external_id text,
  p_source      text,
  p_media_type  text,
  p_title       text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := p_source || ':' || p_external_id;
begin
  insert into public.titles (id, source, external_id, tmdb_id, media_type, title)
  values (v_id, p_source, p_external_id,
          case when p_source = 'tmdb' then p_external_id else null end,
          p_media_type, p_title)
  on conflict (id) do nothing;

  insert into public.hero_media_appearances (hero_id, title_id, media_type, source, cv_name, cv_url, rank)
  select h.id, v_id, p_media_type, 'comicvine', m->>'name', m->>'url', h.issue_count
  from public.heroes h,
       lateral jsonb_array_elements(to_jsonb(h.movies)) as m
  where h.movies is not null
    and lower(m->>'name') = lower(p_cv_name)
  on conflict (hero_id, title_id) do nothing;

  update public.tmdb_match_queue
     set status = 'matched', tmdb_id = p_external_id
   where cv_name = p_cv_name;
end;
$$;

-- Backward-compat wrapper so the unchanged drain match-phase call keeps working.
create or replace function public.register_film_match(
  p_cv_name text, p_tmdb_id text, p_media_type text, p_title text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.register_media_match(p_cv_name, p_tmdb_id, 'tmdb', 'film', p_title);
end;
$$;

-- ── 8. resolve_hero_qid: admin manual-review action (used in a later phase) ───
create or replace function public.resolve_hero_qid(p_hero_id text, p_qid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.heroes
     set wikidata_qid = p_qid,
         wikidata_status = 'resolved',
         wikidata_candidates = null
   where id = p_hero_id;
end;
$$;

commit;
```

- [ ] **Step 2: Apply the migration via the Supabase MCP**

Use the MCP tool `mcp__supabase__apply_migration` (project ref `rpvgqfaeiowisdubgxkg`) with name `wikidata_media_backbone` and the SQL above.
Expected: success, no error.

- [ ] **Step 3: Verify the backfill with a read query**

Use `mcp__supabase__execute_sql`:

```sql
select
  (select count(*) from titles) as titles,
  (select count(*) from titles where id = 'tmdb:' || external_id and source='tmdb' and media_type='film') as titles_backfilled,
  (select count(*) from hero_media_appearances) as edges,
  (select count(*) from hero_media_appearances where title_id = 'tmdb:' || tmdb_id and media_type='film' and source='comicvine') as edges_backfilled,
  (select count(*) from titles t left join hero_media_appearances a on a.title_id = t.id where a.title_id is null and a.hero_id is not null) as orphan_edges;
```

Expected: `titles` = `titles_backfilled` (723), `edges` = `edges_backfilled` (2867), `orphan_edges` = 0.

- [ ] **Step 4: Regenerate the generated types**

Use the MCP tool `mcp__supabase__generate_typescript_types` and overwrite `src/types/database.generated.ts` with the result. Do not hand-edit.
Expected: file contains `titles`, `hero_media_appearances`, `hero_people`, `hero_facts` table types and the new `heroes` columns.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260614153000_wikidata_media_backbone.sql src/types/database.generated.ts
git commit -m "feat(db): generalize films->titles media backbone (Lane 3 phase 1)"
```

---

## Task 2: Update the TMDB drain to the renamed schema

The live `enrich-tmdb-batch` reads/writes `films`/`tmdb_status`/`tmdb_id`. After Task 1 those names changed, so the function must be updated and redeployed or the cron drain breaks. Match phase is unchanged (it calls `register_film_match`, still present).

**Files:**
- Modify: `supabase/functions/enrich-tmdb-batch/index.ts`

- [ ] **Step 1: Update the enrich phase to the `titles` schema**

In `supabase/functions/enrich-tmdb-batch/index.ts`, replace the `runEnrich` function body's table/column references. Change the `runEnrich` function to:

```ts
async function runEnrich(sb: SB, limit: number): Promise<number> {
  const { data: titles } = await sb
    .from('titles')
    .select('id, external_id')
    .eq('source', 'tmdb')
    .eq('media_type', 'film')
    .eq('enrich_status', 'pending')
    .limit(limit);
  if (!titles || titles.length === 0) return 0;
  let calls = 0;
  for (const t of titles as Array<{ id: string; external_id: string }>) {
    calls++;
    try {
      const url = `${TMDB_BASE}/movie/${t.external_id}?api_key=${TMDB_API_KEY}&append_to_response=videos,watch/providers,credits,images`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) await sb.from('titles').update({ enrich_status: 'failed' }).eq('id', t.id);
        await sleep(250); continue;
      }
      const mapped = mapDetails(await res.json());
      await sb.from('titles').update({ ...mapped, enrich_status: 'done', enriched_at: new Date().toISOString() }).eq('id', t.id);
    } catch (err) {
      console.error('[enrich-tmdb-batch] enrich threw', t.id, err); // leave pending
    }
    await sleep(120);
  }
  return calls;
}
```

- [ ] **Step 2: Deploy the function**

Use the MCP tool `mcp__supabase__deploy_edge_function` to deploy `enrich-tmdb-batch` with the updated source.
Expected: deploy succeeds.

- [ ] **Step 3: Smoke-test the drain**

Use `mcp__supabase__execute_sql` to confirm nothing is left pending (everything is already `done`, so the drain should report "nothing to do"):

```sql
select enrich_status, count(*) from titles group by enrich_status;
```

Expected: all 723 rows `done` (so the drain has no work — proving the rename didn't strand rows). If any are `pending`/`failed`, that is pre-existing and acceptable.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/enrich-tmdb-batch/index.ts
git commit -m "fix(edge): point enrich-tmdb-batch at renamed titles schema"
```

---

## Task 3: `titles.ts` pure helpers (TDD)

**Files:**
- Create: `src/lib/db/titles.ts`
- Test: `__tests__/lib/titles.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/titles.test.ts`:

```ts
import {
  buildTitleId,
  parseTitleId,
  pickFeaturedTitle,
  groupTitlesByMedia,
  type HeroTitle,
} from '../../src/lib/db/titles';

function t(over: Partial<HeroTitle>): HeroTitle {
  return {
    id: 'tmdb:1', source: 'tmdb', mediaType: 'film', externalId: '1',
    title: 'X', year: null, posterUrl: null, backdropUrl: null, voteAverage: null,
    runtime: null, overview: null, trailerKey: null, watchProviders: null,
    cast: null, stills: null, revenue: null, details: null, ...over,
  };
}

describe('title id helpers', () => {
  it('builds a namespaced id', () => {
    expect(buildTitleId('tmdb', '603')).toBe('tmdb:603');
    expect(buildTitleId('igdb', '1020')).toBe('igdb:1020');
  });
  it('parses a namespaced id', () => {
    expect(parseTitleId('tmdb:603')).toEqual({ source: 'tmdb', externalId: '603' });
  });
  it('parses external ids that contain a colon', () => {
    expect(parseTitleId('igdb:a:b')).toEqual({ source: 'igdb', externalId: 'a:b' });
  });
});

describe('pickFeaturedTitle', () => {
  it('prefers the highest-rated title that has a backdrop', () => {
    const titles = [
      t({ id: 'tmdb:1', voteAverage: 9, backdropUrl: null }),
      t({ id: 'tmdb:2', voteAverage: 7, backdropUrl: 'b.jpg' }),
      t({ id: 'tmdb:3', voteAverage: 8, backdropUrl: 'c.jpg' }),
    ];
    expect(pickFeaturedTitle(titles)?.id).toBe('tmdb:3');
  });
  it('returns null for an empty list', () => {
    expect(pickFeaturedTitle([])).toBeNull();
  });
});

describe('groupTitlesByMedia', () => {
  it('buckets by media type preserving order', () => {
    const titles = [
      t({ id: 'tmdb:1', mediaType: 'film' }),
      t({ id: 'igdb:9', mediaType: 'game' }),
      t({ id: 'tmdb:2', mediaType: 'tv' }),
      t({ id: 'tmdb:3', mediaType: 'film' }),
    ];
    const g = groupTitlesByMedia(titles);
    expect(g.film.map((x) => x.id)).toEqual(['tmdb:1', 'tmdb:3']);
    expect(g.tv.map((x) => x.id)).toEqual(['tmdb:2']);
    expect(g.game.map((x) => x.id)).toEqual(['igdb:9']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/titles.test.ts`
Expected: FAIL — cannot find module `../../src/lib/db/titles`.

- [ ] **Step 3: Create `titles.ts` with the types and pure helpers**

Create `src/lib/db/titles.ts`:

```ts
import { supabase } from '../supabase';
import type { RelatedHeroCard } from './heroes';

export type MediaType = 'film' | 'tv' | 'game';
export type TitleSource = 'tmdb' | 'igdb';

export interface HeroTitleCastMember {
  name: string;
  character: string | null;
  profile_url: string | null;
}

export interface HeroTitle {
  id: string; // '<source>:<external_id>', e.g. 'tmdb:603'
  source: TitleSource;
  mediaType: MediaType;
  externalId: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  runtime: number | null;
  overview: string | null;
  trailerKey: string | null;
  watchProviders: Record<string, unknown> | null;
  cast: HeroTitleCastMember[] | null;
  stills: string[] | null;
  revenue: number | null;
  details: Record<string, unknown> | null;
}

export interface WatchProvider {
  name: string;
  logoUrl: string | null;
}

export interface TitlesByMedia {
  film: HeroTitle[];
  tv: HeroTitle[];
  game: HeroTitle[];
}

export function buildTitleId(source: TitleSource, externalId: string): string {
  return `${source}:${externalId}`;
}

export function parseTitleId(id: string): { source: string; externalId: string } {
  const i = id.indexOf(':');
  return i === -1
    ? { source: id, externalId: '' }
    : { source: id.slice(0, i), externalId: id.slice(i + 1) };
}

/** Strongest title to feature: highest-rated with a backdrop, else highest-rated. */
export function pickFeaturedTitle(titles: HeroTitle[]): HeroTitle | null {
  if (titles.length === 0) return null;
  const withBackdrop = titles.filter((tt) => !!tt.backdropUrl);
  const pool = withBackdrop.length > 0 ? withBackdrop : titles;
  return pool.reduce(
    (best, tt) => ((tt.voteAverage ?? 0) > (best.voteAverage ?? 0) ? tt : best),
    pool[0],
  );
}

/** Split a flat title list into per-media-type buckets, preserving order. */
export function groupTitlesByMedia(titles: HeroTitle[]): TitlesByMedia {
  const out: TitlesByMedia = { film: [], tv: [], game: [] };
  for (const tt of titles) out[tt.mediaType].push(tt);
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/titles.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/titles.ts __tests__/lib/titles.test.ts
git commit -m "feat(db): titles.ts pure helpers (id namespacing, featured, grouping)"
```

---

## Task 4: `titles.ts` query functions

**Files:**
- Modify: `src/lib/db/titles.ts`

- [ ] **Step 1: Append the row mapper and query functions**

Add to the end of `src/lib/db/titles.ts`:

```ts
const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

/** Watch providers from the raw TMDB blob: prefer US, dedupe by provider_name. */
export function extractProviders(blob: Record<string, unknown> | null): WatchProvider[] {
  if (!blob) return [];
  const regionData =
    (blob['US'] as Record<string, unknown> | undefined) ??
    Object.values(blob).find(
      (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
    );
  if (!regionData) return [];
  const seen = new Map<string, WatchProvider>();
  for (const key of ['flatrate', 'rent', 'buy'] as const) {
    const arr = regionData[key];
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (typeof p !== 'object' || p === null) continue;
      const row = p as Record<string, unknown>;
      const name = typeof row['provider_name'] === 'string' ? row['provider_name'] : null;
      if (!name || seen.has(name)) continue;
      const logoPath = typeof row['logo_path'] === 'string' ? row['logo_path'] : null;
      seen.set(name, { name, logoUrl: logoPath ? TMDB_LOGO_BASE + logoPath : null });
    }
  }
  return Array.from(seen.values());
}

interface TitleRow {
  id: string;
  source: TitleSource;
  media_type: MediaType;
  external_id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  vote_average: number | null;
  runtime: number | null;
  overview: string | null;
  trailer_key: string | null;
  watch_providers: Record<string, unknown> | null;
  cast_members: HeroTitleCastMember[] | null;
  stills: string[] | null;
  revenue: number | null;
  details: Record<string, unknown> | null;
}

const TITLE_SELECT =
  'id, source, media_type, external_id, title, year, poster_url, backdrop_url, vote_average, runtime, overview, trailer_key, watch_providers, cast_members, stills, revenue, details';

function titleRowToHeroTitle(r: TitleRow): HeroTitle {
  return {
    id: r.id,
    source: r.source,
    mediaType: r.media_type,
    externalId: r.external_id,
    title: r.title,
    year: r.year,
    posterUrl: r.poster_url,
    backdropUrl: r.backdrop_url,
    voteAverage: r.vote_average,
    runtime: r.runtime,
    overview: r.overview,
    trailerKey: r.trailer_key,
    watchProviders: r.watch_providers,
    cast: r.cast_members,
    stills: r.stills,
    revenue: r.revenue,
    details: r.details,
  };
}

interface JoinRow {
  rank: number | null;
  titles: TitleRow | null;
}

/** Titles a hero appears in, richest-first (rank = issue_count). */
export async function getHeroTitles(heroId: string): Promise<HeroTitle[]> {
  const { data, error } = await supabase
    .from('hero_media_appearances')
    .select(`rank, titles ( ${TITLE_SELECT} )`)
    .eq('hero_id', heroId)
    .order('rank', { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return (data as unknown as JoinRow[])
    .filter((r) => r.titles !== null)
    .map((r) => titleRowToHeroTitle(r.titles!));
}

/** A single title by composite id ('tmdb:603'). Null on error/not found. */
export async function getTitleById(id: string): Promise<HeroTitle | null> {
  const { data, error } = await supabase
    .from('titles')
    .select(TITLE_SELECT)
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return titleRowToHeroTitle(data as unknown as TitleRow);
}

/** Heroes appearing in a title, ranked desc. */
export async function getTitleHeroes(id: string): Promise<RelatedHeroCard[]> {
  const { data, error } = await supabase
    .from('hero_media_appearances')
    .select('heroes ( id, name, image_url, image_md_url, portrait_url, publisher, alignment )')
    .eq('title_id', id)
    .order('rank', { ascending: false, nullsFirst: false })
    .limit(30);
  if (error || !data) return [];
  return (data as unknown as Array<{ heroes: RelatedHeroCard | null }>)
    .filter((r) => r.heroes !== null)
    .map((r) => r.heroes!);
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors from `titles.ts` (consumers still import the now-deleted-later `films.ts`; those are fixed in Tasks 5–8 — if you run typecheck now, `films.ts` still exists so it passes).

- [ ] **Step 3: Run the helper tests again (still green)**

Run: `yarn jest __tests__/lib/titles.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/titles.ts
git commit -m "feat(db): titles.ts query layer (getHeroTitles/getTitleById/getTitleHeroes)"
```

---

## Task 5: Cut `MovieStrip` over to `HeroTitle`

`MovieStrip` is the On-Screen strip. It currently takes `films?: HeroFilm[]` and routes to `/film/<tmdbId>`. Cut it to `titles?: HeroTitle[]` routing to `/title/<id>`. **Film rendering stays identical** (TV/Games shelves are a later phase); we only swap the type and the route.

**Files:**
- Modify: `src/components/MovieStrip.tsx`

- [ ] **Step 1: Swap the imports**

In `src/components/MovieStrip.tsx`, replace:

```ts
import type { HeroFilm } from '../lib/db/films';
import { pickFeaturedFilm } from '../lib/db/films';
```

with:

```ts
import type { HeroTitle } from '../lib/db/titles';
import { pickFeaturedTitle } from '../lib/db/titles';
```

- [ ] **Step 2: Update the `StripItem`/`Props` types and `buildItems`**

In `StripItem`, replace `film?: HeroFilm;` with `title?: HeroTitle;`.
In `Props`, replace `films?: HeroFilm[];` with `titles?: HeroTitle[];`.
Replace the `buildItems` signature and film branch:

```ts
function buildItems(titles?: HeroTitle[], movies?: MovieAppearance[]): StripItem[] {
  if (titles && titles.length > 0) {
    return titles.map((f) => ({
      key: f.id,
      title: f.title,
      year: f.year ? String(f.year) : null,
      posterUrl: f.posterUrl,
      backdropUrl: f.backdropUrl,
      voteAverage: f.voteAverage,
      hasTrailer: !!f.trailerKey,
      title_ref: f,
    }));
  }
```

Note: rename the item field to avoid clashing with the existing `title: string`. Change the `StripItem` field to `title_ref?: HeroTitle;` and update the three usages below accordingly (Steps 3–5). Keep the `movies` branch unchanged.

- [ ] **Step 3: Update the component signature and references**

Change the function signature and the `isFilmsPath`/feature/handlePress logic. Replace:

```ts
export function MovieStrip({ films, movies, totalCount, contentInset = 16, bleedMargin = 0 }: Props) {
```

with:

```ts
export function MovieStrip({ titles, movies, totalCount, contentInset = 16, bleedMargin = 0 }: Props) {
```

Replace `const allItems = buildItems(films, movies);` with `const allItems = buildItems(titles, movies);`.
Replace `const isFilmsPath = !!(films && films.length > 0);` with `const isFilmsPath = !!(titles && titles.length > 0);`.

In `handlePress`, replace the `item.film` branch:

```ts
  const handlePress = (item: StripItem) => {
    if (item.title_ref) {
      router.push(`/title/${item.title_ref.id}`);
    } else if (item.movie) {
      const url = item.movie.url ?? `https://www.google.com/search?q=${encodeURIComponent(item.title + ' film')}`;
      Linking.openURL(url);
    }
  };
```

- [ ] **Step 4: Update the web + native featured-pick references**

Replace every `pickFeaturedFilm(films ?? [])` with `pickFeaturedTitle(titles ?? [])` (two occurrences: web block and native block).
Replace every `it.film?.tmdbId === webFeatured.tmdbId` / `=== featuredFilm.tmdbId` with `it.title_ref?.id === webFeatured.id` / `=== featuredFilm.id`.
Replace the three `item.film?.runtime` / `item.film?.overview` reads in `WebFeaturedFilm` with `item.title_ref?.runtime` / `item.title_ref?.overview`.

- [ ] **Step 5: Typecheck**

Run: `yarn tsc --noEmit`
Expected: errors only in the not-yet-updated consumers (`character/[id].tsx`, `[id].web.tsx`, `film/*`) which still reference `films.ts`. `MovieStrip.tsx` itself: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/MovieStrip.tsx
git commit -m "refactor(ui): MovieStrip consumes HeroTitle, routes to /title/<id>"
```

---

## Task 6: Cut the `film/*` detail components over to `HeroTitle`

Three components import types from `films.ts`. Point them at `titles.ts`. They use a subset of fields present on both types, so only imports change.

**Files:**
- Modify: `src/components/film/FilmBackdropHeader.tsx`, `src/components/film/CastRail.tsx`, `src/components/film/WhereToWatch.tsx`

- [ ] **Step 1: FilmBackdropHeader**

In `src/components/film/FilmBackdropHeader.tsx`, replace `import type { HeroFilm } from '../../lib/db/films';` with `import type { HeroTitle } from '../../lib/db/titles';` and replace each `HeroFilm` in the file with `HeroTitle`. If it reads `film.tmdbId`, replace with `film.id` (used only for a TMDB external link, if present — verify by reading the file; if it builds `https://www.themoviedb.org/movie/<tmdbId>`, change to use `film.externalId`).

- [ ] **Step 2: CastRail**

In `src/components/film/CastRail.tsx`, replace `import type { HeroFilmCastMember } from '../../lib/db/films';` with `import type { HeroTitleCastMember } from '../../lib/db/titles';` and replace each `HeroFilmCastMember` with `HeroTitleCastMember`.

- [ ] **Step 3: WhereToWatch**

In `src/components/film/WhereToWatch.tsx`, replace `import type { WatchProvider } from '../../lib/db/films';` with `import type { WatchProvider } from '../../lib/db/titles';`.

- [ ] **Step 4: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors from `src/components/film/*`. Remaining errors only in `app/film/[tmdbId].tsx`, `app/character/[id].tsx`, `app/character/[id].web.tsx` (fixed next).

- [ ] **Step 5: Commit**

```bash
git add src/components/film/FilmBackdropHeader.tsx src/components/film/CastRail.tsx src/components/film/WhereToWatch.tsx
git commit -m "refactor(ui): film detail components use HeroTitle types"
```

---

## Task 7: New `/title/[id]` screen + `/film/[tmdbId]` redirect

`app/film/[tmdbId].tsx` is the current detail screen reading `getFilmById`. Create `app/title/[id].tsx` reading `getTitleById` (param is the composite id, e.g. `tmdb:603`), then replace `app/film/[tmdbId].tsx` with a redirect so old links keep working.

**Files:**
- Create: `app/title/[id].tsx`
- Modify: `app/film/[tmdbId].tsx`

- [ ] **Step 1: Create the `/title/[id]` screen**

Copy the entire current contents of `app/film/[tmdbId].tsx` into `app/title/[id].tsx`, then apply these changes:
- Imports: replace `import { getFilmById, getFilmHeroes, extractProviders } from '../../src/lib/db/films';` and `import type { HeroFilm } from '../../src/lib/db/films';` with:
  ```ts
  import { getTitleById, getTitleHeroes, extractProviders } from '../../src/lib/db/titles';
  import type { HeroTitle } from '../../src/lib/db/titles';
  ```
- Param: replace `const { tmdbId } = useLocalSearchParams<{ tmdbId: string }>();` with `const { id } = useLocalSearchParams<{ id: string }>();`.
- State type: replace `useState<HeroFilm | null | undefined>` with `useState<HeroTitle | null | undefined>`.
- Effect: replace `if (!tmdbId)` with `if (!id)`, `getFilmById(tmdbId)` with `getTitleById(id)`, `getFilmHeroes(tmdbId)` with `getTitleHeroes(id)`, and the dependency `[tmdbId]` with `[id]`.
- TMDB link: replace `const tmdbUrl = \`https://www.themoviedb.org/movie/${film.tmdbId}\`;` with:
  ```ts
  const tmdbUrl = `https://www.themoviedb.org/movie/${film.externalId}`;
  ```
- Rename the local `film` variable usages as-is (the variable can stay named `film`; it now holds a `HeroTitle`).

- [ ] **Step 2: Replace `/film/[tmdbId]` with a redirect**

Overwrite `app/film/[tmdbId].tsx` with:

```tsx
import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy film route — kept so existing /film/<tmdbId> links resolve to the
 *  generalized /title/<source:id> detail screen. */
export default function FilmRedirect() {
  const { tmdbId } = useLocalSearchParams<{ tmdbId: string }>();
  if (!tmdbId) return <Redirect href="/" />;
  return <Redirect href={`/title/tmdb:${tmdbId}`} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit`
Expected: errors only in `app/character/[id].tsx` and `app/character/[id].web.tsx` (fixed next).

- [ ] **Step 4: Commit**

```bash
git add app/title/[id].tsx app/film/[tmdbId].tsx
git commit -m "feat(ui): /title/[id] media detail screen; /film redirect"
```

---

## Task 8: Cut the character screens over + delete `films.ts`

**Files:**
- Modify: `app/character/[id].tsx`, `app/character/[id].web.tsx`
- Delete: `src/lib/db/films.ts`

- [ ] **Step 1: Update `app/character/[id].tsx`**

Replace `import { getHeroFilms, type HeroFilm } from '../../src/lib/db/films';` with:

```ts
import { getHeroTitles, type HeroTitle } from '../../src/lib/db/titles';
```

Replace the state declaration `const [films, setFilms] = useState<HeroFilm[] | null>(null);` with:

```ts
const [titles, setTitles] = useState<HeroTitle[] | null>(null);
```

Replace `getHeroFilms(data.stats.id).then((f) => { if (active) setFilms(f); });` with:

```ts
getHeroTitles(data.stats.id).then((t) => { if (active) setTitles(t); });
```

Update the three other `films` references:
- The section-list guard `if (comicVineLoading || (films && films.length > 0))` → `(titles && titles.length > 0)`.
- The On-Screen render block `films && films.length > 0 ? (... <SectionHeader title={\`On Screen (${films.length})\`} /> ... <MovieStrip films={films} totalCount={films.length} ...` → use `titles`: `titles && titles.length > 0 ? (...) `, `On Screen (${titles.length})`, and `<MovieStrip titles={titles} totalCount={titles.length} ... />`.
- Any other `films` identifier in the file (search for `films`) → `titles`, except the unrelated `heroRow.movies` / `data.details.movies` CV-fallback logic, which stays.

- [ ] **Step 2: Apply the identical changes to `app/character/[id].web.tsx`**

Repeat Step 1's import, state, fetch, and `MovieStrip` prop changes in `app/character/[id].web.tsx` (same identifiers; the web variant mirrors the native one).

- [ ] **Step 3: Delete `films.ts`**

```bash
git rm src/lib/db/films.ts
```

- [ ] **Step 4: Typecheck — must be fully clean now**

Run: `yarn tsc --noEmit`
Expected: **no errors.** (If any file still imports `db/films`, grep and fix: `grep -rn "db/films" app src`.)

- [ ] **Step 5: Commit**

```bash
git add app/character/[id].tsx app/character/[id].web.tsx
git commit -m "refactor(ui): character screens consume getHeroTitles; remove films.ts"
```

---

## Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: No stale `films` references remain**

Run: `grep -rn "db/films\|getHeroFilms\|getFilmById\|pickFeaturedFilm\|HeroFilm\b" app src`
Expected: no matches (all cut over). `register_film_match` in SQL is intentional (the wrapper) — not matched by this grep.

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `yarn test:ci`
Expected: all pass, including the new `__tests__/lib/titles.test.ts`.

- [ ] **Step 4: Manual smoke test (the film path must be unchanged)**

Run: `yarn start` and open a hero with films (e.g. Batman) on web and/or native.
Verify:
- The "On Screen" section renders posters/backdrops exactly as before.
- Tapping a poster opens the detail screen at `/title/tmdb:<id>` (URL on web) and shows overview/cast/stills/where-to-watch/heroes-in-film.
- An old `/film/<tmdbId>` URL redirects to `/title/tmdb:<tmdbId>` and renders.
Expected: visually identical to pre-migration film behavior.

- [ ] **Step 5: Final commit (if any smoke-test fixes were needed)**

```bash
git add -A
git commit -m "test: verify titles backbone film path unchanged (Lane 3 phase 1)"
```

---

## Self-Review Notes

- **Spec coverage (Phase 1 scope):** `titles`/`hero_media_appearances` rename+backfill (Task 1), composite `id` scheme (Tasks 1, 3), `wikidata_*` columns + `hero_people` + `hero_facts` + RLS (Task 1), `register_media_match`/`resolve_hero_qid` RPCs (Task 1), drain kept working (Task 2), `titles.ts` query layer (Tasks 3–4), `/title` + `/film` redirect (Task 7), client cutover with film path unchanged (Tasks 5–9). Out-of-phase items (TV/game rendering, Wikidata drains, Portrayed-by, admin panel) are explicitly deferred to later plans.
- **Type consistency:** `HeroTitle`, `HeroTitleCastMember`, `WatchProvider`, `getHeroTitles`, `getTitleById`, `getTitleHeroes`, `buildTitleId`, `parseTitleId`, `pickFeaturedTitle`, `groupTitlesByMedia` are defined in Task 3/4 and used with those exact names in Tasks 5–8. The `StripItem.title_ref` rename avoids the existing `title: string` collision.
- **Migration safety:** FK `hero_film_appearances_tmdb_id_fkey` dropped before moving the `films_pkey`; `media_type` check `films_media_type_check` dropped before the generalized constraint; `tmdb_id` columns retained for transition; backfill verified by row-count query before types regenerate.
```
