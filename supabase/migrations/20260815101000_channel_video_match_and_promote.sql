-- Match ingested channel videos to titles, and promote the real trailers.
--
-- Split from the ingest deliberately: the edge function's whole job becomes
-- "fetch XML, write rows", and every judgement lives here in SQL where it can be
-- inspected and re-run over history without re-fetching anything.
--
-- Two-stage on purpose, because matching and promoting have different tolerances
-- for being wrong:
--
--   * MATCHING is cheap to get wrong. `channel_videos.title_id` is a record, and
--     a mis-attached record is a bad row in a table nobody renders yet.
--   * PROMOTING is expensive to get wrong. A row in `title_videos` goes straight
--     into the Pulse rail as "New trailer", so a bad promotion is a false claim
--     on the front page.
--
-- The live example: Marvel posted "The X-Men are coming to the MCU." during D23.
-- The longest-substring matcher attaches that to X-Men (2000), which is a
-- perfectly reasonable guess and completely wrong — it is about an unannounced
-- future film. Promotion therefore demands two more things that this video fails
-- and a real trailer passes: the video must be SHAPED like a trailer, and the
-- title it matched must be one that could still be getting trailers.
--
-- Without the recency guard the failure is loud: "New trailer — X-Men" on the
-- rail, for a film from 2000.

create or replace function public.match_channel_videos()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_matched  integer;
  v_promoted integer;
begin
  -- Match once per video. `matched_at` marks the attempt, not the success, so a
  -- video we genuinely cannot place is not retried on every sweep forever.
  with m as (
    update public.channel_videos cv
    set title_id   = public.match_title_for_video(cv.title),
        matched_at = now()
    where cv.matched_at is null
    returning 1
  )
  select count(*) into v_matched from m;

  with p as (
    insert into public.title_videos
      (id, title_id, key, site, type, name, official, published_at, first_seen_at)
    select
      'yt:' || cv.id,
      cv.title_id,
      cv.id,
      'YouTube',
      case when cv.title ~* '\yteaser\y' then 'Teaser' else 'Trailer' end,
      cv.title,
      ch.official,
      cv.published_at,
      now()
    from public.channel_videos cv
    join public.media_channels ch on ch.id = cv.channel_id
    join public.titles t on t.id = cv.title_id
    where cv.title_id is not null
      -- Shaped like a trailer. A D23 sizzle clip or a cast interview is news but
      -- it is not a trailer, and the rail's copy says "New trailer".
      and cv.title ~* '(official trailer|final trailer|new trailer|teaser|first look|special look|sneak peek)'
      -- ...and matched to something that could still BE getting a trailer.
      and (
        t.release_date is null
        or t.release_date >= current_date - 365
        or (t.details->>'status') in ('Returning Series', 'In Production', 'Planned', 'Pilot')
      )
    on conflict (id) do nothing
    returning 1
  )
  select count(*) into v_promoted from p;

  return jsonb_build_object('matched', v_matched, 'promoted', v_promoted);
end;
$$;

revoke all on function public.match_channel_videos() from public, anon, authenticated;
