-- Restore hero_avatar_url, and give it to BOTH functions this time.
--
-- The singular returned it; the multi never did, so groupTitleRows has been
-- mapping a column the bundle path never sent — every trending-title character
-- came through with avatar_url null. Recreating the singular as a delegate
-- surfaced the gap by dropping the column outright. Adding it to the multi
-- closes the drift in the direction that keeps the data, rather than the one
-- that loses it.
drop function if exists public.get_trending_titles_multi(text[], int, int);
drop function if exists public.get_trending_titles(text, int, int);

create function public.get_trending_titles_multi(
  p_buckets text[],
  p_title_limit int default 6,
  p_chars_per_title int default 12
)
returns table (
  bucket text, title_id text, title text, media_type text, release_date date,
  backdrop_url text, poster_url text, provider text, provider_logo text,
  overview text, hero_id text, hero_name text, hero_image_url text,
  hero_portrait_url text, hero_avatar_url text
)
language sql
stable
set search_path to 'public'
as $function$
  with ranked as (
    select * from (
      select b.bucket,
        t.id, t.title, t.media_type, t.release_date, t.backdrop_url, t.poster_url,
        (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider,
        case
          when (t.watch_providers::jsonb #>> '{US,flatrate,0,logo_path}') is not null
          then 'https://image.tmdb.org/t/p/w92' ||
               (t.watch_providers::jsonb #>> '{US,flatrate,0,logo_path}')
        end as provider_logo,
        t.overview,
        row_number() over (
          partition by b.bucket
          order by
            case when b.bucket = 'coming_soon' then t.release_date end asc nulls last,
            coalesce(t.popularity, 0) desc,
            case when b.bucket <> 'coming_soon' then t.release_date end desc nulls last
        ) as trank
      from unnest(p_buckets) as b(bucket)
      cross join public.titles t
      where t.media_type in ('film', 'tv')
        and case b.bucket
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
    select r.bucket, r.id as title_id, r.title, r.media_type, r.release_date,
           r.backdrop_url, r.poster_url, r.provider, r.provider_logo, r.overview, r.trank,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           h.avatar_url as hero_avatar_url,
           row_number() over (
             partition by r.bucket, r.id order by h.fame_score desc nulls last, a.rank asc nulls last
           ) as crank
    from ranked r
    join public.hero_media_appearances a on a.title_id = r.id
    join public.heroes h on h.id = a.hero_id
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select bucket, title_id, title, media_type, release_date, backdrop_url, poster_url,
         provider, provider_logo, overview, hero_id, hero_name, hero_image_url,
         hero_portrait_url, hero_avatar_url
  from chars
  where crank <= p_chars_per_title
  order by trank, crank;
$function$;

create function public.get_trending_titles(
  p_bucket text,
  p_title_limit int default 6,
  p_chars_per_title int default 12
)
returns table (
  title_id text, title text, media_type text, release_date date,
  backdrop_url text, poster_url text, provider text, provider_logo text,
  overview text, hero_id text, hero_name text, hero_image_url text,
  hero_portrait_url text, hero_avatar_url text
)
language sql
stable
set search_path to 'public'
as $function$
  select title_id, title, media_type, release_date, backdrop_url, poster_url,
         provider, provider_logo, overview, hero_id, hero_name, hero_image_url,
         hero_portrait_url, hero_avatar_url
  from public.get_trending_titles_multi(array[p_bucket], p_title_limit, p_chars_per_title);
$function$;

grant execute on function public.get_trending_titles_multi(text[], int, int) to anon, authenticated;
grant execute on function public.get_trending_titles(text, int, int) to anon, authenticated;;
