-- Generated total of the six powerstats. 0 when a hero has no stats, so
-- `powerstats_total > 0` is the "has powerstats" predicate. Also fixes
-- getHeroesByPowerRange(), which already references this column.
ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS powerstats_total integer
  GENERATED ALWAYS AS (
    COALESCE(intelligence, 0) + COALESCE(strength, 0) + COALESCE(speed, 0) +
    COALESCE(durability, 0) + COALESCE(power, 0) + COALESCE(combat, 0)
  ) STORED;

CREATE INDEX IF NOT EXISTS heroes_powerstats_total_idx ON heroes (powerstats_total);

-- Faceted-search counts for a category page. Each facet's option counts are
-- computed with the OTHER active filters applied but NOT the facet's own
-- selection, so a count reflects what choosing that option would actually yield.
CREATE OR REPLACE FUNCTION category_facet_counts(
  p_slug text,
  p_publisher text DEFAULT 'all',
  p_alignment text DEFAULT 'any',
  p_gender text DEFAULT 'any',
  p_has_stats boolean DEFAULT false,
  p_search text DEFAULT ''
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH base AS (
  SELECT * FROM heroes h
  WHERE
    CASE p_slug
      WHEN 'popular' THEN h.category = 'popular'
      WHEN 'villain' THEN h.alignment = 'bad' AND (h.publisher IS NULL OR h.publisher NOT IN ('Non-Fictional','In the Public Domain'))
      WHEN 'xmen' THEN (h.group_affiliation ILIKE '%x-men%' OR h.group_affiliation ILIKE '%xmen%')
      WHEN 'anti-heroes' THEN h.alignment ILIKE '%neutral%'
      WHEN 'marvel' THEN h.publisher ILIKE '%marvel%'
      WHEN 'dc' THEN h.publisher ILIKE '%dc%'
      WHEN 'strongest' THEN h.strength IS NOT NULL
      WHEN 'most-intelligent' THEN h.intelligence IS NOT NULL
      WHEN 'most-iconic' THEN (h.publisher IS NULL OR h.publisher NOT IN ('Non-Fictional','In the Public Domain','Company-Licensed'))
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
$$;

GRANT EXECUTE ON FUNCTION category_facet_counts(text, text, text, text, boolean, text) TO anon, authenticated;
