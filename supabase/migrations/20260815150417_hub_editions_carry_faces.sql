-- The hub answers "which year should I open?" — so its rows need faces.
--
-- Eight editions of Nintendo Direct render as eight near-identical lines of
-- numbers: a year, a date, a multiple, a count. The reader has no way to tell
-- 2026 from 2021 except by reading two decimals, and nothing on the page says
-- what any of those years were ABOUT.
--
-- Every edition already stores its movers with portraits. Returning the top
-- three per edition turns each row into "2024 — Yelena Belova, X-23, Ghostface"
-- rendered as faces, which is the thing a fan actually recognises, and it turns
-- a table of measurements into a set of years worth opening. It also gives the
-- hub its first route into a character page.
--
-- Three, not more: a row is a signpost. The edition page is where the full list
-- belongs.

create or replace function public.get_event_hub(p_slug text)
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  with ev as (
    select w.* from public.watched_events w
    where w.slug = p_slug and w.enabled and w.approval <> 'rejected'
  ),
  live_now as (select slug from public.get_live_events() where slug = p_slug),
  eds as (
    select jsonb_agg(jsonb_build_object(
             'edition_slug', e.edition_slug, 'headline', e.headline,
             'live_from', e.live_from, 'live_to', e.live_to,
             'spike_ratio', e.spike_ratio, 'peak', e.peak,
             'movers', jsonb_array_length(e.surges),
             -- The faces. Already ranked by face weight when frozen, so taking
             -- the first three keeps the archive's own ordering.
             'faces', (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'hero_id', f->>'hero_id',
                        'name', f->>'name',
                        'portrait_url', f->>'portrait_url'
                      )), '[]'::jsonb)
               from (
                 select f from jsonb_array_elements(e.surges) f
                 where f->>'portrait_url' is not null
                 limit 3
               ) s
             ),
             'announcements', (
               select count(*) from public.channel_videos cv
               join public.media_channels ch on ch.id = cv.channel_id
               where cv.published_at::date between e.live_from - 1 and e.live_to + 3
                 and cv.title_id is not null
                 and (ev.channel_slugs is null or ch.slug = any (ev.channel_slugs))
             )
           ) order by e.live_from desc) as j
    from public.event_editions e, ev where e.slug = p_slug
  )
  select case when (select count(*) from ev) = 0 then null else
    jsonb_build_object(
      'slug', (select slug from ev), 'headline', (select headline from ev),
      'accent', (select accent from ev), 'blurb', (select blurb from ev),
      'enwiki_title', (select enwiki_title from ev),
      'is_live', (select count(*) > 0 from live_now),
      'live_from', (select live_from from ev), 'live_to', (select live_to from ev),
      'shape', (select shape from ev), 'spike_ratio', (select spike_ratio from ev),
      -- The loudest year, so a row can be drawn in proportion to it.
      'best_spike', (select max(spike_ratio) from public.event_editions where slug = p_slug),
      'editions', coalesce((select j from eds), '[]'::jsonb))
  end;
$$;
