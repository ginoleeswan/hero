-- Three new browse doorways on the origin axis — magic / aliens / mythology —
-- taking the Browse the Universe grid from 9 thematic tiles to 12 (9 stranded a
-- lone tile on the last row at every column count). Each resolves to an existing
-- hero_tags tag, so no new columns or backfill: magic → magic-user (206 chars),
-- aliens → alien (203), mythology → mythological (67).
--
-- Every place a category slug's predicate is mirrored has to learn them:
--   * get_browse_covers      — the tile art for the grid
--   * category_facet_counts  — the filter counts on /category/[slug]; that one
--     needed a rewrite for speed as well, so it lives in the next migration
--   * refresh_explore_bundle — the baked slug list MUST equal the client's
--     BROWSE_PODS array exactly (get_explore_bundle only serves the cache when
--     `slugs = p_browse_slugs`; a mismatch silently falls through to the live
--     compute, which blows the anon 3s statement_timeout).

create or replace function public.get_browse_covers(p_slugs text[], p_per_slug integer default 6)
returns table(slug text, pos integer, id text, name text, image_url text, image_md_url text, portrait_url text)
language sql
stable
set search_path to 'public'
as $function$
  select s.slug, c.pos, c.id, c.name, c.image_url, c.image_md_url, c.portrait_url
  from unnest(p_slugs) as s(slug)
  cross join lateral (
    select
      h.id, h.name, h.image_url, h.image_md_url, h.portrait_url,
      row_number() over (order by h.fame_score desc nulls last) as pos
    from heroes h
    where
      coalesce(h.portrait_url, h.image_md_url, h.image_url) is not null
      and case s.slug
        when 'popular' then h.category = 'popular'
        when 'villain' then h.alignment = 'bad' and (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain'))
        when 'xmen' then (h.group_affiliation ilike '%x-men%' or h.group_affiliation ilike '%xmen%')
        when 'anti-heroes' then h.alignment ilike '%neutral%'
        when 'marvel' then h.publisher ilike '%marvel%'
        when 'dc' then h.publisher ilike '%dc%'
        when 'image' then h.publisher ilike '%image%'
        when 'dark-horse' then h.publisher ilike '%dark horse%'
        when 'strongest' then h.strength is not null
        when 'most-intelligent' then h.intelligence is not null
        when 'most-iconic' then (h.publisher is null or h.publisher not in ('Non-Fictional','In the Public Domain','Company-Licensed'))
        when 'franchise-icons' then h.franchise is not null
        when 'anime' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'anime')
        when 'video-games' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'video-game')
        when 'horror' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'horror-icon')
        when 'magic' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'magic-user')
        when 'aliens' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'alien')
        when 'mythology' then exists (select 1 from hero_tags ht where ht.hero_id = h.id and ht.tag = 'mythological')
        else true
      end
    order by h.fame_score desc nulls last
    limit p_per_slug
  ) c
  order by s.slug, c.pos;
$function$;

create or replace function public.refresh_explore_bundle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- MIRRORS BROWSE_PODS in src/components/home/CategoryPodGrid.tsx — same
  -- members, same ORDER (the cache lookup is an array equality check).
  -- Publishers are no longer pods: they're the logo row above the grid.
  v_slugs text[] := array['villain','xmen','anti-heroes','franchise-icons',
                          'anime','video-games','horror','magic','aliens',
                          'mythology','strongest','most-intelligent'];
begin
  insert into explore_bundle_cache (id, slugs, per_slug, payload, refreshed_at)
  values (1, v_slugs, 40, compute_explore_bundle(v_slugs, 40), now())
  on conflict (id) do update
    set slugs = excluded.slugs,
        per_slug = excluded.per_slug,
        payload = excluded.payload,
        refreshed_at = excluded.refreshed_at;
end;
$$;

-- Repopulate immediately: until this runs, every Explore visitor misses the
-- cache (the stored slug array is the old publisher-bearing one) and pays the
-- live compute.
select public.refresh_explore_bundle();
