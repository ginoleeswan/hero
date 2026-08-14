-- Final-review fix for the user-blocking feature (Finding 1 + Finding 4).
--
-- Finding 1: user_profiles' SELECT policy is self-scoped
-- ((select auth.uid()) = id), so any `.in('id', ids)` lookup against
-- user_profiles from getBlockedUsers/getTakes returns zero rows for everyone
-- but the caller — no error, just silent nulls. The block list then can't
-- show who you're unblocking, and every take byline reads "Anonymous hero".
--
-- Fix: a SECURITY DEFINER RPC that exposes only the public columns
-- (id, display_name, avatar_url) — never is_admin or any other column, and
-- user_profiles' own RLS is untouched.
create or replace function public.get_public_profiles(p_ids uuid[])
returns table (id uuid, display_name text, avatar_url text)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select up.id, up.display_name, up.avatar_url
  from public.user_profiles up
  where up.id = any(p_ids)
$$;

comment on function public.get_public_profiles is
  'Public-column profile lookup for byline/avatar resolution (takes, blocked-users list). SECURITY DEFINER because user_profiles SELECT RLS is self-scoped; only returns id/display_name/avatar_url, never is_admin or other columns.';

-- Takes are readable anon (logged-out browsing), so byline resolution must
-- work for anon too, not just authenticated.
grant execute on function public.get_public_profiles(uuid[]) to authenticated, anon;

-- Finding 4: default privileges gave anon SELECT/INSERT/UPDATE/DELETE on
-- blocked_users when the table was created. RLS holds today (no anon-matching
-- policy, no UPDATE policy at all), but that's a landmine if a `to public`
-- policy is ever added later for something else. Revoke the standing grant now.
revoke all on public.blocked_users from anon;
