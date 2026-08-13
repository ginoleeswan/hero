// src/lib/analytics/index.ts — the one front door for product events.
//
// There were two systems in the making here and that is the failure mode this
// module exists to avoid. `src/lib/analytics.ts` already sent named events to
// Vercel, web-only; native sent nothing. Adding PostHog beside it would have
// left two vocabularies, two `track` functions and two answers to "how many
// people voted today" — the exact accretion the taxonomy is meant to stop.
//
// So: ONE call, `track(event, props)`, typed against EventMap, dispatched to
// whichever sink the platform has.
//
//   web    → Vercel custom events (unchanged; existing names and their history
//            are preserved, attribution tagging included)
//   native → PostHog
//
// Both are INERT without their key, by the same rule the push system follows: a
// developer's machine and CI must write nowhere.
import { Platform } from 'react-native';
import { scrubProps, type EventMap, type EventName } from './events';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

const isWeb = Platform.OS === 'web';

type PostHogInstance = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (id: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
  screen: (name: string, properties?: Record<string, unknown>) => void;
};

let posthog: PostHogInstance | null = null;
let started = false;

/** Start the native client once. Safe to call repeatedly; no-op on web. */
export function initAnalytics(): void {
  if (started || isWeb || !POSTHOG_KEY) return;
  started = true;
  try {
    // Lazy by design: a static import would fail at module LOAD on a build
    // without the native module, rather than here where the catch handles it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostHog } = require('posthog-react-native') as {
      PostHog: new (key: string, opts: Record<string, unknown>) => PostHogInstance;
    };
    posthog = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: true,
      // BOTH OF THESE ARE ALREADY THE SDK'S DEFAULTS. They are written down
      // anyway because they are the two settings that decide what the App
      // Store privacy label has to declare, and a default is a promise the
      // next `yarn upgrade` can quietly break.
      //
      // disableGeoip: PostHog resolves an approximate location from the
      // request IP server-side unless told not to. That would make this app
      // collect location data — a category we would then have to declare, for
      // a fact we have no use for.
      disableGeoip: true,
      // Session replay records the screen. Never, in an app where the screen
      // can show someone's account, their email in a settings field, and
      // whatever they typed into search.
      enableSessionReplay: false,
    });
  } catch {
    posthog = null;
  }
}

/**
 * Record an event. The only way to do so.
 *
 * Typed so a call site cannot invent a name or pass the wrong properties — the
 * taxonomy in ./events.ts is the contract and this is the only door through it.
 */
export function track<E extends EventName>(
  event: E,
  ...args: EventMap[E] extends Record<string, never> ? [] : [EventMap[E]]
): void {
  const props = scrubProps((args[0] ?? {}) as Record<string, unknown>);
  try {
    if (isWeb) {
      // Lazily required so the native bundle never pulls the web beacon in.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { trackWeb } = require('./vercel') as {
        trackWeb: (n: string, p: Record<string, unknown>) => void;
      };
      trackWeb(event, props);
      return;
    }
    posthog?.capture(event, { ...props, platform: Platform.OS });
  } catch {
    // Analytics must never be able to break the action that triggered it.
  }
}

/** Tie events to an account. The id ONLY — never an email or a display name. */
export function identify(userId: string): void {
  try {
    posthog?.identify(userId);
  } catch {
    /* ignore */
  }
}

/** On sign-out, so the next person on the device is not the previous one. */
export function resetAnalytics(): void {
  try {
    posthog?.reset();
  } catch {
    /* ignore */
  }
}

/** A screen view, with the route SHAPE rather than the resolved path. */
export function screen(name: string): void {
  try {
    posthog?.screen(name);
  } catch {
    /* ignore */
  }
}

/** Is anything actually being sent? For the debug surface. */
export function analyticsEnabled(): boolean {
  return isWeb ? true : !!posthog;
}

export type { EventName } from './events';
