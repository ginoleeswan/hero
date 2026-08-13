import { supabase } from '../supabase';

// Self-hosted page-view collection (web only). Called from Analytics.web.tsx on
// every navigation; fire-and-forget so it never blocks or surfaces errors.
// page_views is insert-only + RLS-locked (reads go through admin_traffic_overview).

const SESSION_KEY = 'mythique_sid';

// Stable per-browser id so we can count unique visitors without identifying them.
// Exported so attribution writes (session_attribution) key off the SAME id — the
// server join between a campaign touch and later page views depends on it.
/**
 * A random visitor id, or null if the browser offers no real randomness.
 *
 * `randomUUID` needs a secure context, so it is absent over plain http (a LAN
 * dev build, say); `getRandomValues` is not, and has been in every browser
 * since 2011. Between them there is no realistic gap left to fill with a
 * pseudo-random fallback.
 */
function randomId(): string | null {
  // Typed as Partial: the DOM lib declares both methods as always present, so
  // narrowing on `in` collapses the type to never and the runtime check that
  // matters here — an older or non-secure context — is exactly the one TS is
  // certain cannot happen.
  const c: Partial<Crypto> | undefined = typeof crypto === 'undefined' ? undefined : crypto;
  if (!c) return null;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  if (typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return null;
}

export function getSessionId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      const fresh = randomId();
      // No usable randomness means no id, and no id means this visit simply
      // goes uncounted. The fallback here used to be Math.random(), which is
      // seeded well enough to collide between two visitors opening the site in
      // the same millisecond — and a collision does not degrade the analytics,
      // it merges two people into one row. Losing a visit is the better error.
      if (!fresh) return null;
      sid = fresh;
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return null; // private mode / storage disabled
  }
}

function getDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return 'tablet';
  }
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

// Referring host, only when it's a different origin (skip internal navigation).
export function getReferrerHost(): string | null {
  if (typeof document === 'undefined' || !document.referrer) return null;
  try {
    const ref = new URL(document.referrer);
    if (typeof location !== 'undefined' && ref.host === location.host) return null;
    return ref.host;
  } catch {
    return null;
  }
}

/** Record one page view. Web only; no-ops cleanly off-web or on failure. */
export async function recordPageView(route: string, path: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await supabase.from('page_views').insert({
      route,
      path,
      user_id: session?.user?.id ?? null,
      session_id: getSessionId(),
      referrer: getReferrerHost(),
      device: getDevice(),
    });
  } catch {
    // fire-and-forget — analytics writes must never break navigation
  }
}
