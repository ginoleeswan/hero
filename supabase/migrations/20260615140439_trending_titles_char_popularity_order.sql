-- Lead each title's character strip with the most recognizable characters
-- (issue_count) rather than TMDB billing order, so clusters read He-Man/Skeletor
-- before bit players.
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

grant execute on function public.get_trending_titles(text, integer, integer) to anon, authenticated, service_role;;
