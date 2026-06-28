-- Re-trigger the gallery enrich for existing ComicVine heroes so they pick up the
-- new comicvine_primary lead image (and higher-res covers) from the rewritten
-- get-hero-gallery edge function.
--
-- The first-pass backfill (20260628120000_hero_images.sql) only seeded
-- comicvine_cover rows from heroes.issue_covers and left gallery_enriched_at
-- untouched, so already-enriched heroes would never re-run the edge fn and would
-- miss the primary lead image. This migration ONLY nulls the run-once sentinel —
-- it deletes no rows and changes no other column. On each hero's next view the
-- hook re-runs the edge fn, which replaces that hero's covers in place (scoped
-- delete-then-insert) so nothing duplicates. Throttled heroes simply retry on a
-- later view (the edge fn skips the sentinel on a ComicVine 420).
update public.heroes
set gallery_enriched_at = null
where comicvine_id is not null
  and gallery_enriched_at is not null;
