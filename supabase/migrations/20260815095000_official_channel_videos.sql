-- Official-channel video feeds — the source that is actually fast.
--
-- Why a second video source at all: TMDB is community-maintained, and on
-- 2026-08-15, hours into D23, it had no Avengers: Doomsday "Special Look", no
-- Ahsoka season-2 trailer and no VisionQuest trailer. The sweep was correct and
-- current and still had nothing, because you cannot sweep your way to data the
-- source does not hold. YouTube had the Doomsday Special Look at 04:06 UTC, on
-- Marvel's own channel, four hours before we went looking.
--
-- Why RSS and not the YouTube Data API: `youtube.com/feeds/videos.xml?channel_id=`
-- needs no API key, has no quota, and returns the 15 most recent uploads with
-- exact publish timestamps. At an hourly sweep, 15 is a wide margin. The Data
-- API would need a GCP key, a quota budget and a rotation story to deliver the
-- same 15 rows. There is no version of this that is worth a credential.
--
-- Every channel_id below was resolved by FETCHING the feed and reading back the
-- channel name it returned, not by pattern-matching a URL. Two of the first
-- guesses were wrong in the quiet way: one 404'd behind a page that still had a
-- <title> tag, and one belonged to KinoCheck rather than the studio it was
-- labelled with. A wrong id here is a channel that is simply never heard from,
-- which is the same failure mode as a wrong enwiki_title in watched_events, so
-- the names stored here are the ones YouTube gave back.

create table if not exists public.media_channels (
  -- YouTube's channel id, the RSS feed's only parameter.
  id          text primary key,
  name        text not null,
  slug        text not null unique,
  -- Studio/publisher channels speak for the property; press channels are fast
  -- and useful but are not the rights holder, so downstream can prefer official.
  official    boolean not null default true,
  enabled     boolean not null default true,
  checked_at  timestamptz,
  -- Newest publish time seen, so a silently-dead feed is visible as a stale row
  -- rather than as an absence of news.
  last_video_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.channel_videos (
  -- YouTube's video id.
  id           text primary key,
  channel_id   text not null references public.media_channels(id) on delete cascade,
  title        text not null,
  description  text,
  thumbnail_url text,
  published_at timestamptz not null,
  -- Resolved against titles by longest-substring match; null means "we heard it
  -- but cannot attach it to anything in the catalogue yet". Deliberately kept
  -- rather than discarded: an unmatched announcement is still a record of what
  -- happened during an event window, which is what the event pages will need.
  title_id     text references public.titles(id) on delete set null,
  matched_at   timestamptz,
  first_seen_at timestamptz not null default now()
);

create index if not exists channel_videos_published_idx
  on public.channel_videos (published_at desc);
create index if not exists channel_videos_title_idx
  on public.channel_videos (title_id, published_at desc)
  where title_id is not null;

-- RLS on with a public read policy on both: without one, anon reads zero rows
-- and every downstream RPC returns an empty list with no error at all.
alter table public.media_channels enable row level security;
alter table public.channel_videos enable row level security;

drop policy if exists media_channels_public_read on public.media_channels;
create policy media_channels_public_read on public.media_channels
  for select to anon, authenticated using (true);

drop policy if exists channel_videos_public_read on public.channel_videos;
create policy channel_videos_public_read on public.channel_videos
  for select to anon, authenticated using (true);

-- ── matching ────────────────────────────────────────────────────────────────
-- "Avengers: Doomsday | Special Look | In Theaters December 18" has to become
-- tmdb:1003596. Longest catalogue title contained in the video title wins:
-- longest because "Avengers" and "Avengers: Doomsday" both match and only one of
-- them is right. The length floor exists because short titles ("It", "Up",
-- "Us") appear inside ordinary English and would otherwise match everything.
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
  order by length(t.title) desc, t.release_date desc nulls last
  limit 1;
$$;

insert into public.media_channels (id, name, slug, official) values
  ('UCvC4D8onUfXzvjTOM-dBfEA', 'Marvel Entertainment',        'marvel',          true),
  ('UCZGYJFUizSax-yElQaFDp5Q', 'Star Wars',                   'star-wars',       true),
  ('UCiifkYAs_bq1pt_zbNAzYGg', 'DC',                          'dc',              true),
  ('UCjmJDM5pRKbUlVIzDYYWb6g', 'Warner Bros.',                'warner-bros',     true),
  ('UCz97F7dMxBNOfGYu3rx8aCw', 'Sony Pictures Entertainment', 'sony-pictures',   true),
  ('UCWOA1ZGywLbqmigxE4Qlvuw', 'Netflix',                     'netflix',         true),
  ('UCQJWtTnAHhEG5w4uN0udnUQ', 'Prime Video',                 'prime-video',     true),
  ('UCIrgJInjLS2BhlHOMDW7v0g', 'Disney Plus',                 'disney-plus',     true),
  ('UC2-BeLxzUBSs0uSrmzWhJuQ', '20th Century Studios',        'twentieth-century', true),
  ('UCF9imwPMSGz4Vq1NiTWCC7g', 'Paramount Pictures',          'paramount',       true),
  ('UCVTQuK2CaWaTgSsoNkn5AiQ', 'HBO',                         'hbo',             true),
  ('UCJ6nMHaJPZvsJ-HmUmj1SeA', 'Lionsgate Movies',            'lionsgate',       true),
  ('UCGIY_O-8vW4rfX98KlMkvRg', 'Nintendo of America',         'nintendo',        true),
  ('UC-2Y8dQb0S6DtpxNgAKoJKA', 'PlayStation',                 'playstation',     true),
  ('UCjBp_7RuDBUYbd1LegWEJ8g', 'XBOX',                        'xbox',            true),
  ('UCKy1dAqELo0zrOtPkf0eTMw', 'IGN',                         'ign',             false)
on conflict (id) do nothing;
