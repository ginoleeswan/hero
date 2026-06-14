-- Per-run audit: which heroes a given enrichment run touched. Lets the command
-- center show exactly who got enriched, grouped by run.
create table if not exists public.enrichment_run_heroes (
  run_id  bigint not null references public.enrichment_runs(id) on delete cascade,
  hero_id text   not null references public.heroes(id) on delete cascade,
  primary key (run_id, hero_id)
);
create index if not exists enrichment_run_heroes_run_idx on public.enrichment_run_heroes (run_id);
create index if not exists enrichment_run_heroes_hero_idx on public.enrichment_run_heroes (hero_id);

alter table public.enrichment_run_heroes enable row level security;
create policy enrichment_run_heroes_admin_read on public.enrichment_run_heroes
  for select to public
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_admin));
