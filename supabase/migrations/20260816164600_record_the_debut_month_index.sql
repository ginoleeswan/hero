-- heroes_debut_month_idx already exists: it was built with CREATE INDEX
-- CONCURRENTLY, which cannot run inside a transaction and so could not be part
-- of the migration that added debut_month_of. This records it so a rebuild from
-- migrations produces the same schema — on this database the statement is a
-- no-op, which is the intent.
--
-- The INCLUDE (fame_score) is not decoration: get_debuts_this_month ranks the
-- month's debutants by fame, so carrying it in the index leaf makes the lookup
-- index-only rather than a heap fetch per row on a 243 MB table.
create index if not exists heroes_debut_month_idx
  on public.heroes (public.debut_month_of(first_issue_data))
  include (fame_score)
  where first_issue_data->>'imageUrl' is not null;
