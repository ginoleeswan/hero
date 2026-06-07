alter table heroes
  add column if not exists gallery_images jsonb,
  add column if not exists issue_covers   jsonb;
