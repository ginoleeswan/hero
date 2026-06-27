-- Fame / popularity score: captured signals + a versioned scoring function.
-- Replaces issue_count as the popularity heuristic with a mainstream-weighted
-- 0-100 score. fame_tier is rated by Claude for the candidate pool; everyone
-- else defaults to 0 (=> ordered by issue_count via the scoring blend, no
-- regression for the long tail).

alter table public.heroes
  add column if not exists fame_tier        smallint not null default 0,
  add column if not exists fame_rated_at    timestamptz,
  add column if not exists fame_rated_by    text,
  add column if not exists wikidata_sitelinks int,
  add column if not exists fame_score       smallint,
  add column if not exists fame_score_version smallint;

create index if not exists heroes_fame_score_idx
  on public.heroes (fame_score desc nulls last);

-- Pure blend: tier sets the band; the mainstream-weighted, already-normalized
-- ([0,1]) signal mix positions the hero within the band, with a bounded
-- cross-band correction (+/- up to 8 pts) so extreme hard signals can rescue a
-- mis-rated hero.
-- NOTE: the downward half of this correction is removed by the immediately
-- following migration (20260627144247_fame_score_no_downward_correction); this
-- file preserves the originally-applied body so a db reset replays true history.
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
    - (case when (select w from s) < 0.1 then (0.1 - (select w from s)) * 80 else 0 end)
  )))::smallint
$$;

-- Recompute every hero's fame_score. Winsorizes each hard signal at its 99th
-- percentile (so one outlier can't flatten the scale), log-compresses, and
-- normalizes to [0,1] before calling compute_fame_score. Service-role only.
create or replace function public.recompute_fame_scores()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_cap real; v_movie_cap real; v_issue_cap real; v_n integer;
begin
  select percentile_cont(0.99) within group (order by wikidata_sitelinks)
    into v_site_cap from heroes where wikidata_sitelinks > 0;
  select percentile_cont(0.99) within group (order by movie_count)
    into v_movie_cap from heroes where movie_count > 0;
  select percentile_cont(0.99) within group (order by issue_count)
    into v_issue_cap from heroes where issue_count > 0;
  v_site_cap  := greatest(coalesce(v_site_cap, 1), 1);
  v_movie_cap := greatest(coalesce(v_movie_cap, 1), 1);
  v_issue_cap := greatest(coalesce(v_issue_cap, 1), 1);

  update heroes h set
    fame_score = compute_fame_score(
      coalesce(h.fame_tier, 0)::smallint,
      (ln(1 + least(coalesce(h.wikidata_sitelinks, 0), v_site_cap)) / ln(1 + v_site_cap))::real,
      (ln(1 + least(coalesce(h.movie_count, 0), v_movie_cap)) / ln(1 + v_movie_cap))::real,
      (ln(1 + least(coalesce(h.issue_count, 0), v_issue_cap)) / ln(1 + v_issue_cap))::real
    ),
    fame_score_version = 1;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.recompute_fame_scores() from public, anon, authenticated;
grant execute on function public.recompute_fame_scores() to service_role;
