import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

let started = false;

/**
 * Initialise crash/error reporting. No-op without a DSN (local dev, tests,
 * forks) — same fail-soft posture as the sitemap generator — so the app behaves
 * exactly as before when Sentry isn't configured.
 *
 * Errors-only on purpose: tracing/replay/profiling are OFF to protect the
 * hard-won landing bundle size (the three.js split saved 911 KB — don't hand it
 * back to an APM bundle). Native fatal-JS coverage comes free from init()
 * installing the ErrorUtils handler.
 */
export function initSentry(): void {
  if (started || !dsn || process.env.NODE_ENV === 'test') return;
  started = true;
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    enableAutoPerformanceTracing: false,
    sendDefaultPii: false,
  });
}

/**
 * Report an error to Sentry if configured. Safe to call unconditionally — no-op
 * when init() never ran. Used alongside the self-hosted client_errors feed, not
 * instead of it.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!started) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Tag the current scope (e.g. the active route) for triage. No-op if uninitialised. */
export function setSentryTag(key: string, value: string): void {
  if (!started) return;
  Sentry.setTag(key, value);
}

export { Sentry };
