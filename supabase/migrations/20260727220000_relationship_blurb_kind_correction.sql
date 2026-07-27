-- Let an author correct the relation kind, not just write about it.
--
-- Authoring batch 1 surfaced a problem the three-outcome status column does not
-- cover. The queue's PAIRS are mostly real; its KINDS frequently are not. From
-- the top 30 pairs by combined fame:
--
--   Captain America / Hulk    -> 'enemy'   (founding Avengers)
--   Iron Man / Black Widow    -> 'enemy'   (his assistant, then his teammate)
--   Supergirl / Batman        -> 'enemy'   (Justice League allies)
--   Joker / Lex Luthor        -> 'enemy'   (collaborators more often than not)
--   Hulk / Venom              -> 'ally'    (no)
--   Merlin / Santa Claus      -> 'ally'    (both merely tagged "In the Public Domain")
--
-- Roughly a third of that sample carries a wrong or dubious kind. It comes from
-- the same place as everything else in hero_relationships: ComicVine's free-text
-- enemies/friends arrays, which record that two characters were adjacent without
-- recording what they were to each other.
--
-- Why status could not express this. 'no_relationship' is false — Cap and Banner
-- are closely connected. 'nothing_to_say' is false — there is a great deal to
-- say. The pair is worth writing about and the LABEL is what is wrong.
--
-- Why it has to be recorded rather than ignored. SocialWebFocusCard renders a
-- coloured kind pill immediately above the blurb, so a true sentence about the
-- two of them founding the Avengers would appear under a red ENEMY pill. The
-- prose would be right and the page would still read as confidently wrong.
--
-- This is free to collect: the author is already judging the pair closely enough
-- to write about it, and judging the kind is the same act. Like the
-- 'no_relationship' denylist, it is RECORDED AND NOT YET CONSUMED — nothing
-- reads this column, so the graph does not move under anyone until that is a
-- deliberate, separately-reviewed decision.

alter table public.hero_relationship_blurbs
  add column if not exists kind_correction text;

-- Same vocabulary as the neighbourhood graph's NeighborKind: the three kinds
-- hero_relationships stores, plus the 'family' that hero_relatives contributes.
alter table public.hero_relationship_blurbs
  drop constraint if exists hero_relationship_blurbs_kind_correction;

alter table public.hero_relationship_blurbs
  add constraint hero_relationship_blurbs_kind_correction
    check (kind_correction is null
           or kind_correction in ('family', 'enemy', 'ally', 'teammate'));

comment on column public.hero_relationship_blurbs.kind_correction is
  'The relation kind the author judges correct for this pair. NULL means the '
  'graph''s own kind was accepted, or the row is a decline. Not consumed by any '
  'read path — a curated correction set awaiting a deliberate decision, exactly '
  'like the no_relationship rows.';
