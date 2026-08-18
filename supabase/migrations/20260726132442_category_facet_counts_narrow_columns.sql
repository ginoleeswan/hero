-- category_facet_counts read `select *` from heroes into its base CTE, so every
-- matched row dragged the fat columns (description HTML, first_issue_data jsonb,
-- powers arrays) out of TOAST — and the flagged CTE is then scanned five times,
-- once per aggregate. Cheap for a 29-row category like anime (430ms), but
-- 'aliens' (203 rows) took 5.5s warm, past the anon 3s statement_timeout → the
-- page's filter counts 500'd. Project only the six columns the function actually
-- reads; the predicates are unchanged.
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
  SELECT h.publisher, h.alignment, h.gender, h.powerstats_total
  FROM heroes h
  WHERE
    CASE p_slug
      WHEN 'popular' THEN h.category = 'popular'
      WHEN 'villain' THEN h.alignment = 'bad' AND (h.publisher IS NULL OR h.publisher NOT IN ('Non-Fictional','In the Public Domain'))
      WHEN 'xmen' THEN (h.group_affiliation ILIKE '%x-men%' OR h.group_affiliation ILIKE '%xmen%')
      WHEN 'anti-heroes' THEN h.alignment ILIKE '%neutral%'
      WHEN 'marvel' THEN h.publisher ILIKE '%marvel%'
      WHEN 'dc' THEN h.publisher ILIKE '%dc%'
      WHEN 'image' THEN h.publisher ILIKE '%image%'
      WHEN 'dark-horse' THEN h.publisher ILIKE '%dark horse%'
      WHEN 'strongest' THEN h.strength IS NOT NULL
      WHEN 'most-intelligent' THEN h.intelligence IS NOT NULL
      WHEN 'most-iconic' THEN (h.publisher IS NULL OR h.publisher NOT IN ('Non-Fictional','In the Public Domain','Company-Licensed'))
      WHEN 'franchise-icons' THEN h.franchise IS NOT NULL
      WHEN 'anime' THEN EXISTS (SELECT 1 FROM hero_tags ht WHERE ht.hero_id = h.id AND ht.tag = 'anime')
      WHEN 'video-games' THEN EXISTS (SELECT 1 FROM hero_tags ht WHERE ht.hero_id = h.id AND ht.tag = 'video-game')
      WHEN 'horror' THEN EXISTS (SELECT 1 FROM hero_tags ht WHERE ht.hero_id = h.id AND ht.tag = 'horror-icon')
      WHEN 'magic' THEN EXISTS (SELECT 1 FROM hero_tags ht WHERE ht.hero_id = h.id AND ht.tag = 'magic-user')
      WHEN 'aliens' THEN EXISTS (SELECT 1 FROM hero_tags ht WHERE ht.hero_id = h.id AND ht.tag = 'alien')
      WHEN 'mythology' THEN EXISTS (SELECT 1 FROM hero_tags ht WHERE ht.hero_id = h.id AND ht.tag = 'mythological')
      ELSE true
    END
    AND (p_search = '' OR h.name ILIKE '%' || p_search || '%' OR h.full_name ILIKE '%' || p_search || '%')
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
$function$;;
