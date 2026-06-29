-- Order the CHARACTERS shown for a title/campaign by fame (most recognizable cast
-- first); title-level trending order (TMDB popularity / release date) is unchanged.

CREATE OR REPLACE FUNCTION public.get_active_campaigns(p_limit integer DEFAULT 3, p_chars integer DEFAULT 16)
 RETURNS TABLE(campaign_id uuid, label text, headline text, blurb text, accent text, backdrop_url text, poster_url text, title_id text, hero_id text, hero_name text, hero_image_url text, hero_portrait_url text)
 LANGUAGE sql STABLE
AS $function$
  with active as (
    select * from public.featured_campaigns
    where now() between starts_at and ends_at
    order by priority desc, starts_at desc
    limit p_limit
  ),
  resolved as (
    select c.id as campaign_id, c.label, c.headline, c.blurb, c.accent,
           c.priority, c.starts_at, c.title_id,
           t.backdrop_url, t.poster_url,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           row_number() over (
             partition by c.id order by h.fame_score desc nulls last
           ) as rn
    from active c
    left join public.titles t on t.id = c.title_id
    join public.heroes h on (
      (c.hero_ids is not null and h.id = any(c.hero_ids))
      or (c.hero_ids is null and c.franchise is not null and h.franchise = c.franchise)
      or (c.hero_ids is null and c.franchise is null and c.title_id is not null
          and exists (
            select 1 from public.hero_media_appearances a
            where a.title_id = c.title_id and a.hero_id = h.id
          ))
    )
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select campaign_id, label, headline, blurb, accent,
         backdrop_url, poster_url, title_id,
         hero_id, hero_name, hero_image_url, hero_portrait_url
  from resolved
  where rn <= p_chars
  order by priority desc, starts_at desc, rn;
$function$;

CREATE OR REPLACE FUNCTION public.get_trending_for_user(p_user_id uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(id text, name text, image_url text, portrait_url text, context_title text)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  with aff as (
    select distinct h.publisher, h.franchise
    from (
      select hero_id from public.user_favourites where user_id = p_user_id
      union
      select hero_id from public.user_view_history where user_id = p_user_id
    ) u
    join public.heroes h on h.id = u.hero_id
    where h.publisher is not null or h.franchise is not null
  )
  select s.id, s.name, s.image_url, s.portrait_url, s.context_title
  from (
    select distinct on (h.id)
      h.id, h.name, h.image_url, h.portrait_url, t.title as context_title, t.release_date
    from public.titles t
    join public.hero_media_appearances a on a.title_id = t.id
    join public.heroes h on h.id = a.hero_id
    join aff on (aff.publisher = h.publisher or aff.franchise = h.franchise)
    where t.media_type in ('film', 'tv')
      and t.release_date between current_date - 540 and current_date + 120
      and (h.portrait_url is not null or h.image_url is not null)
    order by h.id, t.release_date desc nulls last, h.fame_score desc nulls last
  ) s
  order by s.release_date desc nulls last
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_trending_heroes(p_bucket text DEFAULT 'on_screen'::text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id text, name text, image_url text, portrait_url text, context_title text, media_type text, release_date date, provider text)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  select s.id, s.name, s.image_url, s.portrait_url,
         s.context_title, s.media_type, s.release_date, s.provider
  from (
    select distinct on (h.id)
      h.id, h.name, h.image_url, h.portrait_url, h.fame_score,
      t.title as context_title, t.media_type, t.release_date,
      (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider
    from public.hero_media_appearances a
    join public.heroes h on h.id = a.hero_id
    join public.titles t on t.id = a.title_id
    where t.media_type in ('film', 'tv')
      and (h.portrait_url is not null or h.image_url is not null)
      and case p_bucket
        when 'on_screen'   then t.release_date between current_date - 365 and current_date
        when 'coming_soon' then t.release_date > current_date
        when 'streaming'   then t.release_date between current_date - 540 and current_date
                                and (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') is not null
        else false
      end
    order by h.id,
      case when p_bucket = 'coming_soon' then t.release_date end asc,
      case when p_bucket <> 'coming_soon' then t.release_date end desc,
      a.rank asc nulls last
  ) s
  order by
    case when p_bucket = 'coming_soon' then s.release_date end asc nulls last,
    case when p_bucket <> 'coming_soon' then s.release_date end desc nulls last,
    s.fame_score desc nulls last,
    s.context_title
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_trending_titles(p_bucket text DEFAULT 'on_screen'::text, p_title_limit integer DEFAULT 6, p_chars_per_title integer DEFAULT 10)
 RETURNS TABLE(title_id text, title text, media_type text, release_date date, backdrop_url text, poster_url text, provider text, overview text, hero_id text, hero_name text, hero_image_url text, hero_portrait_url text)
 LANGUAGE sql STABLE
AS $function$
  with ranked as (
    select * from (
      select t.id, t.title, t.media_type, t.release_date, t.backdrop_url, t.poster_url,
        (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider,
        t.overview,
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
           r.provider, r.overview, r.trank,
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
  select title_id, title, media_type, release_date, backdrop_url, poster_url, provider, overview,
         hero_id, hero_name, hero_image_url, hero_portrait_url
  from chars
  where crank <= p_chars_per_title
  order by trank, crank;
$function$;
