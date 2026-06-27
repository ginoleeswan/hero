-- Deterministic provisional tiering so NEW heroes never sit suppressed at tier 0
-- waiting for a human pass. Acts ONLY on pool members that are unrated
-- (fame_rated_at IS NULL) or previously auto-tiered ('auto-signal') — it never
-- overwrites Claude's hand ratings ('claude-opus-4-8') or the deep-cut floor
-- ('claude-opus-4-8-floor'). Derives a tier from the strongest fame signals
-- (Wikipedia sitelinks + film presence); re-runs upgrade provisional tiers as
-- signals arrive. Judgment (a brand-new household name before its signals catch
-- up) is left to an occasional manual Claude refinement.
create or replace function public.auto_tier_unrated_pool()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  update heroes h
  set fame_tier = greatest(
        1,
        case
          when coalesce(h.wikidata_sitelinks,0) >= 60 then 4
          when coalesce(h.wikidata_sitelinks,0) >= 30 then 3
          when coalesce(h.wikidata_sitelinks,0) >= 12 then 2
          else 1
        end,
        case
          when coalesce(h.movie_count,0) >= 15 then 4
          when coalesce(h.movie_count,0) >= 8  then 3
          when coalesce(h.movie_count,0) >= 3  then 2
          else 1
        end,
        case when coalesce(h.issue_count,0) >= 5000 then 2 else 1 end
      )::smallint,
      fame_rated_at = now(),
      fame_rated_by = 'auto-signal'
  where (h.movie_count >= 2 or h.issue_count >= 200 or h.franchise is not null)
    and coalesce(h.publisher,'') not in ('Non-Fictional','In the Public Domain','Company-Licensed')
    and (h.fame_rated_at is null or h.fame_rated_by = 'auto-signal');
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.auto_tier_unrated_pool() from public, anon, authenticated;
grant execute on function public.auto_tier_unrated_pool() to service_role;

-- Combined weekly maintenance: provisional-tier new/auto heroes, then rescore.
create or replace function public.refresh_fame()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.auto_tier_unrated_pool();
  return public.recompute_fame_scores();
end $$;

revoke all on function public.refresh_fame() from public, anon, authenticated;
grant execute on function public.refresh_fame() to service_role;

-- Re-point the weekly cron from bare recompute to the combined refresh.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'recompute-fame-scores') then
    perform cron.unschedule('recompute-fame-scores');
  end if;
end $$;

select cron.schedule(
  'refresh-fame-weekly',
  '0 4 * * 0',
  $cron$ select public.refresh_fame(); $cron$
);
