-- A catalogue name that merely STARTS a longer name is not a match.
--
-- ── what it fixes ───────────────────────────────────────────────────────────
--
-- match_title_for_video attaches a channel upload to a catalogue title by
-- substring containment, preferring the longest name and then an active title.
-- The failure mode is a short name that is a substring of an unrelated work's.
-- Live on /event/gamescom/2026 on 2026-08-25, all four from one evening's feed:
--
--   "Heroes of Might and Magic III Remake Reveal Trailer"   -> Heroes (TV, 2006)
--   "Stellar Blade Complete Edition - Action Trailer"       -> Blade (film, 1998)
--   "Aliens: Fireteam Elite 2 XBOX Launch Video"            -> Aliens (film, 1986)
--   "Kingdom Hearts IV - Extended D23 2026 Coco Trailer"    -> Kingdom Hearts
--
-- The first appeared four times over, each rendering with the cast of the TV
-- series — Sylar and Claire Bennet under a Ubisoft strategy game — because
-- get_event_dossier hands each announcement the matched title's characters.
--
-- The header of 20260815101000 argued that a bad MATCH is cheap because
-- title_id was "a record in a table nobody renders yet". Announcements render it
-- (20260815190000) and revealed cast reads through it (20260815240000), so that
-- premise expired: the promotion guard still protects the Pulse rail, and
-- nothing was protecting the event page.
--
-- ── the test ────────────────────────────────────────────────────────────────
--
-- A studio leads with the work's name and stacks the ceremony after it. So the
-- catalogue's name must PREFIX the video's first segment, and what follows must
-- be ceremony ("Official Trailer", "Season 3", "PS5 Games") rather than more of
-- a longer name. "Dead by Daylight - Chorus of Sin Launch Trailer" passes on its
-- first segment; "Heroes of Might and Magic" fails because "of" is not
-- ceremony.
--
-- Colons are deliberately NOT segment breaks — "Aliens: Fireteam Elite 2" is one
-- name, and cutting there is exactly what let the 1986 film claim a 2026 game.
--
-- Mirrored in TypeScript by src/lib/events/announcementMatch.ts, which the
-- dossier mapper applies at read time so the render is correct before this is
-- applied, and which carries the unit tests. Change both together.

create or replace function public.video_title_match_is_credible(p_video text, p_title text)
returns boolean
language sql
immutable
parallel safe
as $$
  with seg as (
    select public.normalize_match_text(
      -- Possessive studio prefix: "Marvel Television's VisionQuest".
      regexp_replace(
        -- Bracketed asides are ceremony wherever they sit: "[In the Studio]",
        -- and a Bandai upload is one long 【…】「…」 stack.
        regexp_replace(
          (regexp_split_to_array(coalesce(p_video, ''), '\||–|—|\s-\s'))[1],
          '[\[\(\{【「][^\]\)\}】」]*[\]\)\}】」]', ' ', 'g'
        ),
        '^.*?[''’]s\s+', ''
      )
    ) as hay,
    public.normalize_match_text(p_title) as name
  )
  select case
    -- Nothing to judge: an unnamed title is a data gap, not a bad match.
    when seg.name = '' then true
    when seg.hay = '' then false
    when seg.hay = seg.name then true
    when left(seg.hay, length(seg.name) + 1) <> seg.name || ' ' then false
    else substr(seg.hay, length(seg.name) + 2) ~
      ('^((season|series|part|chapter|volume|vol|episode|ep) [0-9]+ ?'
       || '|(official|final|new|first|look|special|sneak|peek|trailer|teaser|reveal'
       || '|launch|announcement|announce|release|date|gameplay|overview|clip|featurette'
       || '|preview|extended|spot|promo|full|out|now|available|streaming|video|games|game'
       || '|hd|uhd|4k|ps5|ps4|xbox|pc|switch|steam|nintendo) ?)*$')
  end
  from seg;
$$;

comment on function public.video_title_match_is_credible(text, text) is
  'Does this catalogue title credibly name what the video is about? Mirrors src/lib/events/announcementMatch.ts.';

-- The matcher itself: same candidate ordering, one more thing to be true.
create or replace function public.match_title_for_video(p_text text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  with v as (select public.normalize_match_text(p_text) as hay)
  select t.id
  from public.titles t, v
  where t.title_norm is not null
    and length(t.title_norm) >= 5
    and position(t.title_norm in v.hay) > 0
    and public.video_title_match_is_credible(p_text, t.title)
  order by
    (case
       when t.release_date is null
         or t.release_date >= current_date - 365
         or (t.details->>'status') in ('Returning Series', 'In Production', 'Planned', 'Pilot')
       then 0 else 1
     end),
    length(t.title_norm) desc,
    t.release_date desc nulls last
  limit 1;
$$;

-- Re-judge what is already attached. Only rows that FAIL the new test are
-- touched, so this is bounded and repeatable: a bad match is re-run through the
-- matcher, which now either finds a credible title or leaves NULL. `matched_at`
-- stays set either way — the attempt happened, and clearing it would put every
-- one of these back in the queue on the next sweep forever.
update public.channel_videos cv
set title_id = public.match_title_for_video(cv.title)
where cv.title_id is not null
  and not public.video_title_match_is_credible(
        cv.title,
        (select t.title from public.titles t where t.id = cv.title_id)
      );

-- Promotions made under the old test. title_videos is what the Pulse rail reads,
-- and the promotion guard (trailer-shaped + a title that could still be getting
-- trailers) never had to be right about WHICH title. Only channel-sourced rows
-- ('yt:' ids) can have come from here; TMDB's own video rows are untouched.
delete from public.title_videos tv
using public.channel_videos cv
where tv.id = 'yt:' || cv.id
  and (cv.title_id is null or cv.title_id <> tv.title_id);
