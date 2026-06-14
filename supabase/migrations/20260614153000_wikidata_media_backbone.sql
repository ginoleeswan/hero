-- Lane 3 Phase 1: generalize films -> titles backbone; add Wikidata resolution
-- scaffolding (columns/tables created now, written by later phases). The live
-- TMDB drain keeps working: register_film_match remains as a wrapper, and the
-- edge function is updated to the renamed schema in the same deploy.

begin;

-- ── 1. films -> titles ───────────────────────────────────────────────────────
alter table public.films rename to titles;

-- drop the old movie/tv check BEFORE remapping media_type to 'film'
alter table public.titles drop constraint films_media_type_check;

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
