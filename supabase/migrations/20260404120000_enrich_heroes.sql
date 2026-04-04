-- supabase/migrations/20260404120000_enrich_heroes.sql
alter table heroes
  -- images (image_url stays as the large/detail image)
  add column if not exists image_md_url        text,

  -- powerstats (nullable integer — CDN returns null for unknowns)
  add column if not exists intelligence        integer,
  add column if not exists strength            integer,
  add column if not exists speed               integer,
  add column if not exists durability          integer,
  add column if not exists power               integer,
  add column if not exists combat              integer,

  -- biography
  add column if not exists full_name           text,
  add column if not exists alter_egos          text,
  add column if not exists aliases             text[],
  add column if not exists place_of_birth      text,
  add column if not exists first_appearance    text,
  add column if not exists alignment           text,

  -- appearance
  add column if not exists gender              text,
  add column if not exists race                text,
  add column if not exists height_imperial     text,
  add column if not exists height_metric       text,
  add column if not exists weight_imperial     text,
  add column if not exists weight_metric       text,
  add column if not exists eye_color           text,
  add column if not exists hair_color          text,

  -- work
  add column if not exists occupation          text,
  add column if not exists base                text,

  -- connections
  add column if not exists group_affiliation   text,
  add column if not exists relatives           text,

  -- comicvine (phase 2 — null until enriched)
  add column if not exists summary                  text,
  add column if not exists first_issue_image_url    text,
  add column if not exists comicvine_enriched_at    timestamptz,

  -- enrichment tracking
  add column if not exists enriched_at         timestamptz;
