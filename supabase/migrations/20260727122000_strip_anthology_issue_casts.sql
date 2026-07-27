-- Backfill of the anthology rule now enforced in sync-new-comics and
-- verify-issue-cast. A periodical anthology's volume roster is the union of every
-- serial the magazine ever ran, so an issue-level cast derived from it is
-- fabricated rather than approximate — Morning #2491 (Kodansha) was carrying
-- "Joker, Batman" and a max_fame of 100, which is what cleared the >= 25 fame
-- gate and put it in the Pulse rail ahead of Avengers: Doomsday.
--
-- The predicate is kept in step with isAnthology() in both edge functions —
-- change all three together. Name or issue number, which separate cleanly here:
-- the anthologies run 1663-3963 (Big Comic, Morning, Young Jump, 2000 AD, Shonen
-- Magazine/Sunday) while the longest-running single series in this catalogue are
-- Action Comics #1100 and Detective Comics #1111.
--
-- Prior state: comic_issue_appearances_pre_verify_20260727.

with anthologies as (
  select id
  from public.comic_issues
  where (
      volume_name ~* '(weekly|monthly|magazine|megazine|jump|2000 ad|corocoro|big comic)'
      or coalesce(nullif(regexp_replace(coalesce(issue_number, ''), '[^0-9]', '', 'g'), ''), '0')::bigint >= 1500
    )
)
delete from public.comic_issue_appearances a
using anthologies t
where a.issue_id = t.id;

-- max_fame is set from the VOLUME rather than from the surviving cast, so it has
-- to be cleared too or the issue keeps its ticket through the gate with nothing
-- to justify it.
update public.comic_issues
set max_fame = null,
    lead_hero_id = null,
    cast_source = 'none',
    cast_verified_at = coalesce(cast_verified_at, now())
where (
    volume_name ~* '(weekly|monthly|magazine|megazine|jump|2000 ad|corocoro|big comic)'
    or coalesce(nullif(regexp_replace(coalesce(issue_number, ''), '[^0-9]', '', 'g'), ''), '0')::bigint >= 1500
  )
  and (max_fame is not null or lead_hero_id is not null);
