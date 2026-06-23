import { supabase } from '../supabase';

// Self-hosted page-view collection (web only). Called from Analytics.web.tsx on
// every navigation; fire-and-forget so it never blocks or surfaces errors.
// page_views is insert-only + RLS-locked (reads go through admin_traffic_overview).

const SESSION_KEY = 'mythique_sid';

// Stable per-browser id so we can count unique visitors without identifying them.
function getSessionId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
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
function getReferrerHost(): string | null {
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
