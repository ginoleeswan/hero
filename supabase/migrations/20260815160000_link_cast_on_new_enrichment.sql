-- Link new cast within the hour, without paying for it 23 times a day.
--
-- The chain for a title Mythique has just heard about is: discovery mints a thin
-- row -> enrich-tmdb-pending (15 min) fills cast_members -> link_tmdb_cast()
-- maps those to heroes -> the Pulse rail can finally show its trailer, because
-- the rail's trailer_cast join is an INNER join and drops any title with no
-- mapped characters. Every hop but the last is minutes. The last one ran nightly,
-- so on 2026-08-15 the Percy Jackson, VisionQuest, Bluey and Ghost Market
-- trailers were ingested, matched and promoted within hours of release and then
-- sat invisible waiting for 03:40.
--
-- Simply running link_tmdb_cast() hourly is the obvious fix and the wrong one:
-- measured at 25s for a full-catalogue pass, that is ~10 minutes a day of heavy
-- scan added to a project with a documented free-tier disk-IO ceiling, and 23 of
-- those 24 runs would link nothing at all.
--
-- So: gate it. `titles.enriched_at` is stamped by the TMDB drain, so "has
-- anything gained cast_members since the last link run" is a cheap indexed
-- question. When the answer is no — almost always — the job costs one query.
--
-- Deliberately does NOT redefine link_tmdb_cast(). Its matching rules are being
-- actively tuned elsewhere, and this repo has already learned what happens when
-- one behaviour lives in two places (see the ComicVine dual-enrich-paths drift).
-- This only changes HOW OFTEN the existing function runs.
--
-- Note what the gate does not cover: link_tmdb_cast() also creates links when a
-- new HERO appears for an already-enriched title. That path has no signal here
-- and stays on the nightly run, which is the right cadence for it — a new hero
-- row is not news the way a new trailer is.

create table if not exists public.maintenance_runs (
  job          text primary key,
  last_run_at  timestamptz not null default now(),
  last_result  jsonb
);

alter table public.maintenance_runs enable row level security;
-- No policies: service-role only. Nothing client-side has any use for this.

create index if not exists titles_enriched_at_idx on public.titles (enriched_at desc);

create or replace function public.link_tmdb_cast_if_new_enrichment()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_since  timestamptz;
  v_new    integer;
  v_linked integer;
  v_result jsonb;
begin
  select last_run_at into v_since
  from public.maintenance_runs where job = 'link_tmdb_cast';

  -- No record of ever running: treat everything as new, once.
  v_since := coalesce(v_since, '-infinity'::timestamptz);

  select count(*) into v_new
  from public.titles t
  where t.enriched_at > v_since
    and t.cast_members is not null;

  if v_new = 0 then
    -- Deliberately does not stamp last_run_at. Stamping on a skip would move the
    -- watermark past enrichments that arrive while this transaction runs, and a
    -- title silently skipped forever is worse than a wasted query.
    return jsonb_build_object('skipped', true, 'since', v_since);
  end if;

  v_linked := public.link_tmdb_cast();
  v_result := jsonb_build_object('newly_enriched', v_new, 'linked', v_linked);

  insert into public.maintenance_runs (job, last_run_at, last_result)
  values ('link_tmdb_cast', now(), v_result)
  on conflict (job) do update
    set last_run_at = excluded.last_run_at,
        last_result = excluded.last_result;

  return v_result;
end;
$$;

revoke all on function public.link_tmdb_cast_if_new_enrichment() from public, anon, authenticated;

-- :25 — after enrich-tmdb-pending has had a chance to fill cast_members, and
-- clear of the two video sweeps at :10 and :40.
do $$
declare v_key text;
begin
  select substring(command from 'Bearer ([A-Za-z0-9._-]+)') into v_key
  from cron.job where jobname = 'sync-title-videos-hourly';
  if v_key is null then
    raise exception 'could not read the anon key from an existing cron job';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'link-tmdb-cast-hourly';

  perform cron.schedule(
    'link-tmdb-cast-hourly',
    '25 * * * *',
    $cmd$select public.link_tmdb_cast_if_new_enrichment();$cmd$
  );
end
$$;
