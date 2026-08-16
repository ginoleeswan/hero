-- `get_debuts_this_month` was a 10.6-second sequential scan over all 50,575
-- heroes: for every row it detoasted `first_issue_data` (the heroes table is
-- 243 MB, so that JSONB is out-of-line), ran a regex over the cover date, cast
-- it to a date, and extracted the month — to keep 2,705 rows and discard 47,870.
--
-- That matters twice over. It is the largest single term in the hourly
-- explore-bundle refresh (9.4s of a 24.6s job, recomputed 24 times a day to
-- answer a question whose answer changes 12 times a year), AND the RPC is
-- granted to `anon`, whose statement_timeout is 3 seconds — so any live call
-- that misses the bundle cache does not run slowly, it fails.
--
-- The month cannot be indexed directly: `text::date` depends on DateStyle and
-- so is not IMMUTABLE, which an index expression requires. But the cover dates
-- that pass the regex guard are ISO-8601 by construction, and characters 6-7 of
-- 'YYYY-MM-DD' are the month — substring and the integer cast are both
-- immutable, so the same value is reachable without the date cast at all.

create or replace function public.debut_month_of(p_first_issue jsonb)
returns smallint
language sql
immutable
parallel safe
as $$
  select case
    when p_first_issue->>'coverDate' ~ '^\d{4}-\d{2}-\d{2}'
    then substring(p_first_issue->>'coverDate' from 6 for 2)::smallint
  end
$$;

comment on function public.debut_month_of(jsonb) is
  'Calendar month of a hero''s first-issue cover date, or NULL when the date is absent or not ISO-8601. IMMUTABLE so it can be indexed — see heroes_debut_month_idx.';

grant execute on function public.debut_month_of(jsonb) to anon, authenticated, service_role;;
