-- Phase 2: title-grouped "what's current" clusters + a real-time trending signal.
-- 1. Capture TMDB popularity (the daily-decaying attention score) on titles.
-- 2. get_trending_titles returns the current slate grouped by title, each with
--    its top characters, so Explore can render poster/backdrop clusters that make
--    the show↔character link explicit.
-- 3. A paused weekly cron re-flags the current window so the existing TMDB drain
--    refreshes popularity (no new edge code) — flip on from the command center.

alter table public.titles add column if not exists popularity numeric;
create index if not exists titles_popularity_idx on public.titles (popularity desc nulls last);

-- Title-grouped trending feed. Flat rows (title fields repeated per character),
-- grouped client-side — same shape as get_era_timeline. Title ordering uses
-- popularity when present (real-time), falling back to recency so it works before
-- the popularity backfill runs. Characters within a title lead by fame
-- (issue_count) so marquee names show before bit players. Buckets mirror
-- get_trending_heroes.
create or replace function public.get_trending_titles(
  p_bucket text default 'on_screen',
  p_title_limit integer default 6,
  p_chars_per_title integer default 10
)
returns table (
  title_id text, title text, media_type text, release_date date,
  backdrop_url text, poster_url text, provider text,
  hero_id text, hero_name text, hero_image_url text, hero_portrait_url text
)
language sql
stable
as $$
  with ranked as (
    select * from (
      select t.id, t.title, t.media_type, t.release_date, t.backdrop_url, t.poster_url,
        (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider,
        row_number() over (
          order by
            case when p_bucket = 'coming_soon' then t.release_date end asc nulls last,
            coalesce(t.popularity, 0) desc,
            case when p_bucket <> 'coming_soon' then t.release_date end desc nulls last
        ) as trank
      from public.titles t
      where t.media_type in ('film', 'tv')
        and case p_bucket
          when 'on_screen'   then t.release_date between current_date - 365 and current_date
          when 'coming_soon' then t.release_date > current_date
          when 'streaming'   then t.release_date between current_date - 540 and current_date
                                  and (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') is not null
          else false
        end
        and exists (
          select 1 from public.hero_media_appearances a
          join public.heroes h on h.id = a.hero_id
          where a.title_id = t.id and (h.portrait_url is not null or h.image_url is not null)
        )
    ) z
    where z.trank <= p_title_limit
  ),
  chars as (
    select r.id as title_id, r.title, r.media_type, r.release_date, r.backdrop_url, r.poster_url,
           r.provider, r.trank,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           row_number() over (
             partition by r.id order by h.issue_count desc nulls last, a.rank asc nulls last
           ) as crank
    from ranked r
    join public.hero_media_appearances a on a.title_id = r.id
    join public.heroes h on h.id = a.hero_id
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select title_id, title, media_type, release_date, backdrop_url, poster_url, provider,
         hero_id, hero_name, hero_image_url, hero_portrait_url
  from chars
  where crank <= p_chars_per_title
  order by trank, crank;
$$;

grant execute on function public.get_trending_titles(text, integer, integer) to anon, authenticated, service_role;

-- Weekly refresh of the current window so TMDB popularity stays live. Re-flags
-- titles to 'pending'; the existing enrich-tmdb-batch drain re-pulls details
-- (now including popularity). Created PAUSED — enable alongside the tmdb drain.
select cron.schedule(
  'refresh-tmdb-trending',
  '17 4 * * 1',
  $cron$
  update public.titles set enrich_status = 'pending'
  where media_type in ('film', 'tv')
    and release_date between current_date - 540 and current_date + 120;
  $cron$
);
do $$
declare r record;
begin
  for r in select jobid from cron.job where jobname = 'refresh-tmdb-trending' loop
    perform cron.alter_job(r.jobid, active := false);
  end loop;
end $$;
