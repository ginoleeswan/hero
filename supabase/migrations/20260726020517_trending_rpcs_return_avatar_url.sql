-- Return avatar_url from the home-page RPCs, so their hero slots can show the
-- flat head instead of cropping a portrait into a circle.
--
-- Every consumer of these is already round: the Biggest Movers leaderboard
-- (34/40px), the Right Now campaign chip stacks (34/42px, heads overlapping
-- each other over artwork) and the This Month in History debut chips (44/52px).
--
-- All additive — no WHERE, ORDER BY or window function is touched. The three
-- with a RETURNS TABLE change have to drop and recreate (a return type can't be
-- CREATE OR REPLACE'd), hence the re-grants; get_debuts_this_month carries its
-- characters as jsonb so it only needs a new key.

drop function if exists public.get_trending_heroes_wiki(integer, integer);
CREATE OR REPLACE FUNCTION public.get_trending_heroes_wiki(p_limit integer DEFAULT 12, p_min_week integer DEFAULT 1000)
 RETURNS TABLE(id text, name text, image_url text, portrait_url text, avatar_url text, pageviews_week integer, pageviews_spike numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select id, name, image_url, portrait_url, avatar_url, pageviews_week, pageviews_spike
  from public.heroes
  where pageviews_week >= p_min_week
    and pageviews_spike is not null
    and (portrait_url is not null or image_url is not null)
  order by pageviews_spike desc
  limit p_limit;
$function$;
grant execute on function public.get_trending_heroes_wiki(integer, integer)
  to anon, authenticated, service_role;

drop function if exists public.get_trending_titles(text, integer, integer);
CREATE OR REPLACE FUNCTION public.get_trending_titles(p_bucket text DEFAULT 'on_screen'::text, p_title_limit integer DEFAULT 6, p_chars_per_title integer DEFAULT 10)
 RETURNS TABLE(title_id text, title text, media_type text, release_date date, backdrop_url text, poster_url text, provider text, overview text, hero_id text, hero_name text, hero_image_url text, hero_portrait_url text, hero_avatar_url text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
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
           h.avatar_url as hero_avatar_url,
           row_number() over (
             partition by r.id order by h.fame_score desc nulls last, a.rank asc nulls last
           ) as crank
    from ranked r
    join public.hero_media_appearances a on a.title_id = r.id
    join public.heroes h on h.id = a.hero_id
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select title_id, title, media_type, release_date, backdrop_url, poster_url, provider, overview,
         hero_id, hero_name, hero_image_url, hero_portrait_url, hero_avatar_url
  from chars
  where crank <= p_chars_per_title
  order by trank, crank;
$function$;
grant execute on function public.get_trending_titles(text, integer, integer)
  to anon, authenticated, service_role;

drop function if exists public.get_active_campaigns(integer, integer);
CREATE OR REPLACE FUNCTION public.get_active_campaigns(p_limit integer DEFAULT 3, p_chars integer DEFAULT 16)
 RETURNS TABLE(campaign_id uuid, label text, headline text, blurb text, accent text, backdrop_url text, poster_url text, title_id text, hero_id text, hero_name text, hero_image_url text, hero_portrait_url text, hero_avatar_url text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
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
           h.avatar_url as hero_avatar_url,
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
         hero_id, hero_name, hero_image_url, hero_portrait_url, hero_avatar_url
  from resolved
  where rn <= p_chars
  order by priority desc, starts_at desc, rn;
$function$;
grant execute on function public.get_active_campaigns(integer, integer)
  to anon, authenticated, service_role;

-- jsonb payload, so this one only gains a key.
CREATE OR REPLACE FUNCTION public.get_debuts_this_month(p_limit integer DEFAULT 12, p_min_fame integer DEFAULT 30, p_max_chars integer DEFAULT 6)
 RETURNS TABLE(issue_id text, series_name text, issue_number text, cover_url text, debut_year integer, characters jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with debutants as (
    select
      h.first_issue_data->>'id' as issue_id,
      h.first_issue_data->>'seriesName' as series_name,
      h.first_issue_data->>'issueNumber' as issue_number,
      h.first_issue_data->>'imageUrl' as cover_url,
      extract(year from (h.first_issue_data->>'coverDate')::date)::integer as debut_year,
      h.id, h.name, h.image_url, h.portrait_url, h.avatar_url, h.fame_score,
      row_number() over (
        partition by h.first_issue_data->>'id'
        order by h.fame_score desc nulls last
      ) as crank
    from public.heroes h
    where h.first_issue_data->>'coverDate' ~ '^\d{4}-\d{2}-\d{2}'
      and extract(month from (h.first_issue_data->>'coverDate')::date)
          = extract(month from current_date)
      and coalesce(h.fame_score, 0) >= p_min_fame
      and (h.first_issue_data->>'imageUrl') is not null
      and (h.first_issue_data->>'id') is not null
  ),
  issues as (
    select
      issue_id,
      max(series_name) as series_name,
      max(issue_number) as issue_number,
      max(cover_url) as cover_url,
      max(debut_year) as debut_year,
      max(fame_score) as top_fame,
      jsonb_agg(
        jsonb_build_object(
          'id', id, 'name', name, 'image_url', image_url,
          'portrait_url', portrait_url, 'avatar_url', avatar_url
        )
        order by fame_score desc nulls last
      ) filter (where crank <= p_max_chars) as characters
    from debutants
    group by issue_id
  )
  select issue_id, series_name, issue_number, cover_url, debut_year, characters
  from issues
  order by top_fame desc nulls last
  limit p_limit;
$function$;;
