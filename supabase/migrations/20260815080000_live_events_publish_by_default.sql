-- Live events publish themselves; approval becomes a veto, not a prerequisite.
--
-- The original gate (20260726150000_watched_events.sql) required an admin to
-- flip `approval` to 'approved' before an event could reach Explore. Its stated
-- reason: "a false positive would re-skin the whole front page. That shouldn't
-- ride on thresholds tuned against two samples." Both halves have since expired.
--
--   * The re-skin doesn't exist. Takeover mode was §8 step 5 of the design and
--     was never built. A live event today pins one card in the Pulse rail and
--     sets the RightNowBand freshness label. That is the entire blast radius.
--
--   * There is no admin surface for the gate and no notification when a row goes
--     live, so `pending` never meant "awaiting review" — it meant "no", forever.
--     D23 2026 was detected `live` at 00:07 UTC on 2026-08-15 at 3.37x baseline
--     and sat unpublished through the event. A control nobody can reach is an
--     off switch, not a safety mechanism.
--
--   * The detector has earned more than two samples. The full run on 2026-08-15:
--     `d23` live at 3.37x, `summer-game-fest` held at `watch` despite a LOUDER
--     5.01x spike (the EDITS_ABS_MIN veto doing its job), and the other 18 rows
--     idle between 0.98x and 1.61x. The `live` verdict needs both signals to
--     clear (src/lib/events/detect.ts) and the watch list is a closed allowlist
--     of 20 hand-resolved conventions, so the worst reachable false positive is
--     a real convention announced a day early -- which the window grace retires
--     on its own.
--
-- The asymmetry decides it: a false positive is a card that self-corrects within
-- a day, while a false negative is a "Right Now" rail that sits silent through
-- the news it exists to carry. Staleness is both the worse failure and the
-- invisible one -- it raises no error, it just looks like a dead app.
--
-- So: control moves from the instance to the policy. The editorial judgement
-- already happened when the watch list was curated and each enwiki_title was
-- hand-resolved; re-approving each firing is re-making a decision that was
-- already made, against evidence the detector already weighed. 'rejected' stays
-- as a one-row kill switch, and `admin_set_watched_event_approval` still sets
-- it. Everything else -- the two-signal AND, MIN_PEAK_VIEWS, and the live_to
-- grace that retires a finished event -- is unchanged.
--
-- A human gate is still right for the irreversible: push notifications must stay
-- gated and volume-capped when they land. Displaying a card is not that.

create or replace function public.get_live_events()
returns table (
  slug text,
  headline text,
  blurb text,
  accent text,
  shape text,
  spike_ratio numeric,
  live_from date,
  live_to date,
  ongoing boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select w.slug, w.headline, w.blurb, w.accent,
         w.shape, w.spike_ratio, w.live_from, w.live_to, w.ongoing
  from public.watched_events w
  where w.enabled
    and w.approval <> 'rejected'
    and w.verdict = 'live'
    and w.live_from is not null
    and current_date >= w.live_from
    and current_date <= coalesce(w.live_to, current_date)
                        + (case when w.ongoing then 3 else 1 end)
  order by w.spike_ratio desc nulls last
  limit 4;
$$;

-- The index backing the reader still leads with (verdict, approval); an
-- inequality on approval reads it fine, and the table is 20 rows regardless.

comment on function public.get_live_events() is
  'Approved-unless-rejected live events for the Pulse rail. Approval is a veto, '
  'not a prerequisite -- see the migration header for why the opt-in gate was '
  'inverted. Push notifications must keep their own gate.';
