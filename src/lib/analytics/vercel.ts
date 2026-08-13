// src/lib/analytics/vercel.ts — the WEB sink, moved here intact from the old
// src/lib/analytics.ts so the front door in ./index.ts can dispatch to it.
//
// Behaviour is unchanged on purpose: same Vercel custom-event stream, same
// first-touch attribution tagging, same names. Only the caller changed.
import { track as vercelTrack } from '@vercel/analytics';
import { attributionEventProps, getAttribution } from '../attribution';

/** Vercel only accepts flat primitive properties. */
type EventProps = Record<string, string | number | boolean | null>;

export function trackWeb(name: string, props?: Record<string, unknown>): void {
  try {
    // Tag every event with the first-touch marketing source (utm_source/medium/
    // campaign) so the dashboard can break the funnel down by campaign.
    // Explicit call-site props win on any key collision.
    vercelTrack(name, {
      ...attributionEventProps(getAttribution()),
      ...(props as EventProps),
    });
  } catch {
    // Analytics must never break the user action that triggered it.
  }
}
