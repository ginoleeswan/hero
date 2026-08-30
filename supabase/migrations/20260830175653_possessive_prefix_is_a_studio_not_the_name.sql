-- A possessive is a studio attribution only when it leads. Otherwise it is the
-- work's own name.
--
-- ── what it fixes ───────────────────────────────────────────────────────────
--
-- 20260830174240 judged a match by the video's first segment, after removing a
-- possessive studio prefix ("Marvel Television's VisionQuest"). That strip was
-- written `^.*?['’]s\s+` — everything up to the FIRST possessive, anywhere in
-- the segment — so it ate the work's own name just as readily as a studio's:
--
--   "Star Wars: Smuggler's Gambit – Official Reveal Trailer"  -> Gambit (1993)
--   "Ellis & Rory show Annie chivalry's not dead"             -> Not Dead
--   "Best of X-Men '97's Wolverine | Official Compilation"    -> Wolverine (game)
--
-- which is the same bug that migration existed to kill, reintroduced through
-- the one line that rewrites the text before the test reads it.
--
-- The mirror image was already broken and went unnoticed: a title whose OWN
-- name carries a possessive was cut down to its last word and could never match
-- its own announcement. "No Man's Sky" was tested as "sky", "Another Crab's
-- Treasure" as "treasure", "Widow's Bay" as "bay", "Castlevania: Belmont's
-- Curse" as "curse".
--
-- ── the fix ─────────────────────────────────────────────────────────────────
--
-- Two changes, and the second is why the first is safe.
--
-- 1. The strip is bounded to the two leading words, and refuses a pronoun, so
--    it removes "Marvel's", "Marvel Television's" and "Marvel Studios'" and
--    leaves "Smuggler's" (three words in, behind a colon) and "It's" alone.
--
-- 2. The segment is judged BOTH as written and stripped, and one pass is enough
--    to be credible. A studio attribution passes on the stripped reading; a
--    title that owns its possessive passes on the written one. Neither has to
--    guess which kind it is looking at.
--
-- The candidate ordering already settles the leftover risk of a wrong strip:
-- "Another Crab's Treasure" also reads as "treasure", but the matcher prefers
-- the longest name, and the full title is longer than any "Treasure" row.
--
-- Mirrored in src/lib/events/announcementMatch.ts, which carries the unit
-- tests. Change both together.

create or replace function public.video_segment_names_title(p_segment text, p_name text)
returns boolean
language sql
immutable
parallel safe
as $$
  select case
    when p_segment = '' then false
    when p_segment = p_name then true
    -- Prefix, at a word boundary: "blade" must not match inside "stellar
    -- blade", nor "hero" inside "heroes".
    when left(p_segment, length(p_name) + 1) <> p_name || ' ' then false
    else substr(p_segment, length(p_name) + 2) ~
      ('^((season|series|part|chapter|volume|vol|episode|ep) [0-9]+ ?'
       || '|(official|final|new|first|look|special|sneak|peek|trailer|teaser|reveal'
       || '|launch|announcement|announce|release|date|gameplay|overview|clip|featurette'
       || '|preview|extended|spot|promo|full|out|now|available|streaming|video|games|game'
       || '|hd|uhd|4k|ps5|ps4|xbox|pc|switch|steam|nintendo) ?)*$')
  end;
$$;

comment on function public.video_segment_names_title(text, text) is
  'Does this normalised segment lead with the name and stack only ceremony after it?';

create or replace function public.video_title_match_is_credible(p_video text, p_title text)
returns boolean
language sql
immutable
parallel safe
as $$
  with seg as (
    select
      -- Bracketed asides are ceremony wherever they sit: "[In the Studio]",
      -- and a Bandai upload is one long 【…】「…」 stack.
      regexp_replace(
        (regexp_split_to_array(coalesce(p_video, ''), '\||–|—|\s-\s'))[1],
        '[\[\(\{【「][^\]\)\}】」]*[\]\)\}】」]', ' ', 'g'
      ) as raw,
      public.normalize_match_text(p_title) as name
  )
  select case
    -- Nothing to judge: an unnamed title is a data gap, not a bad match.
    when seg.name = '' then true
    else public.video_segment_names_title(public.normalize_match_text(seg.raw), seg.name)
      or public.video_segment_names_title(
           public.normalize_match_text(
             regexp_replace(
               seg.raw,
               '^(?!(it|he|she|they|we|you|there|that|this|here|who|what|let)[''’]s\s)'
               || '([a-z0-9]+ )?[a-z0-9]+([''’]s|s[''’])\s+',
               '', 'i'
             )
           ),
           seg.name)
  end
  from seg;
$$;

comment on function public.video_title_match_is_credible(text, text) is
  'Does this catalogue title credibly name what the video is about? Mirrors src/lib/events/announcementMatch.ts.';

-- Re-judge. A verdict can only have moved for a video whose first segment
-- carries a possessive — with none, both readings are the text as written, and
-- the previous migration already settled it. Rows that went NULL under the old
-- strip are back in scope, which is how "No Man's Sky" finds itself again.
update public.channel_videos cv
set title_id = public.match_title_for_video(cv.title)
where cv.matched_at is not null
  and (regexp_split_to_array(coalesce(cv.title, ''), '\||–|—|\s-\s'))[1] ~ '[''’]s\s|s[''’]\s'
  and cv.title_id is distinct from public.match_title_for_video(cv.title);

-- Promotions that no longer agree with the row they came from.
delete from public.title_videos tv
using public.channel_videos cv
where tv.id = 'yt:' || cv.id
  and (cv.title_id is null or cv.title_id <> tv.title_id);
