-- More titles in the Explore "On Screen Now" rail, at a flat payload cost.
--
-- The rail was capped at 6 titles per bucket (18 max, 11 unique in practice)
-- while each title dragged 12 character rows along with it. Nothing renders
-- those characters: both RightNowBand variants read `.characters` only off
-- `campaign`, never off a trending title. So the bundle was spending its rows on
-- data no pixel uses.
--
-- Trading them the other way — 12 titles per bucket, 3 characters each — roughly
-- doubles the titles for about the same number of rows. A few characters are
-- kept rather than none so a future consumer isn't blocked, and because the
-- `chars` CTE is an inner join: the count filters rows per title, it never drops
-- a title (the title window already requires a character to exist).
--
-- Only the `title_buckets` block differs from the previous definition.
create or replace function public.compute_explore_bundle(
  p_browse_slugs text[],
  p_browse_per_slug integer default 40
)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
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

  -- CHANGED: 6 titles x 12 characters -> 12 titles x 3 characters.
  'title_buckets', (
    select coalesce(jsonb_agg(to_jsonb(r) - 'ordinality' order by r.ordinality), '[]'::jsonb)
    from get_trending_titles_multi(
      p_buckets => array['on_screen','coming_soon','streaming'],
      p_title_limit => 12,
      p_chars_per_title => 3
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
$function$;
