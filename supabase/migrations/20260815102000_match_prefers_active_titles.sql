-- Longest match, but an ACTIVE title beats a longer dead one.
--
-- match_title_for_video picked the longest catalogue title contained in the
-- video's title, which is right for "Avengers" vs "Avengers: Doomsday" and wrong
-- the moment a franchise name is itself a title. Star Wars posted:
--
--   "Star Wars: Ahsoka Season 2 | Teaser Trailer | Streaming January 20"
--
-- and the longest contained title is "Star Wars" (9 chars, 1977), not "Ahsoka"
-- (6 chars, Returning Series). The promotion guard then did its job and refused
-- to put a 1977 film on the rail as a new teaser -- so nothing false shipped, but
-- the actual Ahsoka season-2 trailer was lost with it. Precision protected us
-- and recall paid for it.
--
-- The fix is to rank on what the video can plausibly be ABOUT before ranking on
-- length. A studio posting a trailer today is posting it about something that is
-- upcoming, recent, or still in production; it is not posting one about a film
-- from 1977. So: active titles first, then longest, then newest. "Ahsoka" wins
-- on the first key and never has to win on length.
--
-- Note this makes the matcher agree with the promotion guard instead of fighting
-- it. They encode the same belief -- a new video is about a current thing -- and
-- having only the guard hold it meant the matcher spent its answer on a title the
-- guard was always going to reject.

create or replace function public.match_title_for_video(p_text text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select t.id
  from public.titles t
  where t.title is not null
    and length(t.title) >= 5
    and position(lower(t.title) in lower(p_text)) > 0
  order by
    -- Could this title still be getting a trailer? Same predicate the promotion
    -- step uses, so the two stages cannot disagree about what "current" means.
    (case
       when t.release_date is null
         or t.release_date >= current_date - 365
         or (t.details->>'status') in ('Returning Series', 'In Production', 'Planned', 'Pilot')
       then 0 else 1
     end),
    length(t.title) desc,
    t.release_date desc nulls last
  limit 1;
$$;

-- Re-match everything already ingested under the old ranking. `matched_at` is
-- what suppresses re-matching, so clearing it is what lets the corrected ranking
-- be applied to history; promotion is `on conflict do nothing`, so anything
-- already promoted stays exactly as it is.
update public.channel_videos set matched_at = null, title_id = null;
