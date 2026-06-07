-- ComicVine's API exposes no multi-image character gallery (only issue covers,
-- which "In Print" already uses), so the Character Art section was dropped.
-- Remove its now-unused column.
alter table heroes
  drop column if exists gallery_images;
