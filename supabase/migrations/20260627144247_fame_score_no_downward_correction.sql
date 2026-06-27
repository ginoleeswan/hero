-- Correct compute_fame_score: the tier band is a FLOOR. The previous body
-- subtracted up to 8 pts when the normalized signal mix was very low, which
-- demoted confidently-rated heroes (e.g. a tier-4 household name) below their
-- band just for having sparse hard data (NULL sitelinks/movies is common).
-- Missing hard data must never demote a human rating, so the downward half of
-- the cross-band correction is removed; the upward rescue (+8 when w > 0.9) stays.
create or replace function public.compute_fame_score(
  p_tier smallint, p_n_site real, p_n_movie real, p_n_issue real
) returns smallint
language sql immutable as $$
  with b as (
    select
      (case p_tier when 4 then 80 when 3 then 55 when 2 then 35 when 1 then 15 else 0 end)::real as lo,
      (case p_tier when 4 then 100 when 3 then 80 when 2 then 55 when 1 then 35 else 15 end)::real as hi
  ),
  s as (
    select least(1.0, greatest(0.0,
      0.5 * coalesce(p_n_site, 0) + 0.3 * coalesce(p_n_movie, 0) + 0.2 * coalesce(p_n_issue, 0)
    ))::real as w
  )
  select greatest(0, least(100, round(
      (select lo from b) + (select w from s) * ((select hi from b) - (select lo from b))
    + (case when (select w from s) > 0.9 then ((select w from s) - 0.9) * 80 else 0 end)
  )))::smallint
$$;
