-- A backfilled edition must be able to gain movers on a later sweep.
--
-- apply_backfilled_movers only wrote to editions whose surge list was EMPTY.
-- That was right on the first pass and wrong on every one after it: the hero
-- sweep runs in fame order across many invocations, so an edition that picked up
-- one mover early was sealed at one mover forever, no matter how many characters
-- were swept afterwards. 29 of the 137 backfilled editions were sitting between
-- one and five movers for exactly this reason.
--
-- The condition becomes "the reconstruction is bigger than what is stored". A
-- rebuild from the same hits is a no-op, and more hits means more movers.
--
-- Two things it still must not touch:
--   A LIVE FREEZE. first_detected_at marks an edition caught while it was
--     running, whose movers were measured against a 27-day window at the time.
--     That is better evidence than any reconstruction and is never overwritten.
--   AN EVENT'S AFFINITY. Unchanged, and the reason a Nintendo Direct no longer
--     lists Pennywise.
--
-- The portrait also resolves avatar-first here, to match the read paths.

create or replace function public.apply_backfilled_movers()
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
    set surges = (
      select coalesce(jsonb_agg(v), '[]'::jsonb)
      from (select v from jsonb_array_elements(r.movers) v limit 12) s
    )
    from ranked r
    where e.slug = r.slug
      and e.edition_slug = r.edition_slug
      -- Never a live freeze: it measured its own movers as they happened.
      and e.first_detected_at is null
      -- Grow only. A rebuild from the same hits changes nothing.
      and least(jsonb_array_length(r.movers), 12) > jsonb_array_length(e.surges)
    returning 1
  )
  select count(*) into v_updated from upd;

  return jsonb_build_object('editions_filled', v_updated);
end;
$function$;

revoke all on function public.apply_backfilled_movers() from public, anon, authenticated;
