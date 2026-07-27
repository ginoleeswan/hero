-- Issue casts are a GUESS, and nothing recorded that they were.
--
-- sync-new-comics attributes an issue's characters from its SERIES (volume)
-- roster, because ComicVine's /issues LIST endpoint carries no character_credits
-- and the per-issue DETAIL endpoint is harshly rate-limited. That is a sound
-- trade for a firehose, but it is a guess, and for periodical ANTHOLOGIES it is
-- a fabrication: the roster is the union of every character across every serial
-- the magazine ever ran.
--
-- Measured 2026-07-27:
--   Morning #2491 (Kodansha)      -> cast: Joker, Batman.        ComicVine: 0 credits
--   Weekly Young Jump #2266       -> cast: Joker, Batman, ...    ComicVine: 0 credits
--   Action Comics #1100 (DC)      -> cast: Joker, Harley Quinn.. ComicVine: 0 credits
--   Absolute Superman #21 (DC)    -> ComicVine: 7 real credits
--
-- Both anthologies carried max_fame 100 purely from those invented Batman/Joker
-- links, which is what floated them over the >= 25 fame gate and into the Pulse
-- rail ahead of Avengers: Doomsday. Note Action Comics is fabricated too — it
-- merely looks plausible because a DC roster on a DC book is coherent.
--
-- This migration adds the provenance the table never had, so a cast can be
-- trusted, distrusted, or re-checked. verify-issue-cast fills it in.

alter table public.comic_issues
  -- 'issue'  — ComicVine returned per-issue character_credits. Ground truth.
  -- 'volume' — inherited from the series roster. A guess; may be fabricated.
  -- 'volume_filtered' — a guess with incoherent franchises stripped out.
  -- 'none'   — no evidence survived; the issue has no cast worth showing.
  add column if not exists cast_source text
    check (cast_source is null or cast_source in ('issue', 'volume', 'volume_filtered', 'none')),
  add column if not exists cast_verified_at timestamptz;

-- Everything already stored came from the volume roster, by construction.
update public.comic_issues
set cast_source = 'volume'
where cast_source is null
  and exists (select 1 from public.comic_issue_appearances a where a.issue_id = id);

-- Round-robin cursor for the verifier, mirroring titles.videos_checked_at.
create index if not exists comic_issues_cast_verify_idx
  on public.comic_issues (cast_verified_at asc nulls first, store_date desc)
  where store_date is not null;

-- max_fame is what the fame gate reads, so it must be DERIVED from whatever cast
-- actually survived verification rather than left at the roster's high-water
-- mark. Null when no cast survives — `coalesce(max_fame,0) >= 25` in
-- get_pulse_candidates and the p_min_fame gate in get_new_comics then exclude the
-- issue on their own, with no reader changes needed.
create or replace function public.recompute_issue_max_fame(p_issue_id text)
returns smallint
language sql
volatile
security definer
set search_path = public
as $$
  with best as (
    select max(h.fame_score) as f
    from public.comic_issue_appearances a
    join public.heroes h on h.id = a.hero_id
    where a.issue_id = p_issue_id
  )
  update public.comic_issues i
  set max_fame = (select f from best)
  where i.id = p_issue_id
  returning i.max_fame;
$$;
revoke execute on function public.recompute_issue_max_fame(text) from public, anon, authenticated;
grant execute on function public.recompute_issue_max_fame(text) to service_role;
