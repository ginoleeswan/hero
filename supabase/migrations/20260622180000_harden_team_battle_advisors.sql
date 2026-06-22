-- Advisor hardening for the team-battle schema (Phase 1).
--
-- 1. slugify_team: pin a non-mutable search_path
--    (lint 0011_function_search_path_mutable). The function is pure string work,
--    but a stable search_path is the project convention for all functions.
alter function public.slugify_team(text) set search_path = public;

-- 2. team_verdicts: the verdict cache is written ONLY by the generate-team-verdict
--    edge function using the service_role key (which bypasses RLS); the client
--    only ever reads (getCachedTeamVerdict). The anon `INSERT ... WITH CHECK (true)`
--    policy mirrored from `verdicts` is therefore unnecessary attack surface, so
--    drop it (lint 0024_permissive_rls_policy). Public SELECT stays.
drop policy if exists team_verdicts_insert on public.team_verdicts;
