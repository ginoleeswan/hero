-- For TV, the premiere date is not evidence that a show is over.
--
-- The promotion guard asks whether the matched title "could still be getting a
-- trailer", and answered it with `release_date >= current_date - 365`. For a
-- film that is exactly right: a release date is when the work came out, so an
-- old one means the marketing is long finished. For television it is the
-- opposite of informative -- `titles.release_date` holds TMDB's `first_air_date`,
-- the day the series BEGAN, which says nothing at all about whether more of it
-- is coming. This is the same mistake sync-title-videos made in its window
-- (20260815090000 / the Ahsoka fix), reappearing one stage further down.
--
-- It bit immediately. Disney+ posted the Percy Jackson season-3 teaser during
-- D23; the series was discovered, minted and matched correctly, and then refused
-- promotion because the show first aired in 2023. `details->>'status'` would
-- have rescued it -- the series is 'Returning Series' -- but a freshly discovered
-- row is thin and has no details until the enrich drain reaches it, so the guard
-- was reading a field that structurally cannot be populated yet for exactly the
-- titles that need it most.
--
-- So: for `media_type = 'tv'`, drop the date test. The remaining guards still do
-- real work -- the video must be trailer-SHAPED, and it must have matched a title
-- at all -- and the video itself is one of a channel's 15 most recent uploads, so
-- it is current by construction. A studio posting a brand-new official trailer
-- for a show that genuinely ended is not a failure mode worth protecting against.
--
-- Films keep the date test unchanged, which is what still blocks the two known
-- false positives: "The X-Men are coming to the MCU." (X-Men, 2000) and the
-- Vision Quest video that resolves to the 1985 film.

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
      and cv.title ~* '(official trailer|final trailer|new trailer|teaser|first look|special look|sneak peek)'
      and (
        -- TV: the premiere date is not evidence of anything. See header.
        t.media_type = 'tv'
        or t.release_date is null
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
