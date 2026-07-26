-- category_facet_counts was 500ing for anon on the tag-backed category pages
-- (magic/aliens/mythology, and intermittently anime/video-games/horror).
--
-- Two causes, both fixed here:
--  1. `select *` into the base CTE dragged every fat column (description HTML,
--     first_issue_data jsonb, powers arrays) out of TOAST for each matched row,
--     and the flagged CTE is scanned five times, once per aggregate. Only six
--     columns are ever read — project just those.
--  2. The tag slugs expressed their predicate as a correlated
--     `exists (select 1 from hero_tags …)` inside the CASE. Called with a
--     literal, the planner folds the CASE and makes it a semi-join (~80ms), but
--     PostgREST binds p_slug as a parameter — generic plan, no folding — so it
--     degraded to a seq scan of all 50k heroes (109MB heap) with a per-row
--     subplan. Warm ~1s, cold past the anon 3s statement_timeout.
--
-- Splitting the row source into its own function makes the tag path an explicit
-- join driven off hero_tags_tag_idx under ANY plan, while the aggregate query
-- below stays single-sourced. Measured anon round-trip after: magic 0.97s,
-- aliens 0.58s, mythology 0.44s, anime 0.36s (all were 1.2s–timeout before).
--
-- NOT fixed here: villain / strongest / most-iconic still scan the whole heroes
-- heap and still time out for anon on a cold cache — pre-existing, and a
-- covering index is the honest fix.

create or replace function public.category_base_rows(p_slug text, p_search text default ''::text)
returns table(publisher text, alignment text, gender text, powerstats_total integer)
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_tag text := case p_slug
    when 'anime' then 'anime'
    when 'video-games' then 'video-game'
    when 'horror' then 'horror-icon'
    when 'magic' then 'magic-user'
    when 'aliens' then 'alien'
    when 'mythology' then 'mythological'
  end;
begin
  if v_tag is not null then
    return query
      select h.publisher, h.alignment, h.gender, h.powerstats_total
      from hero_tags ht
      join heroes h on h.id = ht.hero_id
      where ht.tag = v_tag
        and (p_search = '' or h.name ilike '%' || p_search || '%' or h.full_name ilike '%' || p_search || '%');
  else
    return query
      select h.publisher, h.alignment, h.gender, h.powerstats_total
      from heroes h
      where
        case p_slug
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
          else true
        end
        and (p_search = '' or h.name ilike '%' || p_search || '%' or h.full_name ilike '%' || p_search || '%');
  end if;
end;
$function$;

-- category_facet_counts is a plain (invoker-rights) function, so its caller
-- needs execute on the helper too. Same exposure as the wrapper: read-only
-- counts over publicly readable hero columns.
revoke execute on function public.category_base_rows(text, text) from public;
grant execute on function public.category_base_rows(text, text) to anon, authenticated;

create or replace function public.category_facet_counts(
  p_slug text,
  p_publisher text default 'all'::text,
  p_alignment text default 'any'::text,
  p_gender text default 'any'::text,
  p_has_stats boolean default false,
  p_search text default ''::text
)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
WITH base AS (
  SELECT * FROM category_base_rows(p_slug, p_search)
),
flagged AS (
  SELECT *,
    (p_publisher = 'all'
      OR (p_publisher = 'marvel' AND publisher ILIKE '%marvel%')
      OR (p_publisher = 'dc' AND publisher ILIKE '%dc%')
      OR (p_publisher = 'other' AND publisher IS NOT NULL AND publisher NOT ILIKE '%marvel%' AND publisher NOT ILIKE '%dc%')
    ) AS pub_ok,
    (p_alignment = 'any'
      OR (p_alignment = 'good' AND alignment = 'good')
      OR (p_alignment = 'bad' AND alignment = 'bad')
      OR (p_alignment = 'neutral' AND alignment ILIKE '%neutral%')
    ) AS align_ok,
    (p_gender = 'any'
      OR (p_gender = 'male' AND gender ILIKE 'male')
      OR (p_gender = 'female' AND gender ILIKE 'female')
    ) AS gender_ok,
    (NOT p_has_stats OR powerstats_total > 0) AS stats_ok
  FROM base
)
SELECT jsonb_build_object(
  'total', (SELECT count(*) FROM flagged WHERE pub_ok AND align_ok AND gender_ok AND stats_ok),
  'publisher', (SELECT jsonb_build_object(
      'all', count(*),
      'marvel', count(*) FILTER (WHERE publisher ILIKE '%marvel%'),
      'dc', count(*) FILTER (WHERE publisher ILIKE '%dc%'),
      'other', count(*) FILTER (WHERE publisher IS NOT NULL AND publisher NOT ILIKE '%marvel%' AND publisher NOT ILIKE '%dc%')
    ) FROM flagged WHERE align_ok AND gender_ok AND stats_ok),
  'alignment', (SELECT jsonb_build_object(
      'good', count(*) FILTER (WHERE alignment = 'good'),
      'bad', count(*) FILTER (WHERE alignment = 'bad'),
      'neutral', count(*) FILTER (WHERE alignment ILIKE '%neutral%')
    ) FROM flagged WHERE pub_ok AND gender_ok AND stats_ok),
  'gender', (SELECT jsonb_build_object(
      'male', count(*) FILTER (WHERE gender ILIKE 'male'),
      'female', count(*) FILTER (WHERE gender ILIKE 'female')
    ) FROM flagged WHERE pub_ok AND align_ok AND stats_ok),
  'has_stats', (SELECT count(*) FILTER (WHERE powerstats_total > 0) FROM flagged WHERE pub_ok AND align_ok AND gender_ok)
);
$function$;
