-- Adds a precomputed BlurHash for each hero portrait, used as an instant
-- low-quality placeholder (expo-image `placeholder={{ blurhash }}`) so cards,
-- banners and detail art show a blurred preview immediately instead of a blank
-- box that pops when the full image arrives.
--
-- Nullable on purpose: an absent hash just means "no placeholder" (graceful),
-- so the column can be backfilled progressively (top fame_score first) by the
-- enrich-blurhash-batch edge function without blocking reads.

alter table public.heroes
  add column if not exists portrait_blurhash text;

comment on column public.heroes.portrait_blurhash is
  'BlurHash string for the hero portrait, used as an instant LQIP placeholder. Backfilled by enrich-blurhash-batch, prioritised by fame_score.';
