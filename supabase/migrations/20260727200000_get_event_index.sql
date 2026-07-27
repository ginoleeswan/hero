-- get_event_index — every event that has a page.
--
-- Design: docs/superpowers/specs/2026-07-27-pulse-reach-design.md §3
--
-- Fixes a discovery gap the dossier page shipped with. The only route to
-- /event/[slug] was the live card in the Pulse rail, and that card disappears
-- when the detection grace lapses — three days after the window closes. The page
-- is permanent by construction; its only link was not. Without this, SDCC 2026
-- would have become a URL nobody could reach from inside the app this week.
--
-- Approved events only, same as the dossier: the gate is what stops a false
-- positive minting a public artefact.
--
-- `watched` is returned alongside so the page can be honest about the shape of
-- the thing — twenty events are polled twice an hour and most have never fired.
-- An index that shows one row without saying that reads like a broken feature
-- rather than a quiet one.

create or replace function public.get_event_index()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with live_now as (
    select slug from public.get_live_events()
  ),
  rows as (
    select jsonb_build_object(
      'slug', w.slug,
      'headline', w.headline,
      'accent', w.accent,
      'live_from', w.live_from,
      'live_to', w.live_to,
      'ongoing', w.ongoing,
      'spike_ratio', w.spike_ratio,
      'peak', w.peak,
      'is_live', (w.slug in (select slug from live_now)),
      'views_daily', w.views_daily
    ) as x, w.live_from as sort_from
    from public.watched_events w
    where w.enabled
      and w.approval = 'approved'
      and w.live_from is not null
  )
  select jsonb_build_object(
    -- Newest first: an index of events is a reverse chronology, not a list.
    'events', coalesce((select jsonb_agg(x order by sort_from desc) from rows), '[]'::jsonb),
    'watched', (select count(*) from public.watched_events where enabled)
  );
$$;
grant execute on function public.get_event_index()
  to anon, authenticated, service_role;
