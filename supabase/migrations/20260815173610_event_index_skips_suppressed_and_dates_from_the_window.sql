-- The index was counting editions that no page will render, and naming years
-- after a URL segment.
--
-- SUPPRESSED. get_event_hub and get_event_edition both learned to skip
-- suppressed rows; this one did not, so the index still advertised "Emerald City
-- Comic Con — 9 editions" when two of the nine are a cancellation and an October
-- window where no such convention has ever been held. A count on a card has to
-- match the list it opens.
--
-- YEARS. first_year/last_year came from min/max(edition_slug), which is a URL
-- segment, not a date. It carries a month when a year holds two shows, so the
-- Nintendo Direct tile read "8 editions · 2020-01–2026". The window is the fact;
-- the slug is an address.
--
-- `latest` also has to skip suppressed rows — it feeds the curve and the
-- readership figures on the card, and a suppressed window is by definition the
-- wrong one to show.

create or replace function public.get_event_index()
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  with live_now as (select slug from public.get_live_events()),
  agg as (
    select e.slug,
           count(*)::int as editions,
           to_char(min(e.live_from), 'YYYY') as first_year,
           to_char(max(e.live_from), 'YYYY') as last_year,
           max(e.peak) as best_peak,
           max(e.spike_ratio) as best_spike,
           mode() within group (order by extract(month from e.live_from)::int) as typical_month
    from public.event_editions e
    where e.suppressed_reason is null
    group by e.slug
  ),
  latest as (
    select distinct on (e.slug)
           e.slug, e.edition_slug, e.live_from, e.live_to, e.views_daily,
           e.spike_ratio, e.peak
    from public.event_editions e
    where e.suppressed_reason is null
    order by e.slug, e.live_from desc
  ),
  caught as (
    select jsonb_build_object(
      'slug', w.slug, 'headline', w.headline, 'accent', w.accent,
      'is_live', (w.slug in (select slug from live_now)),
      'editions', a.editions,
      'first_year', a.first_year, 'last_year', a.last_year,
      'best_peak', a.best_peak, 'best_spike', a.best_spike,
      'typical_month', a.typical_month,
      'live_from', l.live_from, 'live_to', l.live_to,
      'spike_ratio', l.spike_ratio, 'peak', l.peak,
      'views_daily', l.views_daily
    ) as x,
    (w.slug in (select slug from live_now)) as is_live,
    a.typical_month as month,
    a.best_spike as best
    from public.watched_events w
    join agg a on a.slug = w.slug
    join latest l on l.slug = w.slug
    where w.enabled and w.approval <> 'rejected'
  ),
  watching as (
    -- "Watched, nothing caught yet" now also covers an event whose only rows are
    -- suppressed, which would otherwise vanish from the page entirely.
    select jsonb_build_object('slug', w.slug, 'headline', w.headline) as x,
           w.headline as sort_name
    from public.watched_events w
    where w.enabled
      and not exists (
        select 1 from public.event_editions e
        where e.slug = w.slug and e.suppressed_reason is null
      )
  )
  select jsonb_build_object(
    -- Calendar order, loudest first inside a month. The client groups by
    -- quarter; sorting here means it never has to.
    'events', coalesce((select jsonb_agg(x order by is_live desc, month, best desc nulls last) from caught), '[]'::jsonb),
    'watching', coalesce((select jsonb_agg(x order by sort_name) from watching), '[]'::jsonb),
    'watched', (select count(*) from public.watched_events where enabled)
  );
$function$;
