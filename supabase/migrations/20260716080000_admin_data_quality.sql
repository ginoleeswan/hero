-- Data-quality invariant checks (admin command center → Catalog → Hygiene).
-- Codifies the classes of corruption found by hand in the 2026-07-16 famous-
-- roster audit so they're watched continuously instead of rediscovered:
--   * staleDone          — comicvine_status='done' with a comicvine_id but NULL
--                          issue_count: the "Hulk/Thor" signature (stale/broken
--                          stored data that the client will never re-fetch).
--   * collisionSuspects  — hand-curated rows (non cv- id) wearing a Marvel/DC
--                          publisher next to a real franchise: the cross-
--                          franchise collision smell test (issue #65). Should
--                          stay at 0; regrowth means the publisher gate leaked.
--   * famousNullPublisher / famousNoSummary / famousMissingPortrait — visible
--                          gaps on high-fame (>=80) characters.
--   * famousDupNames     — the same name AND same publisher on 2+ rows where
--                          the most famous is >=70: near-certain duplicates
--                          needing a merge. (Grouping by publisher too keeps
--                          legitimate cross-publisher same-name characters —
--                          two "Atlas"es — out of the signal: 94 noisy → 16 real.)
-- Read live (cheap: every check is over indexed columns or the tiny fame>=80
-- head), admin-guarded like every command-center RPC.
create or replace function public.admin_data_quality()
returns json
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    return json_build_object('authorized', false);
  end if;

  return json_build_object(
    'authorized', true,
    'generatedAt', now(),
    'checks', json_build_array(
      json_build_object(
        'key', 'staleDone',
        'label', 'Stale enrichment (done, but empty)',
        'count', (select count(*) from heroes
                   where comicvine_status = 'done' and comicvine_id is not null
                     and issue_count is null),
        'sample', (select coalesce(json_agg(s), '[]'::json) from (
          select id, name, fame_score from heroes
           where comicvine_status = 'done' and comicvine_id is not null
             and issue_count is null
           order by fame_score desc nulls last limit 8) s)
      ),
      json_build_object(
        'key', 'collisionSuspects',
        'label', 'Cross-franchise collision suspects',
        'count', (select count(*) from heroes
                   where comicvine_status = 'done' and id not like 'cv-%'
                     and (publisher ilike '%marvel%' or publisher ilike '%dc comics%' or publisher = 'DC')
                     and franchise is not null),
        'sample', (select coalesce(json_agg(s), '[]'::json) from (
          select id, name, fame_score from heroes
           where comicvine_status = 'done' and id not like 'cv-%'
             and (publisher ilike '%marvel%' or publisher ilike '%dc comics%' or publisher = 'DC')
             and franchise is not null
           order by fame_score desc nulls last limit 8) s)
      ),
      json_build_object(
        'key', 'famousNullPublisher',
        'label', 'Famous, no publisher',
        'count', (select count(*) from heroes where fame_score >= 80 and publisher is null),
        'sample', (select coalesce(json_agg(s), '[]'::json) from (
          select id, name, fame_score from heroes
           where fame_score >= 80 and publisher is null
           order by fame_score desc limit 8) s)
      ),
      json_build_object(
        'key', 'famousNoSummary',
        'label', 'Famous, no summary',
        'count', (select count(*) from heroes
                   where fame_score >= 80 and (summary is null or length(summary) = 0)),
        'sample', (select coalesce(json_agg(s), '[]'::json) from (
          select id, name, fame_score from heroes
           where fame_score >= 80 and (summary is null or length(summary) = 0)
           order by fame_score desc limit 8) s)
      ),
      json_build_object(
        'key', 'famousMissingPortrait',
        'label', 'Famous, no portrait',
        'count', (select count(*) from heroes where fame_score >= 80 and portrait_url is null),
        'sample', (select coalesce(json_agg(s), '[]'::json) from (
          select id, name, fame_score from heroes
           where fame_score >= 80 and portrait_url is null
           order by fame_score desc limit 8) s)
      ),
      json_build_object(
        'key', 'famousDupNames',
        'label', 'Famous duplicate names (same publisher)',
        'count', (select count(*) from (
          select name from heroes
          group by name, lower(coalesce(publisher, ''))
          having count(*) > 1 and max(fame_score) >= 70) d),
        'sample', (select coalesce(json_agg(s), '[]'::json) from (
          select min(id) as id, name, max(fame_score) as fame_score
            from heroes
          group by name, lower(coalesce(publisher, ''))
          having count(*) > 1 and max(fame_score) >= 70
           order by max(fame_score) desc limit 8) s)
      )
    )
  );
end;
$function$;

do $$
declare f text;
begin
  foreach f in array array['public.admin_data_quality()']
  loop
    execute format('revoke all on function %s from public, anon;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end $$;
