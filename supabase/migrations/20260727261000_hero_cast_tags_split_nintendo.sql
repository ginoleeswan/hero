-- Split the 'nintendo' tag. It was wrong and batch 04 paid for it.
--
-- The publisher-derived rule in 20260727240000 assumed one publisher meant one
-- cast. That holds for the Muppets and Sesame Street; it does not hold for
-- Nintendo, which is five unrelated franchises that meet only in Smash Bros.
-- Batch 04 therefore spent judgment declining Mario/Link, Kirby/Zelda,
-- Princess Peach/Link and six more — all "same cast", none a relationship.
-- Batch 04's decline rate was 64%, worse than batch 03's 56%, almost entirely
-- from this.
--
-- Donkey Kong deliberately gets BOTH super-mario and donkey-kong: he was the
-- antagonist of Mario's 1981 debut before he had a series of his own, and that
-- pair is worth writing about. Everyone else gets exactly one franchise.
--
-- Nintendo-published characters not named here lose their tag entirely and
-- surface in hero_cast_untagged, which is the point of that view — Pokémon
-- trainers (Serena, Max, Giovanni) are mis-shelved under publisher 'Nintendo'
-- and should be tagged with the Pokémon cast when someone works that backlog.

delete from public.hero_cast_tags where cast_tag = 'nintendo';

insert into public.hero_cast_tags (hero_id, cast_tag)
select unnest(ids), tag from (values
  ('super-mario', array['h_850dd0ee-0b63-44bd-8936-da706517d07a','cv-55484','h_8d776c67-da5c-4d2c-b762-ad363aa20b9f','h_bf38eb8e-640f-403f-9aaf-be9f41b6eeb3','h_f8f41dfd-2369-4312-b105-d903dffb4155','670','h_54cf537e-47a3-479d-af8a-29a366bcac05','h_006553ce-4b0b-4df2-880b-50ada770898d','h_7153eccc-e55b-46d1-aa01-586778eae17c','h_05a53359-07cc-49af-a5c7-c6652cf25b22','h_54e6843c-bba6-4d3c-ac15-766ce95a7b01','h_7898731f-951a-45e3-b56c-c61d5f8e24f6','h_513be398-adb3-4894-9dfd-08da4251806c','h_3d681c0a-b701-47a8-973f-1fb85fdd76ec']),
  ('donkey-kong', array['h_006553ce-4b0b-4df2-880b-50ada770898d','h_4b3a4365-f811-4081-b501-f438f619eceb','h_8da19f78-6bda-40c6-809b-0ed5894cb8d6','h_b9bdfb11-c89c-44b0-b4b7-578f779247b3']),
  ('the-legend-of-zelda', array['h_d12109cd-c94f-4db4-bc41-cc7aa769ec9a','cv-46231','h_a9a6c575-4a5c-4375-949a-f3da2df465cf']),
  ('kirby', array['h_9e5b1316-daba-47a0-b807-af6d4cfe866b']),
  ('metroid', array['cv-46651']),
  ('star-fox', array['h_b0ed3a22-2f89-41d8-9726-ae1eb8617cd4'])
) t(tag, ids)
where exists (select 1 from public.heroes h where h.id = any(t.ids))
on conflict do nothing;

delete from public.hero_cast_tags t
where not exists (select 1 from public.heroes h where h.id = t.hero_id);
