-- Turn a cast announcement into character pages.
--
-- D23's biggest story was the X-Men casting, and Mythique's page offered the
-- reader exactly one link for it — to X-Men (2000). Meanwhile the studio's own
-- video description said, in plain text:
--
--     Sadie Sink is Jean Grey
--     Kit Connor is Cyclops
--     Christopher Abbott is Professor Charles Xavier
--     Samara Weaving is Emma Frost
--     Inde Navarrette is Rogue
--     Maya Boyd is Storm
--
-- Mythique has a full page for every one of those characters. This is the
-- app's own catalogue being named, by the rights holder, in a field already
-- being ingested and thrown away — and it is the one thing here no news site
-- can do, because none of them have a character encyclopedia behind the story.
--
-- Deliberately conservative. It reads only "<Actor> is <Character>" and
-- "<Actor> as <Character>" on a line of their own, both sides capitalised. That
-- is the shape studios actually use in a cast list, and it will not fire on
-- ordinary prose — "Vision is back" fails because "back" is not capitalised,
-- and a sentence spanning a line break is not a line. Missing a reveal costs a
-- section; inventing one puts a wrong character on a page about a real event.

alter table public.channel_videos
  add column if not exists cast_hero_ids text[];

comment on column public.channel_videos.cast_hero_ids is
  'Heroes named in a "<Actor> is <Character>" cast list in the video description, '
  'resolved to hero ids. Populated by match_channel_videos.';

/**
 * Character names from a studio cast list. Nothing else.
 */
create or replace function public.extract_revealed_cast(p_text text)
returns text[]
language sql
immutable
parallel safe
as $$
  select coalesce(array_agg(distinct m[1]), '{}')
  from (
    select regexp_match(
             btrim(line),
             -- "<Capitalised words> is|as <Capitalised words>", whole line.
             '^[A-Z][[:alnum:].''-]*(?:\s+[A-Z][[:alnum:].''-]*)*\s+(?:is|as)\s+([A-Z][[:alnum:].''-]*(?:\s+[A-Z][[:alnum:].''-]*){0,3})$'
           ) as m
    from regexp_split_to_table(coalesce(p_text, ''), E'\n') as line
  ) s
  where m is not null;
$$;

/**
 * Resolve those names to heroes.
 *
 * Exact name match only, most famous first when a name is shared — "Storm" and
 * "Rogue" are both held by several rows, and the famous one is the one a cast
 * announcement means. Aliases are deliberately NOT searched: this repo has
 * already measured alias matching at ~70% precision, where the failure mode is
 * routing a canonical name to a successor or variant, and a wrong face under
 * "Characters revealed" is worse than a missing one.
 */
create or replace function public.resolve_revealed_cast(p_names text[])
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(array_agg(hero_id order by fame desc nulls last), '{}')
  from (
    select distinct on (public.normalize_match_text(n))
           h.id as hero_id, h.fame_score as fame
    from unnest(coalesce(p_names, '{}')) as n
    join public.heroes h
      on public.normalize_match_text(h.name) = public.normalize_match_text(n)
    where h.portrait_url is not null or h.image_url is not null
    order by public.normalize_match_text(n), h.fame_score desc nulls last
  ) s;
$$;

-- Populate on match, so the work happens once per video rather than per read.
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
  v_cast     integer;
begin
  with m as (
    update public.channel_videos cv
    set title_id   = public.match_title_for_video(cv.title),
        matched_at = now()
    where cv.matched_at is null
    returning 1
  )
  select count(*) into v_matched from m;

  -- Cast extraction is independent of title matching: a reveal is worth having
  -- even when the video could not be attached to a title.
  with c as (
    update public.channel_videos cv
    set cast_hero_ids = public.resolve_revealed_cast(
                          public.extract_revealed_cast(cv.description))
    where cv.cast_hero_ids is null and cv.description is not null
    returning 1
  )
  select count(*) into v_cast from c;

  with p as (
    insert into public.title_videos
      (id, title_id, key, site, type, name, official, published_at, first_seen_at)
    select
      'yt:' || cv.id, cv.title_id, cv.id, 'YouTube',
      case when cv.title ~* '\yteaser\y' then 'Teaser' else 'Trailer' end,
      cv.title, ch.official, cv.published_at, now()
    from public.channel_videos cv
    join public.media_channels ch on ch.id = cv.channel_id
    join public.titles t on t.id = cv.title_id
    where cv.title_id is not null
      and cv.title ~* '(official trailer|final trailer|new trailer|teaser|first look|special look|sneak peek)'
      and (
        t.media_type = 'tv'
        or t.release_date is null
        or t.release_date >= current_date - 365
        or (t.details->>'status') in ('Returning Series', 'In Production', 'Planned', 'Pilot')
      )
    on conflict (id) do nothing
    returning 1
  )
  select count(*) into v_promoted from p;

  return jsonb_build_object('matched', v_matched, 'promoted', v_promoted, 'cast', v_cast);
end;
$$;

revoke all on function public.match_channel_videos() from public, anon, authenticated;
