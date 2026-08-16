-- The zero-argument refresh_admin_metrics() must go, not just be superseded.
-- With both signatures present a bare `refresh_admin_metrics()` call resolves to
-- the exact zero-arg match rather than the new default — so the cron would keep
-- running the old always-recompute-everything body and the change above would
-- silently do nothing. Overload resolution prefers an exact arity match over a
-- defaulted parameter, which is exactly the kind of no-op that looks shipped.
drop function if exists public.refresh_admin_metrics();;
