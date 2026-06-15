-- Franchise/pop-culture cohort metadata so the Explore page can surface the
-- ~90 recently-added characters from famous shows, movies, games and anime.
-- They arrived enriched (portraits, summaries, curated stats) but were invisible
-- on Explore: every row ranks by issue_count (where they're tiny), alignment was
-- null (so they never hit the Villains/Anti rows), and there was no recency
-- signal for "Recently Added". This migration fixes all three.

-- 1. Columns -----------------------------------------------------------------
alter table public.heroes add column if not exists franchise text;
-- Insert-order recency signal so "Recently Added" can sort by when a hero
-- entered the catalog rather than by issue_count.
alter table public.heroes add column if not exists added_at timestamptz not null default now();

create index if not exists heroes_franchise_idx
  on public.heroes (franchise) where franchise is not null;
create index if not exists heroes_added_at_idx
  on public.heroes (added_at desc);

-- 2. Media tag vocabulary (new 'media' category) -----------------------------
insert into public.hero_tag_vocab (slug, label, description, category) values
  ('anime',        'Anime & Manga', 'From a major anime or manga series.',            'media'),
  ('video-game',   'Video Game',    'Originates from a video-game franchise.',        'media'),
  ('horror-icon',  'Horror Icon',   'A slasher/horror-movie icon.',                   'media'),
  ('screen-icon',  'Screen Icon',   'Defined by a hit live-action film or TV series.','media'),
  ('toy-cartoon',  'Toys & Cartoons','From a classic toy line / Saturday-morning cartoon.','media')
on conflict (slug) do nothing;

-- 3. Backfill franchise ------------------------------------------------------
update public.heroes h set franchise = v.franchise
from (values
  ('cv-51106','The Boys'),('cv-40553','The Boys'),('cv-51100','The Boys'),('cv-51107','The Boys'),
  ('cv-51103','The Boys'),('cv-51105','The Boys'),('cv-40552','The Boys'),('cv-51109','The Boys'),
  ('cv-59641','The Boys'),('cv-40555','The Boys'),('cv-59640','The Boys'),
  ('cv-5210','Invincible'),('cv-40550','Invincible'),('cv-40947','Invincible'),('cv-42576','Invincible'),
  ('cv-41126','Invincible'),('cv-61561','Invincible'),('cv-72505','Invincible'),
  ('cv-114074','My Hero Academia'),('cv-119564','My Hero Academia'),('cv-119837','My Hero Academia'),
  ('cv-126533','Demon Slayer'),
  ('cv-47924','One Piece'),('cv-47925','One Piece'),
  ('cv-94030','Attack on Titan'),('cv-94029','Attack on Titan'),
  ('cv-49020','The Witcher'),
  ('cv-67170','God of War'),
  ('cv-55028','Star Wars'),('cv-162251','Star Wars'),('cv-165877','Star Wars'),
  ('cv-42443','The Walking Dead'),('cv-84617','The Walking Dead'),('cv-46819','The Walking Dead'),('cv-42540','The Walking Dead'),
  ('cv-39812','Teenage Mutant Ninja Turtles'),
  ('cv-44241','Naruto'),('cv-44260','Naruto'),('cv-44243','Naruto'),
  ('cv-40743','Dragon Ball'),('cv-40737','Dragon Ball'),('cv-41116','Dragon Ball'),('cv-87138','Dragon Ball'),
  ('cv-42468','Bleach'),
  ('cv-48703','Death Note'),
  ('cv-45359','Fullmetal Alchemist'),
  ('cv-68163','Hunter x Hunter'),('cv-68164','Hunter x Hunter'),
  ('cv-93547','One-Punch Man'),
  ('cv-120011','JoJo''s Bizarre Adventure'),('cv-102819','JoJo''s Bizarre Adventure'),
  ('cv-159532','Jujutsu Kaisen'),('cv-164910','Jujutsu Kaisen'),
  ('cv-175957','Spy x Family'),
  ('cv-164246','Vinland Saga'),
  ('cv-141927','That Time I Got Reincarnated as a Slime'),
  ('cv-45527','Berserk'),
  ('cv-55484','Super Mario'),
  ('cv-46231','The Legend of Zelda'),
  ('cv-45343','Sonic the Hedgehog'),
  ('cv-40491','Tomb Raider'),
  ('cv-45828','Metal Gear'),
  ('cv-52213','Pokémon'),('cv-52626','Pokémon'),
  ('cv-46651','Metroid'),
  ('cv-50037','Mega Man'),
  ('cv-42683','Street Fighter'),
  ('cv-42244','Mortal Kombat'),
  ('cv-33857','Crash Bandicoot'),
  ('cv-44471','Kingdom Hearts'),
  ('cv-13852','The Terminator'),
  ('cv-28671','RoboCop'),
  ('cv-61046','Alien'),
  ('cv-41460','A Nightmare on Elm Street'),
  ('cv-41459','Friday the 13th'),
  ('cv-46825','Halloween'),
  ('cv-51515','Child''s Play'),
  ('cv-160011','It'),
  ('cv-41465','Hellraiser'),
  ('cv-11171','The Sandman'),
  ('cv-24232','Lucifer'),
  ('cv-83012','Saga'),('cv-83011','Saga'),
  ('cv-18319','Witchblade'),
  ('cv-195090','The Darkness'),
  ('cv-46763','Tank Girl'),
  ('cv-6467','Transformers'),
  ('cv-16423','Masters of the Universe'),('cv-16424','Masters of the Universe'),
  ('cv-6452','G.I. Joe'),('cv-11034','G.I. Joe')
) as v(id, franchise)
where h.id = v.id;

-- 4. Backfill alignment (was null for the whole cohort) ----------------------
update public.heroes h set alignment = v.al
from (values
  ('cv-51106','bad'),('cv-40553','neutral'),('cv-51100','good'),('cv-51107','good'),('cv-51103','neutral'),
  ('cv-51105','neutral'),('cv-40552','good'),('cv-51109','bad'),('cv-59641','bad'),('cv-40555','good'),('cv-59640','bad'),
  ('cv-5210','good'),('cv-40550','neutral'),('cv-40947','good'),('cv-42576','neutral'),('cv-41126','neutral'),
  ('cv-61561','bad'),('cv-72505','bad'),
  ('cv-114074','good'),('cv-119564','good'),('cv-119837','good'),
  ('cv-126533','good'),
  ('cv-47924','good'),('cv-47925','good'),
  ('cv-94030','neutral'),('cv-94029','good'),
  ('cv-49020','neutral'),
  ('cv-67170','neutral'),
  ('cv-55028','good'),('cv-162251','good'),('cv-165877','good'),
  ('cv-42443','good'),('cv-84617','bad'),('cv-46819','good'),('cv-42540','good'),
  ('cv-39812','good'),
  ('cv-44241','neutral'),('cv-44260','neutral'),('cv-44243','good'),
  ('cv-40743','good'),('cv-40737','bad'),('cv-41116','bad'),('cv-87138','neutral'),
  ('cv-42468','good'),
  ('cv-48703','bad'),
  ('cv-45359','good'),
  ('cv-68163','good'),('cv-68164','good'),
  ('cv-93547','good'),
  ('cv-120011','good'),('cv-102819','bad'),
  ('cv-159532','good'),('cv-164910','good'),
  ('cv-175957','good'),
  ('cv-164246','neutral'),
  ('cv-141927','good'),
  ('cv-45527','neutral'),
  ('cv-55484','good'),('cv-46231','good'),('cv-45343','good'),('cv-40491','good'),('cv-45828','good'),
  ('cv-52213','good'),('cv-52626','neutral'),('cv-46651','good'),('cv-50037','good'),('cv-42683','good'),
  ('cv-42244','neutral'),('cv-33857','good'),('cv-44471','good'),
  ('cv-13852','neutral'),('cv-28671','good'),('cv-61046','bad'),('cv-41460','bad'),('cv-41459','bad'),
  ('cv-46825','bad'),('cv-51515','bad'),('cv-160011','bad'),('cv-41465','bad'),
  ('cv-11171','neutral'),('cv-24232','neutral'),
  ('cv-83012','good'),('cv-83011','good'),
  ('cv-18319','good'),('cv-195090','neutral'),('cv-46763','neutral'),
  ('cv-6467','good'),('cv-16423','good'),('cv-16424','bad'),('cv-6452','good'),('cv-11034','bad')
) as v(id, al)
where h.id = v.id and h.alignment is null;

-- 5. Recency: stamp the franchise cohort as the newest arrivals --------------
-- Existing catalog is baselined to a fixed past date. We deliberately do NOT key
-- off *_enriched_at: the enrichment pipeline keeps bumping those timestamps, which
-- would repeatedly push long-standing heroes above the cohort. Nothing writes
-- added_at after insert (new rows default to now()), so the cohort — and any
-- genuinely new inserts — stay at the top of "Recently Added".
update public.heroes set added_at = timestamptz '2026-01-01' where franchise is null;
update public.heroes set added_at = now() where franchise is not null;

-- 6. Backfill media tags -----------------------------------------------------
insert into public.hero_tags (hero_id, tag)
select id, 'anime' from unnest(array[
  'cv-114074','cv-119564','cv-119837','cv-126533','cv-47924','cv-47925','cv-94030','cv-94029',
  'cv-44241','cv-44260','cv-44243','cv-40743','cv-40737','cv-41116','cv-87138','cv-42468','cv-48703',
  'cv-45359','cv-68163','cv-68164','cv-93547','cv-120011','cv-102819','cv-159532','cv-164910',
  'cv-175957','cv-164246','cv-141927','cv-45527'
]) as id
on conflict do nothing;

insert into public.hero_tags (hero_id, tag)
select id, 'video-game' from unnest(array[
  'cv-49020','cv-67170','cv-55484','cv-46231','cv-45343','cv-40491','cv-45828','cv-52213','cv-52626',
  'cv-46651','cv-50037','cv-42683','cv-42244','cv-33857','cv-44471'
]) as id
on conflict do nothing;

insert into public.hero_tags (hero_id, tag)
select id, 'horror-icon' from unnest(array[
  'cv-61046','cv-41460','cv-41459','cv-46825','cv-51515','cv-160011','cv-41465'
]) as id
on conflict do nothing;

insert into public.hero_tags (hero_id, tag)
select id, 'screen-icon' from unnest(array[
  'cv-51106','cv-40553','cv-51100','cv-51107','cv-51103','cv-51105','cv-40552','cv-51109','cv-59641','cv-40555','cv-59640',
  'cv-42443','cv-84617','cv-46819','cv-42540','cv-55028','cv-162251','cv-165877',
  'cv-13852','cv-28671','cv-11171','cv-24232','cv-5210','cv-40550','cv-40947','cv-42576','cv-41126','cv-61561','cv-72505','cv-46763'
]) as id
on conflict do nothing;

insert into public.hero_tags (hero_id, tag)
select id, 'toy-cartoon' from unnest(array[
  'cv-6467','cv-16423','cv-16424','cv-6452','cv-11034','cv-39812'
]) as id
on conflict do nothing;
