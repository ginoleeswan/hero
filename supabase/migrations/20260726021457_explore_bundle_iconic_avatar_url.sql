-- Carry avatar_url through the explore bundle, for the Hall of Fame rows.
--
-- Those are 50px (native) / 56px (web) circles cropped out of a portrait, and
-- the pool is the top 25 by fame_score — which is exactly the tier that has
-- 100% avatar coverage, so every row gains a real head.
--
-- Only the 'iconic' select changes here. The bundle's other hero sections
-- delegate to get_trending_heroes_wiki / get_debuts_this_month /
-- get_active_campaigns / get_trending_titles_multi, which already return it,
-- so they pick it up for free. The two spotlight pools are deliberately left
-- alone: they feed large portrait cards where the painted art is the content.
--
-- get_trending_titles_multi is updated alongside because the bundle calls the
-- MULTI variant, not the single-bucket get_trending_titles that was done with
-- the other trending RPCs.

drop function if exists public.get_trending_titles_multi(text[], integer, integer);
CREATE OR REPLACE FUNCTION public.get_trending_titles_multi(p_buckets text[], p_title_limit integer DEFAULT 6, p_chars_per_title integer DEFAULT 12)
 RETURNS TABLE(bucket text, title_id text, title text, media_type text, release_date date, backdrop_url text, poster_url text, provider text, overview text, hero_id text, hero_name text, hero_image_url text, hero_portrait_url text, hero_avatar_url text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with ranked as (
    select * from (
      select b.bucket,
        t.id, t.title, t.media_type, t.release_date, t.backdrop_url, t.poster_url,
        (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider,
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
           r.backdrop_url, r.poster_url, r.provider, r.overview, r.trank,
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
         provider, overview, hero_id, hero_name, hero_image_url, hero_portrait_url,
         hero_avatar_url
  from chars
  where crank <= p_chars_per_title
  order by bucket, trank, crank;
$function$;
grant execute on function public.get_trending_titles_multi(text[], integer, integer)
  to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.compute_explore_bundle(p_browse_slugs text[], p_browse_per_slug integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
select jsonb_build_object(

  -- Spotlight famous pool (mirrors getSpotlightHeroes famousQuery).
  'spotlight_famous', (
    select coalesce(jsonb_agg(to_jsonb(t) - 'ord' order by t.ord), '[]'::jsonb)
    from (
      select row_number() over () as ord,
             id, name, image_url, portrait_url, publisher, summary, full_name,
             alignment, first_appearance, intelligence, strength, speed,
             durability, power, combat
      from heroes
      where portrait_url is not null
        and summary is not null
        and movie_count >= 2
        and powerstats_total >= 200
        and publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed')
      order by movie_count desc nulls last, fame_score desc nulls last
      limit 20
    ) t
  ),

  -- Spotlight discovery pool (mirrors getSpotlightHeroes discoveryQuery).
  'spotlight_discovery', (
    select coalesce(jsonb_agg(to_jsonb(t) - 'ord' order by t.ord), '[]'::jsonb)
    from (
      select row_number() over () as ord,
             id, name, image_url, portrait_url, publisher, summary, full_name,
             alignment, first_appearance, intelligence, strength, speed,
             durability, power, combat
      from heroes
      where portrait_url is not null
        and summary is not null
        and (movie_count is null or movie_count < 2)
        and issue_count >= 200
        and powerstats_total >= 200
        and publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed')
      order by issue_count desc nulls last
      limit 50
    ) t
  ),

  -- On-screen-now heroes that satisfy the spotlight gates (mirrors
  -- getTrendingSpotlightHeroes), in trending-rank order.
  'trending_spotlight', (
    select coalesce(jsonb_agg(to_jsonb(t) - 'ord' order by t.ord), '[]'::jsonb)
    from (
      select tr.ordinality as ord,
             h.id, h.name, h.image_url, h.portrait_url, h.publisher, h.summary,
             h.full_name, h.alignment, h.first_appearance, h.intelligence,
             h.strength, h.speed, h.durability, h.power, h.combat
      from get_trending_heroes('on_screen', 40) with ordinality as tr
      join heroes h on h.id = tr.id
      where h.portrait_url is not null
        and h.summary is not null
        and h.powerstats_total >= 200
      order by tr.ordinality
      limit 2
    ) t
  ),

  -- Hall of Fame pool (mirrors getIconicHeroes; the daily matchup pair is also
  -- derived from the first 24 of these client-side). avatar_url rides along so
  -- the ranked rows can show a head rather than a portrait cropped to a circle.
  'iconic', (
    select coalesce(jsonb_agg(to_jsonb(t) - 'ord' order by t.ord), '[]'::jsonb)
    from (
      select row_number() over () as ord,
             id, name, image_url, portrait_url, avatar_url, publisher, summary,
             full_name, alignment, first_appearance, intelligence, strength,
             speed, durability, power, combat
      from heroes
      where publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed')
      order by fame_score desc nulls last
      limit 25
    ) t
  ),

  -- Fresh arrivals (mirrors getNewlyAddedCV).
  'newly_added', (
    select coalesce(jsonb_agg(to_jsonb(t) - 'ord' order by t.ord), '[]'::jsonb)
    from (
      select row_number() over () as ord,
             id, name, image_url, portrait_url
      from heroes
      where id like 'cv-%'
        and publisher not in ('Non-Fictional','In the Public Domain')
      order by added_at desc
      limit 25
    ) t
  ),

  'rivalries', (
    select coalesce(jsonb_agg(to_jsonb(r) - 'ordinality' order by r.ordinality), '[]'::jsonb)
    from get_top_rivalries(12) with ordinality as r
  ),

  'browse_covers', (
    select coalesce(jsonb_agg(to_jsonb(r) - 'ordinality' order by r.ordinality), '[]'::jsonb)
    from get_browse_covers(p_browse_slugs, p_browse_per_slug) with ordinality as r
  ),

  'trending_on_screen', (
    select coalesce(jsonb_agg(to_jsonb(r) - 'ordinality' order by r.ordinality), '[]'::jsonb)
    from get_trending_on_screen(p_limit => 12) with ordinality as r
  ),

  'wiki_trending', (
    select coalesce(jsonb_agg(to_jsonb(r) - 'ordinality' order by r.ordinality), '[]'::jsonb)
    from get_trending_heroes_wiki(p_limit => 14) with ordinality as r
  ),

  'debuts', (
    select coalesce(jsonb_agg(to_jsonb(r) - 'ordinality' order by r.ordinality), '[]'::jsonb)
    from get_debuts_this_month(p_limit => 14) with ordinality as r
  ),

  'title_buckets', (
    select coalesce(jsonb_agg(to_jsonb(r) - 'ordinality' order by r.ordinality), '[]'::jsonb)
    from get_trending_titles_multi(
      p_buckets => array['on_screen','coming_soon','streaming'],
      p_title_limit => 6,
      p_chars_per_title => 12
    ) with ordinality as r
  ),

  'campaigns', (
    select coalesce(jsonb_agg(to_jsonb(r) - 'ordinality' order by r.ordinality), '[]'::jsonb)
    from get_active_campaigns(p_limit => 3, p_chars => 16) with ordinality as r
  ),

  'new_comics', (
    select coalesce(jsonb_agg(to_jsonb(r) - 'ordinality' order by r.ordinality), '[]'::jsonb)
    from get_new_comics(p_limit => 12) with ordinality as r
  ),

  'hero_count', (
    select greatest(reltuples::bigint, 0)
    from pg_class
    where oid = 'public.heroes'::regclass
  )
);
$function$;;
