-- One read for the state of the events pipeline.
--
-- Publishing used to require a human: a detected event sat at approval='pending'
-- until someone flipped it. 20260815080000 inverted that, which was right — the
-- gate was unreachable and D23 sat unpublished through its own weekend — but it
-- inverts the FAILURE MODE too. It used to be "nothing ever publishes", which is
-- silent and safe. It is now "something wrong publishes and nobody notices",
-- which is silent and not safe.
--
-- A veto is only a control if someone can see what it would be vetoing. There is
-- no admin surface for watched_events or media_channels at all — the approval
-- RPCs exist and nothing calls them — so this is the read that makes the veto
-- real rather than theoretical.
--
-- Deliberately ONE call returning three lists. The command center learned this
-- already: three tabs gated on one catalog_health() RPC went from 5.2s to 76ms,
-- and a panel that fans out is a panel that renders at the speed of its slowest
-- query.
--
-- What each list is FOR:
--   events    — what the detector currently believes, and how stale that belief
--               is. `checked_at` is the honest freshness signal; verdict alone
--               cannot tell you the sync died three hours ago.
--   channels  — which feeds have gone quiet. A channel with a stale last_video_at
--               is either genuinely dormant or silently broken, and the only way
--               to tell them apart is to look.
--   editions  — what has actually been archived, which is the thing that cannot
--               be recovered if the freeze ever stops working.

create or replace function public.admin_events_health()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', w.slug,
        'headline', w.headline,
        'verdict', w.verdict,
        'approval', w.approval,
        'enabled', w.enabled,
        'spike_ratio', w.spike_ratio,
        'peak', w.peak,
        'edits_recent', w.edits_recent,
        'shape', w.shape,
        'live_from', w.live_from,
        'live_to', w.live_to,
        'ongoing', w.ongoing,
        'checked_at', w.checked_at,
        'first_detected_at', w.first_detected_at,
        -- Whether it is ON THE RAIL right now, which is the only question that
        -- matters for a veto and is not answerable from verdict alone (the grace
        -- window and the rejection flag both apply).
        'is_live', exists (select 1 from public.get_live_events() le where le.slug = w.slug),
        'editions', (select count(*) from public.event_editions e where e.slug = w.slug)
      ) order by
        -- Live first, then loudest: the rows that can embarrass you, in order.
        (exists (select 1 from public.get_live_events() le where le.slug = w.slug)) desc,
        w.spike_ratio desc nulls last)
      from public.watched_events w
    ), '[]'::jsonb),

    'channels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'official', c.official,
        'enabled', c.enabled,
        'checked_at', c.checked_at,
        'last_video_at', c.last_video_at,
        'videos', (select count(*) from public.channel_videos v where v.channel_id = c.id),
        'matched', (select count(*) from public.channel_videos v
                    where v.channel_id = c.id and v.title_id is not null)
      ) order by c.last_video_at desc nulls first)
      from public.media_channels c
    ), '[]'::jsonb),

    'editions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', e.slug,
        'edition_slug', e.edition_slug,
        'headline', e.headline,
        'live_from', e.live_from,
        'live_to', e.live_to,
        'spike_ratio', e.spike_ratio,
        'movers', jsonb_array_length(e.surges),
        'frozen_at', e.frozen_at
      ) order by e.live_from desc)
      from public.event_editions e
    ), '[]'::jsonb),

    'generated_at', now()
  );
$$;

-- Admin-only, like every other admin_* reader here.
revoke all on function public.admin_events_health() from public, anon;
grant execute on function public.admin_events_health() to authenticated;
