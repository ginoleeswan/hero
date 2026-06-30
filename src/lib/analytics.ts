import { Platform } from 'react-native';
import { track } from '@vercel/analytics';

// Named product events sent to Vercel Web Analytics' custom-events stream, so
// the dashboard measures the funnel (sign-ups, votes, favourites) — not just
// page views. Web-only: native has no Vercel beacon and track() warns off-web,
// so we hard-gate on platform. Keep names snake_case and stable; they surface
// as event rows in the Vercel dashboard.
export type AnalyticsEvent = 'sign_up' | 'log_in' | 'matchup_vote' | 'favourite_add' | 'search';

// Vercel only accepts flat primitive properties.
type EventProps = Record<string, string | number | boolean | null>;

/** Fire-and-forget custom event. No-ops off-web; never throws into the caller. */
export function trackEvent(name: AnalyticsEvent, props?: EventProps): void {
  if (Platform.OS !== 'web') return;
  try {
    track(name, props);
  } catch {
    // Analytics must never break the user action that triggered it.
  }
}
