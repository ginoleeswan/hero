import { supabase } from '../supabase';
import type { EventShape } from '../events/detect';

// Live real-world events (SDCC, a Nintendo Direct) detected from Wikipedia
// attention rather than read from a calendar — see
// supabase/migrations/20260726150000_watched_events.sql for why there is no
// calendar to read. get_live_events only ever returns rows an admin approved, so
// nothing here can re-skin Explore off a threshold alone.

export interface LiveEvent {
  slug: string;
  headline: string;
  blurb: string | null;
  /** Hex accent driving the takeover skin; null → brand orange. */
  accent: string | null;
  /** `sustained` while the event is in progress; the others mean it's fading. */
  shape: EventShape | null;
  /** Peak recent pageviews ÷ the article's median — how loud this event is. */
  spikeRatio: number | null;
  liveFrom: string | null;
  liveTo: string | null;
  /** True while the elevated run still reaches the newest day of data, i.e. the
   *  event probably hasn't finished (pageviews lag reality by 1-2 days). */
  ongoing: boolean;
}

interface LiveEventRow {
  slug: string;
  headline: string;
  blurb: string | null;
  accent: string | null;
  shape: string | null;
  spike_ratio: number | string | null;
  live_from: string | null;
  live_to: string | null;
  ongoing: boolean | null;
}

const SHAPES: readonly EventShape[] = ['sustained', 'decaying', 'easing', 'flat'];

/** Flat RPC rows → LiveEvent. Exported for the explore-bundle path to share once
 *  this section folds into get_explore_bundle. */
export function mapLiveEventRows(rows: LiveEventRow[]): LiveEvent[] {
  return rows.map((r) => {
    // numeric comes back as a string over PostgREST.
    const ratio =
      typeof r.spike_ratio === 'string' ? parseFloat(r.spike_ratio) : (r.spike_ratio ?? null);
    return {
      slug: r.slug,
      headline: r.headline,
      blurb: r.blurb,
      accent: r.accent,
      shape: SHAPES.includes(r.shape as EventShape) ? (r.shape as EventShape) : null,
      spikeRatio: ratio !== null && Number.isFinite(ratio) ? ratio : null,
      liveFrom: r.live_from,
      liveTo: r.live_to,
      ongoing: r.ongoing ?? false,
    };
  });
}

/** Events running right now. Degrades to [] so a DB hiccup never errors the
 *  Explore band — an empty result is the honest "nothing is on" state. */
export async function getLiveEvents(): Promise<LiveEvent[]> {
  const { data, error } = await supabase.rpc('get_live_events');
  if (error) {
    console.warn('[getLiveEvents] error:', error.message);
    return [];
  }
  // The generated Returns type marks every column non-null — a RETURNS TABLE
  // signature carries no nullability — so widen to the row shape we actually
  // guard against before mapping.
  return mapLiveEventRows((data ?? []) as LiveEventRow[]);
}
