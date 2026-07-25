-- The generation queue is "famous heroes that still need an avatar", i.e. an
-- IS NULL scan ordered by fame_score. heroes_avatar_url_idx is the read-path
-- index (IS NOT NULL) and cannot serve it, so the batch query timed out against
-- the ~50k-row table. Mirrors heroes_portrait_pending_idx, which solves exactly
-- this problem for the portrait pipeline.
create index if not exists heroes_avatar_pending_idx
  on public.heroes (fame_score desc nulls last)
  where avatar_url is null and image_url is not null;
