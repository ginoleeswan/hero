-- "Trending on Screen" reader. Sibling of get_trending_titles, but ordered by the
-- daily TMDB trending_rank and carrying trailer_key for the play affordance. Only
-- titles that have a catalogue character with art are returned.
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
as $$
  with ranked as (
    select t.id, t.title, t.media_type, t.release_date, t.backdrop_url, t.poster_url,
           t.trailer_key,
           (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider,
           t.trending_rank
    from public.titles t
    where t.trending_rank is not null
      and t.media_type in ('film', 'tv')
      and exists (
        select 1 from public.hero_media_appearances a
        join public.heroes h on h.id = a.hero_id
        where a.title_id = t.id and (h.portrait_url is not null or h.image_url is not null)
      )
    order by t.trending_rank asc
    limit p_limit
  ),
  chars as (
    select r.id as title_id, r.title, r.media_type, r.release_date, r.backdrop_url, r.poster_url,
           r.trailer_key, r.provider, r.trending_rank,
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
  order by trending_rank, crank;
$$;
grant execute on function public.get_trending_on_screen(integer, integer)
  to anon, authenticated, service_role;
