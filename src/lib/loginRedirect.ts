import type { Href } from 'expo-router';

/**
 * Validates a raw `returnTo` query param into a safe internal path, or null.
 *
 * A logged-out user who taps an auth-gated action is sent to the login screen
 * with `?returnTo=<their page>`; after signing in we route them back there. The
 * value is attacker-controllable (it rides in the URL), so it's sanitized to a
 * same-app absolute path before any navigation:
 *   - must start with a single "/" (rejects external + protocol-relative URLs
 *     like "//evil.com" and "https://evil.com")
 *   - never the root ("/" is the landing page — an authed user belongs on
 *     /explore, which is the fallback everywhere)
 *   - never back into the auth group (would loop)
 */
export function sanitizeReturnTo(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || typeof v !== 'string') return null;
  if (!v.startsWith('/') || v.startsWith('//')) return null;
  if (v === '/' || v.startsWith('/(auth)')) return null;
  return v;
}

/**
 * Where to send a user after a successful sign-in: their sanitized returnTo, or
 * /explore. Cast to Href because a returnTo is a runtime string, not one of the
 * statically-typed routes (typedRoutes is on) — but it's already sanitized to a
 * same-app path above.
 */
export function postAuthTarget(raw: string | string[] | undefined): Href {
  return (sanitizeReturnTo(raw) ?? '/explore') as Href;
}

/**
 * Href for the login screen, carrying the page to return to after sign-in.
 * Callers pass their current `usePathname()`; a root/unsafe value collapses to
 * a plain login link (post-login fallback is /explore).
 */
export function loginHref(returnTo?: string | string[] | null): Href {
  const clean = sanitizeReturnTo(returnTo ?? undefined);
  return clean ? { pathname: '/(auth)/login', params: { returnTo: clean } } : '/(auth)/login';
}

/**
 * Href for the signup screen, carrying returnTo. Used by the login↔signup switch
 * links so bouncing between the two forms (without leaving the app) doesn't drop
 * the return target. Signup itself can't resume inline — it parks on the
 * email-confirmation card — so a confirmation-link round-trip does lose it.
 */
export function signupHref(returnTo?: string | string[] | null): Href {
  const clean = sanitizeReturnTo(returnTo ?? undefined);
  return clean ? { pathname: '/(auth)/signup', params: { returnTo: clean } } : '/(auth)/signup';
}
