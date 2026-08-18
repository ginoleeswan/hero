-- relation_kind had 'ancestor' for lineage running up but no mirror for lineage
-- running down, so descendants could only ever be recorded two generations deep
-- (child, grandchild). That made Aegon the Conqueror's tree stop dead at his
-- grandsons while Daenerys could see all twelve generations back up to him.
--
-- Separate migration because Postgres refuses to use a new enum value in the
-- same transaction that adds it.
alter type public.relation_kind add value if not exists 'descendant';;
