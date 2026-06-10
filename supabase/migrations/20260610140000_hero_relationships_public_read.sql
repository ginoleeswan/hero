-- Supabase auto-enables RLS on new tables; without a policy, anon reads 0 rows,
-- so get_related_heroes (security invoker) silently returned []. Add the same
-- public-read policy heroes / hero_relatives carry — the graph is public data.
alter table public.hero_relationships enable row level security;

create policy "Public read access"
  on public.hero_relationships
  for select
  to anon, authenticated
  using (true);
