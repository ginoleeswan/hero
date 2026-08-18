
CREATE OR REPLACE FUNCTION cache_hero_comicvine_data(
  p_id text,
  p_summary text,
  p_powers text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE heroes
  SET
    summary = p_summary,
    powers = p_powers,
    comicvine_enriched_at = NOW()
  WHERE id = p_id
    AND comicvine_enriched_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION cache_hero_comicvine_data(text, text, text[]) TO authenticated, anon;
;
