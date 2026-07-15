// First-touch marketing attribution (web only). Captures where a visitor first
// arrived from — UTM tags on the landing URL, else the cross-origin referrer —
// and pins it for the life of the browser session. Two consumers:
//
//   1. trackEvent() (analytics.ts) tags every conversion event (sign_up, vote,
//      favourite…) with the first-touch source, so the funnel is attributable.
//   2. recordAttribution() writes one row to `session_attribution`, joined to
//      page_views server-side by session_id in admin_traffic_overview() — the
//      command-center "Acquisition" panel.
//
// The pure helpers (parseUtm / deriveAttribution / attributionEventProps) hold
// all the logic and are unit-tested; the storage/network wrappers are thin and
// no-op cleanly off-web or when storage is unavailable.
import { supabase } from './supabase';
import { getReferrerHost, getSessionId } from './db/pageViews';

/** The five standard UTM parameters, trimmed/capped, null when absent. */
export interface Utm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
}

/** A resolved first-touch: UTM tags plus the referrer host and landing path. */
export interface Attribution extends Utm {
  referrer: string | null;
  landing: string | null;
}

const STORE_KEY = 'mythique_attr'; // first-touch JSON
const SENT_KEY = 'mythique_attr_sent'; // set once the DB row lands, so we write once

// Values land in analytics + a DB row; keep them bounded and trimmed.
function clean(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t ? t.slice(0, 120) : null;
}

/** Parse the five UTM params out of a URL query string (`?a=b&…`). Pure. */
export function parseUtm(search: string): Utm {
  const p = new URLSearchParams(search || '');
  return {
    source: clean(p.get('utm_source')),
    medium: clean(p.get('utm_medium')),
    campaign: clean(p.get('utm_campaign')),
    content: clean(p.get('utm_content')),
    term: clean(p.get('utm_term')),
  };
}

/**
 * Resolve a first-touch from a landing. Returns null for direct/untagged visits
 * (no UTM and no cross-origin referrer) — nothing worth attributing, and the
 * "direct" bucket is simply the absence of a row. Pure.
 *
 * - An explicit `utm_source` always wins.
 * - Otherwise a cross-origin referrer host becomes the source (medium
 *   `referral`), so organic clicks from social/search still get bucketed.
 */
export function deriveAttribution(
  search: string,
  referrerHost: string | null,
  landingPath: string | null,
): Attribution | null {
  const utm = parseUtm(search);
  const hasUtm = Boolean(utm.source || utm.campaign || utm.medium);
  const ref = clean(referrerHost);
  if (!hasUtm && !ref) return null;
  return {
    source: utm.source ?? ref,
    medium: utm.medium ?? (utm.source ? null : 'referral'),
    campaign: utm.campaign,
    content: utm.content,
    term: utm.term,
    referrer: ref,
    landing: clean(landingPath),
  };
}

/** Flat, primitive props for a Vercel custom event. Empty for direct traffic. Pure. */
export function attributionEventProps(a: Attribution | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!a) return out;
  if (a.source) out.utm_source = a.source;
  if (a.medium) out.utm_medium = a.medium;
  if (a.campaign) out.utm_campaign = a.campaign;
  return out;
}

/** The stored first-touch for this browser, or null. No-ops off-web. */
export function getAttribution(): Attribution | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/**
 * Capture first-touch on load — call once, as early as possible, before SPA
 * navigation drops the landing query/referrer. Never overwrites an existing
 * first-touch (first wins), and never records direct/untagged visits.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return getAttribution();
  const existing = getAttribution();
  if (existing) return existing;
  const derived = deriveAttribution(
    window.location.search,
    getReferrerHost(),
    window.location.pathname,
  );
  if (!derived) return null;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(derived));
  } catch {
    // storage disabled (private mode) — attribution stays in-memory only for this call
  }
  return derived;
}

/**
 * Persist the first-touch to `session_attribution` (once per browser). Uses a
 * raw PostgREST insert rather than the typed client so it degrades gracefully
 * before the migration lands — a missing table just 404s, is swallowed, and the
 * write retries on a later load once the table exists. Fire-and-forget: it never
 * touches the page_views pipeline and never throws into the caller.
 */
export async function recordAttribution(): Promise<void> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    if (localStorage.getItem(SENT_KEY)) return;
    const a = getAttribution();
    if (!a || (!a.source && !a.referrer)) return;
    const sid = getSessionId();
    if (!sid) return;
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
    if (!url || !key) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${url}/rest/v1/session_attribution`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${session?.access_token ?? key}`,
        'content-type': 'application/json',
        // Dedup on session_id if this ever runs twice for the same browser.
        prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify({
        session_id: sid,
        utm_source: a.source,
        utm_medium: a.medium,
        utm_campaign: a.campaign,
        utm_content: a.content,
        utm_term: a.term,
        referrer: a.referrer,
        landing_path: a.landing,
      }),
    });
    // Only mark done on success, so pre-migration 404s retry until the table lands.
    if (res.ok) localStorage.setItem(SENT_KEY, '1');
  } catch {
    // fire-and-forget — attribution must never break the page
  }
}
