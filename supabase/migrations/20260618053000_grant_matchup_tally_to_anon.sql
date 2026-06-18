-- Let logged-out (anon) visitors READ the matchup crowd tally, so a stranger who
-- lands on a shared /compare/a/b link sees the crowd split (social proof) instead
-- of a 401. get_matchup_tally is SECURITY DEFINER and only returns aggregate
-- counts + the caller's own pick (null for anon), so this exposes nothing private.
--
-- Voting stays authenticated: cast_matchup_vote and get_my_battle_record are
-- deliberately NOT granted to anon (votes are RLS-locked per-user rows; logged-out
-- fans get an optimistic local reveal instead).
grant execute on function public.get_matchup_tally(text, text) to anon;
