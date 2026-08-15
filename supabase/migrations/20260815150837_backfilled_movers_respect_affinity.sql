-- Backfilled movers must obey the same affinity as everything else.
--
-- Nintendo Direct 2026 listed its movers as Pennywise, James Gordon, Billy
-- Batson, Ghostface and Donald Duck. None of those has anything to do with a
-- Nintendo Direct. apply_backfilled_movers ranked purely on face weight and
-- never looked at watched_events.publishers — so while the live freeze and
-- get_event_dossier both filter, the historical pass wrote unfiltered movers
-- into all 127 backfilled editions.
--
-- This is the Pichu-and-Pikachu-under-D23 error again, one layer down. The
-- window alone decided who "moved" for an event, and the window is not the
-- event.
--
-- NULL publishers still means no filter, which stays correct for a general
-- convention: San Diego Comic-Con really is where everyone announces, and
-- narrowing it to one publisher would be its own kind of lie.

-- Game showcases get their publishers now, for the same reason the studio
-- events already had them. Only values that actually exist on heroes.publisher,
-- checked rather than guessed — the catalogue holds Nintendo 53, Capcom 48,
-- Square Enix 9, Sega 4.
update public.watched_events
set publishers = array['Nintendo','Capcom','Square Enix','Sega','Blizzard Entertainment','Bethesda','Ubisoft']
where slug in ('gamescom', 'summer-game-fest', 'game-awards', 'pax');

create or replace function public.apply_backfilled_movers()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare v_updated integer := 0;
begin
  with ranked as (
    select h.slug, h.edition_slug,
           jsonb_agg(
             jsonb_build_object(
               'hero_id', x.id, 'name', x.name, 'publisher', x.publisher,
               'portrait_url', coalesce(x.portrait_url, x.image_url),
               'spike', round(h.spike, 1), 'pageviews_week', h.peak,
               'fame_score', x.fame_score,
               'weight', round(public.pulse_face_weight(x.fame_score, h.spike), 1)
             )
             order by public.pulse_face_weight(x.fame_score, h.spike) desc
           ) as movers
    from public.edition_mover_hits h
    join public.heroes x on x.id = h.hero_id
    join public.watched_events w on w.slug = h.slug
    where (x.portrait_url is not null or x.image_url is not null)
      -- The affinity gate the historical pass was missing.
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
      and jsonb_array_length(e.surges) = 0
    returning 1
  )
  select count(*) into v_updated from upd;

  return jsonb_build_object('editions_filled', v_updated);
end;
$$;

revoke all on function public.apply_backfilled_movers() from public, anon, authenticated;

-- Clear the wrongly-filled editions so the corrected pass can refill them.
-- Only events that HAVE an affinity, and only editions the live freeze does not
-- own — a freeze saw its movers with better data than any reconstruction.
update public.event_editions e
set surges = '[]'::jsonb
from public.watched_events w
where w.slug = e.slug
  and w.publishers is not null
  and exists (select 1 from public.edition_mover_hits h
              where h.slug = e.slug and h.edition_slug = e.edition_slug);
