-- "Trending on Screen" reader — rolling-window model.
--
-- Previously this gated on `trending_rank is not null`, i.e. "was in TODAY's TMDB
-- daily-trending list". Because sync-tmdb-trending nulls every rank each run and
-- only re-stamps titles that appear in that day's list AND exist in our catalogue,
-- a single thin-match day collapsed the whole feed (What's Hot + the auto Right-Now
-- hero) to one title. It ignored `trending_at`, which the sync already keeps.
--
-- Now: a title is "trending on screen" if it appeared in the TMDB trending list
-- within the last 7 days ("this week", matching the band copy). Ordered recency-
-- first (by trending day, then rank within that day), so genuinely-current titles
-- always lead and older ones only fill remaining slots — graceful degradation
-- instead of a one-item list on a thin day.
create or replace function public.get_trending_on_screen(
  p_limit integer default 12,
  p_chars_per_title integer default 10
)
returns table (
  title_id text, title text, media_type text, release_date date,
  backdrop_url text, poster_url text, trailer_key text, provider text,
  hero_id text, hero_name text, hero_image_url text, hero_portrait_url text
)
language sql
stable
set search_path to 'public'
as $$
  with ranked as (
    select t.id, t.title, t.media_type, t.release_date, t.backdrop_url, t.poster_url,
           t.trailer_key,
           (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider,
           t.trending_at, t.trending_rank
    from public.titles t
    where t.trending_at is not null
      and t.trending_at > now() - interval '7 days'
      and t.media_type in ('film', 'tv')
      and exists (
        select 1 from public.hero_media_appearances a
        join public.heroes h on h.id = a.hero_id
        where a.title_id = t.id and (h.portrait_url is not null or h.image_url is not null)
      )
    -- Most recent trending day first; within a day, best TMDB rank first.
    order by t.trending_at::date desc, t.trending_rank asc nulls last
    limit p_limit
  ),
  chars as (
    select r.id as title_id, r.title, r.media_type, r.release_date, r.backdrop_url, r.poster_url,
           r.trailer_key, r.provider, r.trending_at, r.trending_rank,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           row_number() over (
             partition by r.id order by h.fame_score desc nulls last, a.rank asc nulls last
           ) as crank
    from ranked r
    join public.hero_media_appearances a on a.title_id = r.id
    join public.heroes h on h.id = a.hero_id
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select title_id, title, media_type, release_date, backdrop_url, poster_url, trailer_key, provider,
         hero_id, hero_name, hero_image_url, hero_portrait_url
  from chars
  where crank <= p_chars_per_title
  order by trending_at::date desc, trending_rank asc nulls last, crank;
$$;
grant execute on function public.get_trending_on_screen(integer, integer)
  to anon, authenticated, service_role;
