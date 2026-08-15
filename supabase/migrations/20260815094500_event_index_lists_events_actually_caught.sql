-- The event index lists events actually CAUGHT, not every article that wobbled.
--
-- `get_event_index`'s `caught` arm asked only for `live_from is not null`. Under
-- the old opt-in gate that was fine: a human had to approve a row before it
-- could appear, and the human was the real filter. Inverting the gate in
-- 20260815093000 removed that filter and left the weak condition holding the
-- door, so the index went from one event to six -- and four of the newcomers
-- (`comiket` 1.32x, `nintendo-direct` 1.35x, `eccc` 1.39x, and an SDCC row now
-- sitting at 0.82x) never reached a `live` verdict at all. `live_from` is set
-- from any contiguous run above WINDOW_ENTER, which a quiet article clears on a
-- slow news week. It marks a wobble, not an event.
--
-- `first_detected_at` is the column that means what the index needs: the sync
-- stamps it the first time a row is judged `live`, and never unsets it. So it
-- reads as "this was, at some point, a real event" and survives the event
-- ending -- which is exactly the index's job, since the index outlives the rail.
--
-- Result: {sdcc, d23}. The other eighteen keep appearing under `watching`, which
-- is the honest place for them.
--
-- Note the pairing this preserves: `watching` is the exact complement of
-- `caught`, so every enabled row appears in exactly one of the two arms and the
-- counts still add to 20. Change one arm and the other has to move with it.

create or replace function public.get_event_index()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with live_now as (select slug from public.get_live_events()),
  caught as (
    select jsonb_build_object(
      'slug', w.slug, 'headline', w.headline, 'accent', w.accent,
      'live_from', w.live_from, 'live_to', w.live_to, 'ongoing', w.ongoing,
      'spike_ratio', w.spike_ratio, 'peak', w.peak,
      'is_live', (w.slug in (select slug from live_now)),
      'views_daily', w.views_daily
    ) as x, w.live_from as sort_from
    from public.watched_events w
    where w.enabled and w.approval <> 'rejected'
      and w.live_from is not null
      and w.first_detected_at is not null
  ),
  -- Everything polled that has NOT earned a page. Returned so the index can
  -- show the shape of the thing: an index with one row and no context reads as
  -- broken, and "we are also watching these nineteen" is both true and the most
  -- interesting thing a returning visitor can be told.
  watching as (
    select jsonb_build_object('slug', w.slug, 'headline', w.headline) as x, w.headline as sort_name
    from public.watched_events w
    where w.enabled
      and not (
        w.approval <> 'rejected'
        and w.live_from is not null
        and w.first_detected_at is not null
      )
  )
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(x order by sort_from desc) from caught), '[]'::jsonb),
    'watching', coalesce((select jsonb_agg(x order by sort_name) from watching), '[]'::jsonb),
    'watched', (select count(*) from public.watched_events where enabled)
  );
$function$;
