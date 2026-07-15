-- The universe/category browse queries ran as anon in 7.2s (statement timeout
-- at 8s → "No characters found") vs 33ms as postgres. Root cause: heroes has
-- RLS enabled with a select policy of USING (true) — it filters NOTHING, but
-- its presence stops the planner using column statistics for non-leakproof
-- operators (ILIKE), which flips the plan from the fame-index walk to a 50k-row
-- seq scan on a CPU-constrained instance.
--
-- heroes is a public read-only catalog. The fix swaps the write barrier from
-- RLS to grants (STRONGER than before — previously only the absence of write
-- policies blocked writes) and drops RLS so every client query gets the same
-- 33ms plan the admin connection gets. Service-role pipelines are unaffected.

revoke insert, update, delete, truncate, references, trigger
  on public.heroes from anon, authenticated;

alter table public.heroes disable row level security;

-- The now-dead policy (documented removal rather than orphaning it).
drop policy if exists heroes_select on public.heroes;
