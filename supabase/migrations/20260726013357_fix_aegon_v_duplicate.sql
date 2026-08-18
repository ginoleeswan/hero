-- The dynasty migration added "Aegon V Targaryen" without noticing that Egg —
-- already in the catalogue as "Aegon Targaryen" from the Dunk & Egg comics — is
-- the same king. Keep the older row: it carries comicvine_id 91053 and real
-- source art. Move the better summary onto it, rename it for clarity now that
-- Aegon I, III and IV exist alongside it, and drop the row added in error.
--
-- Safe to delete outright rather than merge: the row was created minutes ago in
-- the same session, nothing references it (no hero_relatives, no portrait, no
-- comicvine_id), and its only content of value is the summary moved here.
update public.heroes
set name = 'Aegon V Targaryen',
    summary = 'Egg, the fourth son who was never meant to rule and who spent his boyhood on the road as a hedge knight''s squire. He died at Summerhall trying to wake dragons from stone.',
    aliases = array(select distinct e from unnest(coalesce(aliases, '{}'::text[]) || array['Egg','Aegon Targaryen','Aegon V']) e)
where id = 'h_217c57a8-8471-4507-84dd-944a61945d0a'
  and name = 'Aegon Targaryen';

delete from public.heroes
where id = 'h_988b3f4d-b7ff-4c30-a236-7b8fe0ce22f7'
  and name = 'Aegon V Targaryen'
  and comicvine_id is null;;
