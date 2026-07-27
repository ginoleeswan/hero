-- Split the 'hasbro' tag, for the same reason 'nintendo' was split.
--
-- The publisher-derived rule assumed one publisher meant one cast. Hasbro is at
-- least two unrelated toy lines, and the merged tag produced Snake Eyes /
-- Optimus Prime as a "same cast" pair in batch 08 — a G.I. Joe commando and an
-- Autobot who share a licensor and nothing else.
--
-- The comics HAVE crossed them over, repeatedly. That is not the same as a
-- relationship, and the queue is meant to surface the second thing.

delete from public.hero_cast_tags where cast_tag = 'hasbro';

insert into public.hero_cast_tags (hero_id, cast_tag)
select unnest(ids), tag from (values
  ('transformers', array['cv-6467','cv-4103','h_5aea1d74-5e71-4dbf-af0f-1588b0f44cb0']),
  ('gi-joe', array['cv-6452'])
) t(tag, ids)
where exists (select 1 from public.heroes h where h.id = any(t.ids))
on conflict do nothing;

-- Any other Hasbro-published hero now has no tag and surfaces in
-- hero_cast_untagged rather than silently matching everyone.
delete from public.hero_cast_tags t
where not exists (select 1 from public.heroes h where h.id = t.hero_id);
