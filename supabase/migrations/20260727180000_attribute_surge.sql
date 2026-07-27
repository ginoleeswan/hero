-- attribute_surge — why a character started being read.
--
-- Design: docs/superpowers/specs/2026-07-27-event-attribution-design.md
--
-- The database holds both halves of a causal pair and never joined them: what
-- the industry published (title_videos.published_at, comic_issues.store_date,
-- watched_events.live_from) and what audiences then read (heroes.views_daily,
-- reduced to a breakout date by surge_started_at). Measured 2026-07-27:
--
--   Doctor Doom  breakout 07-20  <-  Avengers: Doomsday trailer      07-20 (lag 0)
--   He-Man       breakout 07-22  <-  Masters of the Universe teaser  07-20 (lag 2)
--
-- Doom's curve breaks on exactly the day the trailer published. Nothing told the
-- detector that — it inferred the date from attention, and TMDB supplied the
-- other independently.
--
-- Three rules, each from a way the naive version failed:
--
--   1. CHARACTER-LEVEL, not publisher-level. Matching on publisher attributed a
--      DC surge to Resident Evil, Look Back and LEGO ONE PIECE during SDCC week,
--      because a title's cast spans publishers and `LIKE` over an aggregated cast
--      string matches nearly anything.
--   2. CAUSES PRECEDE EFFECTS. A symmetric abs(lag) <= 3 window happily blamed a
--      surge on a trailer that dropped two days after it.
--   3. EXACTLY ONE. In a busy week many causes qualify; nearest-preceding wins,
--      tie-broken by magnitude.
--
-- A live event is a fallback only. A convention is a plausible explanation for
-- everything at once, which is precisely what makes it a weak one.

create or replace function public.attribute_surge(p_hero_id text, p_breakout date)
returns table (
  cause_kind text,
  cause_id text,
  cause_label text,
  cause_date date,
  lag_days integer,
  confidence text
)
language sql
stable
security definer
set search_path = public
as $$
  with linked as (
    -- Trailers the hero is ACTUALLY in.
    select
      'trailer'::text as k,
      t.id as cid,
      t.title as clabel,
      v.published_at::date as cdate,
      (p_breakout - v.published_at::date)::integer as lag,
      -- A full trailer outranks a teaser on the same day.
      case when v.type = 'Trailer' then 2 else 1 end as magnitude
    from public.title_videos v
    join public.titles t on t.id = v.title_id
    join public.hero_media_appearances a
      on a.title_id = t.id and a.hero_id = p_hero_id
    where v.published_at is not null
      and v.type in ('Trailer', 'Teaser')
      and coalesce(v.official, true)
      and v.published_at::date <= p_breakout
      and p_breakout - v.published_at::date <= 4

    union all

    -- Issues the hero is actually in. Casts are ComicVine-verified as of
    -- 20260727120000, so this is a real credit rather than a roster guess.
    select
      'issue'::text,
      i.id,
      i.volume_name || coalesce(' #' || i.issue_number, ''),
      i.store_date,
      (p_breakout - i.store_date)::integer,
      1
    from public.comic_issues i
    join public.comic_issue_appearances ca
      on ca.issue_id = i.id and ca.hero_id = p_hero_id
    where i.store_date is not null
      and i.store_date <= p_breakout
      and p_breakout - i.store_date <= 4
  ),
  best_linked as (
    select k, cid, clabel, cdate, lag from linked
    order by lag asc, magnitude desc
    limit 1
  ),
  fallback as (
    select 'live_event'::text as k, w.slug as cid, w.headline as clabel,
           w.live_from as cdate, (p_breakout - w.live_from)::integer as lag
    from public.watched_events w
    where w.verdict = 'live'
      and w.live_from is not null
      and p_breakout >= w.live_from
      and p_breakout <= coalesce(w.live_to, w.live_from) + 1
    order by w.spike_ratio desc nulls last
    limit 1
  ),
  chosen as (
    select * from best_linked
    union all
    select * from fallback where not exists (select 1 from best_linked)
  )
  select
    k, cid, clabel, cdate, lag,
    -- `high` only when a character-linked cause sits within two days. Everything
    -- else is `low`, and the client phrases it more loosely.
    case when k <> 'live_event' and lag <= 2 then 'high' else 'low' end
  from chosen
  limit 1;
$$;
grant execute on function public.attribute_surge(text, date)
  to anon, authenticated, service_role;
