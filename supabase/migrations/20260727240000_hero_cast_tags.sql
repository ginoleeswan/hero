-- Encode "whose cast is this character in", because the graph does not know.
--
-- Measured 2026-07-27 against 200 hand-authored blurb decisions (base rate 46%
-- written): no signal in hero_relationships separates a pair worth writing about
-- from one that is not.
--
--   mutual edge (both name each other)   48% precision
--   shared team                          47%
--   rank <= 10 in each other's list      48%
--   shared film or show                  47%
--
-- All noise. (Same debut series hit 90% but covered only 20 of 200 pairs.)
--
-- What DOES separate them is visible in the decline notes: ~70 of 108 declines
-- say one thing — the two characters belong to different casts. "crossover
-- adjacency only" (42), "Gotham adjacency" (8), "League adjacency" (6),
-- "Green Goblin belongs to Spider-Man" (3). Iron Man and Doctor Octopus share a
-- publisher, a dozen crossover events, and nothing else.
--
-- Cast membership is not derivable from the catalogue, so it is curated here.
-- 391 characters generate every pair in the authoring queue, which makes this
-- tractable in one pass. Multi-tag on purpose: Spider-Man is his own cast AND an
-- Avenger, Cyborg is Justice League AND Teen Titans, and a pair sharing ANY tag
-- is a pair worth considering.

create table if not exists public.hero_cast_tags (
  hero_id text not null references public.heroes(id) on delete cascade,
  cast_tag text not null,
  primary key (hero_id, cast_tag)
);

create index if not exists hero_cast_tags_tag_idx on public.hero_cast_tags (cast_tag);

alter table public.hero_cast_tags enable row level security;
drop policy if exists "hero_cast_tags are public" on public.hero_cast_tags;
create policy "hero_cast_tags are public" on public.hero_cast_tags for select using (true);

-- Publishers that ARE a single cast: tag them from the publisher directly rather
-- than restating 85 ids. Star Wars included — Vader, Luke and Han are one saga.
insert into public.hero_cast_tags (hero_id, cast_tag)
select h.id, lower(regexp_replace(h.publisher, '[^a-zA-Z0-9]+', '-', 'g'))
from public.heroes h
where h.publisher in (
  'Star Wars','The Muppets','Sesame Street','Pokémon','Nintendo','Looney Tunes',
  'Bongo','Hasbro','Dupuis','Image','Archie Comics','Hanna-Barbera','Sega',
  'Game of Thrones','The Terminator','Creator-Owned','Harvey Comics','Kodansha',
  'Mattel','Avatar: The Last Airbender','NetherRealm Studios',
  'Teenage Mutant Ninja Turtles'
)
on conflict do nothing;

-- Everything else is a publisher holding several unrelated casts.
insert into public.hero_cast_tags (hero_id, cast_tag)
select unnest(ids), tag from (values
  ('avengers', array['149','346','659','332','cv-3200','313','30','708','697','579','536','703','cv-1451','714','cv-21561','156','cv-3202','589','106','226','680','379','cv-4324','cv-94118','cv-2262','550']),
  ('spider-man', array['620','225','299','687','162','h_06811cbb-ee4b-47b2-9e26-4e62ba71b45d','cv-1480','cv-1780','cv-3114','cv-1487','cv-2478','395','cv-4333','cv-3228','cv-3544','cv-4459','412','472','391']),
  ('x-men', array['527','423','717','638','cv-3552','196','75','339','185','490','567','274','cv-3548','241','480','cv-4563','374','35','145','cv-3560','cv-7910','cv-3179','213','536','579']),
  ('guardians-of-the-galaxy', array['630','275','234','566','h_39f78998-cf7e-411c-a5a9-810f483a3675','h_a6e0f730-8cdf-4c40-9763-f48947ddac64','cv-3324','705','655']),
  ('fantastic-four', array['cv-2151','344','333','658','222','598','273','481','709']),
  ('asgard', array['659','cv-4324','cv-3507','321','cv-2636']),
  ('marvel-street-level', array['201','530','361','416','345','238','cv-4647','391','470','112','587','cv-14719']),
  ('wakanda', array['106','h_170c1b60-7de7-4e69-a273-ad2b4c4d2381']),
  ('marvel-cosmic', array['655','379','273','598','705','321','709']),
  ('justice-league', array['69','644','720','38','h_2ace1789-18f4-43bb-8f5f-030acaed0471','306','432','194','298','97','730','h_2c675c1e-8f8a-4f0f-b370-95d28f5d4e72','h_efed1d20-5b5c-412e-9f76-860af06b75dd','cv-4916','204','cv-4684','cv-6578']),
  ('bat-family', array['69','17','cv-1691','63','549','cv-1690','cv-3727','h_15a572bc-4624-4fe9-9dff-1eff9a94781b','h_ecba928f-1888-4f64-8330-c727dbf19c65']),
  ('gotham-rogues', array['370','309','165','cv-4885','cv-3718','678','cv-6129','522','cv-3726','cv-3725','cv-3715','538','h_c641fc32-86de-4e33-a5e9-0a7daa34d10f','214','cv-3588']),
  ('metropolis', array['644','cv-1808','405','643','cv-1686','278','cv-4684','h_89ff9c2c-5768-483b-be41-e723ef0df460','396','h_29b3ee3b-690f-47ee-b7c3-9e5bc7603536','642']),
  ('teen-titans', array['cv-3586','cv-3584','632','194','cv-1691','cv-23879','cv-1686','cv-1680','549','cv-3588','cv-4438']),
  ('flash-family', array['h_2ace1789-18f4-43bb-8f5f-030acaed0471','152','h_646a17a4-6bd9-44ac-a33c-4094379e00b2','cv-23879','cv-1680','294']),
  ('green-lantern-corps', array['306','h_2c675c1e-8f8a-4f0f-b370-95d28f5d4e72','601']),
  ('atlantis', array['38','105']),
  ('themyscira', array['720','h_ce7c539e-ed41-476f-a4be-4a997f6bf935']),
  ('dc-vertigo', array['645','cv-3329','cv-24232','cv-11171']),
  ('watchmen', array['569','h_68581899-1c25-443f-b492-336fd63e6aa9']),
  ('shazam', array['cv-2350','cv-4916']),
  ('suicide-squad', array['309','214','cv-14371','cv-6129','cv-3725']),
  ('predator', array['526']),
  ('disney-classic-shorts', array['h_9a0e3d34-dbda-4b55-9944-e7b6bfbcd280','h_42f7e0df-0aba-42b6-861f-09bec419704c','h_e3dbea9a-11ee-4415-b75c-4812d2865ab1','cv-2936','h_751c55e3-38a8-4ff1-86fd-3707a081791e','h_d6b4f285-b5f4-4ac7-b2c2-e488b3223da7','h_7afb07e3-a2ef-4320-8ebf-1573604e3ed7','h_198d4a99-3e75-4e73-8441-e6f0ca2d728a','h_5ec656ab-1b7e-4f7b-8ca6-a6fea8bf520c','h_2e379808-30f5-441c-ad8f-f9461c15ab9a','h_3cc5ec6f-330e-4032-b641-7e082d23f83b','cv-4586','h_554ad3d0-6bd0-4fae-98b2-6f12c147bda4','h_b700f6aa-d2fe-477d-b987-67afce3346bc']),
  ('pirates-of-the-caribbean', array['h_568d2a22-ba40-453a-a725-ddca7b60309a','h_44ec8567-6f80-4bff-b3ee-89e38285fe55']),
  ('toy-story', array['h_f6db7814-5492-404e-bfa7-603a3b88fd71','h_348f88c9-4842-4ed9-be81-72d070073745']),
  ('the-lion-king', array['h_6112908e-ba19-4fa4-9339-14a173f123da','h_c2f87fc9-bc89-465a-b8c4-d411c158aaf7','h_583de1b8-a197-4c95-af9c-bbd08564b606','h_53d2b41b-b932-4102-84fb-56bc08e5d877']),
  ('disney-princess', array['h_bdee6707-ae2d-44ec-bb7b-7184ff624e06','h_547f58bc-0545-41ce-b64b-fff672fd5d43','h_84c98c45-27c7-4c8a-96b8-3db25569212b']),
  ('disney-villains', array['h_c0bcc5a8-f0ec-43c7-90dc-a03e443712d5','h_74c34420-461e-4f2c-8a0d-12e4a533e324']),
  ('lilo-and-stitch', array['h_966cee59-cdc6-4cc3-ad92-e65faa72c019','h_b7599e15-f5c7-466b-842d-1b9e1bcbd8a2']),
  ('roger-rabbit', array['h_9a26173e-0e33-4d89-923e-94766ce06f09','h_dcfc3772-89bf-4b11-9da2-a96f7a575d5c']),
  ('kim-possible', array['h_d1b23558-fe01-4a5e-b3de-51305a20fa9b']),
  ('dragon-ball', array['289','cv-40722','cv-40729','cv-45683','cv-40743','cv-53244','cv-40737','cv-40727']),
  ('naruto', array['485','cv-44241','cv-44243']),
  ('one-piece', array['cv-47924','cv-47925','cv-49784','cv-47926','cv-51969']),
  ('jujutsu-kaisen', array['cv-164910','cv-159532']),
  ('greek-myth', array['h_fe4d8b42-81a9-4438-89a0-a7b51ed195ec','h_09ea65ab-25c6-4bde-95c9-787e866d974b','h_87df3443-d033-4a58-9876-9a768da6a734','cv-3075','h_6c92a438-aa7c-49ce-be69-8dcc4e06d7c0','h_63c17e21-0a31-4b99-b4cc-8462c0ae8743','cv-2747']),
  ('peter-pan', array['h_7906ea98-fdb9-4e3f-9fca-1f905fe003c5','h_58c98d94-8f76-48a2-9adb-9ee7de1c41aa']),
  ('winnie-the-pooh', array['h_826e26f5-69df-44bd-8711-a3fc9a529a21','h_4b758656-b465-4ec2-89ff-f01eb2130f50']),
  ('arthurian', array['h_17ba56f7-0061-4121-b280-f01d36580cee']),
  ('father-christmas', array['h_2363f39d-2303-4f6d-a06e-f56dc0c41d28']),
  ('egyptian-myth', array['h_6b5aa01b-d739-442c-9f17-a33293de162d','506']),
  ('robin-hood', array['h_63d38c65-810e-41a6-bb54-04cc390e23de']),
  ('biblical', array['h_978f0427-2a15-4b81-9db3-ce8e9afc78cd']),
  ('star-trek', array['h_eeb32edc-4a36-40b2-a5f5-5bf609e4ab7d','h_e1c20cec-8ac7-4487-bba6-6ca79a2b00e1','h_25112312-b932-416a-8ebc-9aeeb3a76ca9','h_0f66e7fb-8c21-4cdf-81bb-4f2b8e2cf441','h_bf30036e-8bdc-4dcf-9b6f-d66445358cf2','353','627','357','380']),
  ('teenage-mutant-ninja-turtles', array['404','541','228','450']),
  ('street-fighter', array['cv-42683','h_22573597-b3be-4056-b01a-27b1a5bec8b3','h_4545fb77-10d7-4642-9d3d-8e175e548fec','h_cbffd0d5-2e83-4adf-af9c-0cf375d2b9c6']),
  ('resident-evil', array['h_cd90d72f-78ae-497c-a81d-bfc483b2ab07','h_1cc569e9-2388-4a0e-9bbe-b71c15745378'])
) t(tag, ids)
where exists (select 1 from public.heroes h where h.id = any(t.ids))
on conflict do nothing;

-- Drop any tag row whose hero_id does not exist, so a typo'd id is not silently
-- carried as a tag that can never match.
delete from public.hero_cast_tags t
where not exists (select 1 from public.heroes h where h.id = t.hero_id);
