-- Extend the heroes fix (20260715104931) to every PUBLIC CATALOG table with
-- the same pattern: RLS enabled with a trivially-true SELECT policy.
-- USING (true) filters nothing, but RLS's presence blocks the planner from
-- using column statistics with non-leakproof operators (ILIKE, regex) and adds
-- per-query overhead — heroes went 7.2s -> 132ms as anon.
--
-- For each catalog table: swap the write barrier from "no write policy" to
-- revoked grants (strictly stronger), drop RLS, drop the dead policy.
-- Untouched: every table with a REAL row-filtering policy (user_favourites,
-- matchup_takes/votes, user_profiles, contributions, reports, view history,
-- admin-gated tables) and service-only tables with RLS-and-no-policy (locked).

do $$
declare
  t text;
begin
  foreach t in array array[
    'hero_relationships',
    'titles',
    'hero_images',
    'hero_narrative_facts',
    'hero_media_appearances',
    'team_members',
    'hero_facts',
    'hero_tags',
    'hero_people',
    'hero_relatives',
    'teams',
    'comic_issues',
    'comic_issue_appearances',
    'verdicts',
    'team_verdicts',
    'featured_campaigns',
    'daily_debate',
    'hero_tag_vocab',
    'contributor_stats'
  ] loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated',
      t
    );
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;

-- Drop the now-dead trivially-true policies (names vary per table).
drop policy if exists "Public read access" on public.hero_relationships;
drop policy if exists "Public read access" on public.titles;
drop policy if exists "hero_images public read" on public.hero_images;
drop policy if exists hero_narrative_facts_public_read on public.hero_narrative_facts;
drop policy if exists "Public read access" on public.hero_media_appearances;
drop policy if exists team_members_public_read on public.team_members;
drop policy if exists "Public read access" on public.hero_facts;
drop policy if exists hero_tags_public_read on public.hero_tags;
drop policy if exists "Public read access" on public.hero_people;
drop policy if exists "hero_relatives public read" on public.hero_relatives;
drop policy if exists teams_public_read on public.teams;
drop policy if exists "Public read access" on public.comic_issues;
drop policy if exists "Public read access" on public.comic_issue_appearances;
drop policy if exists verdicts_select on public.verdicts;
drop policy if exists team_verdicts_select on public.team_verdicts;
drop policy if exists featured_campaigns_public_read on public.featured_campaigns;
drop policy if exists dd_public_read on public.daily_debate;
drop policy if exists hero_tag_vocab_public_read on public.hero_tag_vocab;
drop policy if exists contributor_stats_read on public.contributor_stats;
