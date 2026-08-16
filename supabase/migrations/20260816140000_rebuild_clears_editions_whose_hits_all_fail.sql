-- rebuild_backfilled_movers had two holes, and both left bad rows in place while
-- reporting success.
--
-- 1. AFFINITY-FILTERED EDITIONS WERE NEVER CLEARED. The `cleared` branch fired
--    only when an edition had NO hits at all. But an edition can have plenty of
--    hits and still produce no movers, because the publisher affinity filter
--    removes them afterwards: nintendo-direct/2026's hits are He-Man, Battle Cat
--    and Beast-Man, all Mattel, and Nintendo Direct only accepts Nintendo. So it
--    appeared in neither `ranked` nor `cleared`, and kept "Luigi 516x" — a
--    figure produced by the redirect-baseline bug this whole rewrite existed to
--    remove. The test is now "did `ranked` produce a row for this edition",
--    which is the actual question.
--
-- 2. THE LIVE-FREEZE EXEMPTION IS DROPPED. It was there because a live freeze
--    "measured its own movers as they happened, against a 27-day window at the
--    time. That is better evidence than any reconstruction." That argument is
--    no longer true: the live lane divides by the same collapsed baseline, so
--    sdcc/2026 was showing Yelena Belova at 485.6x on an article that averages
--    five views a day. Better evidence than a reconstruction only holds when the
--    evidence is better, and here the reconstruction has guards the live path
--    does not.

create or replace function public.rebuild_backfilled_movers()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare v_updated integer := 0;
begin
  with ranked as (
    select h.slug, h.edition_slug,
           jsonb_agg(
             jsonb_build_object(
               'hero_id', x.id, 'name', x.name, 'publisher', x.publisher,
               'portrait_url', coalesce(x.avatar_url, x.portrait_url, x.image_url),
               'spike', round(h.spike, 1), 'pageviews_week', h.peak,
               'fame_score', x.fame_score,
               'weight', round(public.pulse_face_weight(x.fame_score, h.spike), 1)
             )
             order by public.pulse_face_weight(x.fame_score, h.spike) desc
           ) as movers
    from public.edition_mover_hits h
    join public.heroes x on x.id = h.hero_id
    join public.watched_events w on w.slug = h.slug
    where (x.avatar_url is not null or x.portrait_url is not null or x.image_url is not null)
      and (w.publishers is null or x.publisher = any (w.publishers))
    group by h.slug, h.edition_slug
  ),
  upd as (
    update public.event_editions e
    set surges = coalesce((
      select coalesce(jsonb_agg(v), '[]'::jsonb)
      from (select v from jsonb_array_elements(r.movers) v limit 12) s
    ), '[]'::jsonb)
    from ranked r
    where e.slug = r.slug and e.edition_slug = r.edition_slug
    returning 1
  ),
  cleared as (
    update public.event_editions e
    set surges = '[]'::jsonb
    where jsonb_array_length(coalesce(e.surges, '[]'::jsonb)) > 0
      and not exists (
        select 1 from ranked r
        where r.slug = e.slug and r.edition_slug = e.edition_slug
      )
    returning 1
  )
  select (select count(*) from upd) + (select count(*) from cleared) into v_updated;

  return jsonb_build_object('editions_rebuilt', v_updated);
end;
$function$;

revoke all on function public.rebuild_backfilled_movers() from public, anon, authenticated;
