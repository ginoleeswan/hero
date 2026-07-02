-- Explore/Home bundle: the entire anonymous above-the-fold fan-out in ONE
-- round trip. The client previously issued ~15 parallel PostgREST requests on a
-- cold load, which intermittently exhausted the connection pool (synchronized
-- 500s, see 2026-07-02 incident). This RPC serialises them server-side instead.
--
-- Composition rules:
--  * Sections that already have an RPC (rivalries, browse covers, trending,
--    wiki, debuts, title buckets, campaigns, new comics) are CALLED, not
--    mirrored — one source of truth, no drift. WITH ORDINALITY preserves each
--    inner RPC's ranked order through jsonb_agg.
--  * Plain-table sections (spotlight pools, iconic, newly added) mirror the
--    former PostgREST queries from src/lib/db/heroes/feed.ts — keep in sync.
--  * hero_count uses the planner estimate (reltuples): an exact count over the
--    churned ~34k-row heroes table degrades to ~3s when the visibility map is
--    stale (same trap as power-percentile, see relationships.ts) and this is a
--    display-only figure.
--  * Client-side behaviour (spotlight sampling, distinct browse-cover picks,
--    title grouping) stays on the client — the RPC returns pools/flat rows in
--    the exact shapes the existing mappers already consume.
create or replace function public.get_explore_bundle(
  p_browse_slugs text[],
  p_browse_per_slug int default 40
)
returns jsonb
language sql
stable
set search_path = public
as $$
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
  -- derived from the first 24 of these client-side).
  'iconic', (
    select coalesce(jsonb_agg(to_jsonb(t) - 'ord' order by t.ord), '[]'::jsonb)
    from (
      select row_number() over () as ord,
             id, name, image_url, portrait_url, publisher, summary, full_name,
             alignment, first_appearance, intelligence, strength, speed,
             durability, power, combat
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
$$;

grant execute on function public.get_explore_bundle(text[], int) to anon, authenticated;
