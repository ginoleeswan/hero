import { Platform } from 'react-native';
import { track } from '@vercel/analytics';
import { attributionEventProps, getAttribution } from './attribution';

// Named product events sent to Vercel Web Analytics' custom-events stream, so
// the dashboard measures the funnel (sign-ups, votes, favourites) — not just
// page views. Web-only: native has no Vercel beacon and track() warns off-web,
// so we hard-gate on platform. Keep names snake_case and stable; they surface
// as event rows in the Vercel dashboard.
export type AnalyticsEvent =
  | 'sign_up'
  | 'log_in'
  | 'matchup_vote'
  | 'favourite_add'
  | 'search'
  // The sponsor/house-promo slot (see src/components/SponsorSlot.tsx): one
  // impression per mount + clicks, so the slot earns real CTR data before any
  // paid sponsor ever fills it.
  | 'sponsor_impression'
  | 'sponsor_click';

// Vercel only accepts flat primitive properties.
type EventProps = Record<string, string | number | boolean | null>;

/** Fire-and-forget custom event. No-ops off-web; never throws into the caller. */
export function trackEvent(name: AnalyticsEvent, props?: EventProps): void {
  if (Platform.OS !== 'web') return;
  try {
    // Tag every event with the first-touch marketing source (utm_source/medium/
    // campaign), so the dashboard can break the funnel down by campaign. Explicit
    // call-site props win on any key collision.
    track(name, { ...attributionEventProps(getAttribution()), ...props });
  } catch {
    // Analytics must never break the user action that triggered it.
  }
}
