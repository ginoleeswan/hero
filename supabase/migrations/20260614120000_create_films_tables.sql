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
