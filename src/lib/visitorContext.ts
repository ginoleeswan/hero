// Visitor context for the self-hosted page_views collector (web only): what the
// browser can tell us about itself (browser, OS, language, timezone, viewport)
// plus the coarse geo /api/geo reads off Vercel's edge headers. The pure
// parsers are unit-tested; the storage/network wrappers no-op cleanly off-web.
//
// Nothing here identifies a person: no IP, no fingerprinting entropy beyond a
// coarse family name for browser/OS and a viewport size. The command center's
// Audience lane groups on these to answer "who was here, from where, on what".

export interface UaInfo {
  browser: string;
  os: string;
}

/** Coarse geo as /api/geo returns it. Every field null off-Vercel. */
export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
}

/** Everything attached to a page_views row beyond route/path/device. */
export interface VisitorContext extends GeoInfo {
  browser: string | null;
  os: string | null;
  lang: string | null;
  screen_w: number | null;
  screen_h: number | null;
}

/**
 * Browser + OS family from a user-agent string. Order matters: Edge and Opera
 * carry "Chrome" too, and every WebKit browser carries "Safari". Pure.
 */
export function parseUserAgent(ua: string | null | undefined): UaInfo {
  const s = ua ?? '';
  let browser = 'Other';
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
  else if (/SamsungBrowser/.test(s)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS/.test(s)) browser = 'Firefox';
  else if (/CriOS/.test(s)) browser = 'Chrome';
  else if (/Chrome\/|Chromium\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = 'Safari';
  else if (/Safari\//.test(s)) browser = 'Safari';
  else if (/bot|crawl|spider|slurp/i.test(s)) browser = 'Bot';

  let os = 'Other';
  if (/iPhone|iPod/.test(s)) os = 'iOS';
  else if (/iPad/.test(s)) os = 'iPadOS';
  // iPadOS 13+ masquerades as a Mac; touch support is the tell.
  else if (/Macintosh/.test(s) && /Mobile\//.test(s)) os = 'iPadOS';
  else if (/Android/.test(s)) os = 'Android';
  else if (/Windows/.test(s)) os = 'Windows';
  else if (/CrOS/.test(s)) os = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(s)) os = 'macOS';
  else if (/Linux/.test(s)) os = 'Linux';

  return { browser, os };
}

const GEO_KEY = 'mythique_geo';
const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_TIMEOUT_MS = 1500;

const EMPTY_GEO: GeoInfo = { country: null, region: null, city: null, timezone: null };

function readCachedGeo(): GeoInfo | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GEO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; geo?: GeoInfo };
    if (!parsed.geo || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > GEO_TTL_MS) return null;
    return parsed.geo;
  } catch {
    return null;
  }
}

function writeCachedGeo(geo: GeoInfo) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(GEO_KEY, JSON.stringify({ at: Date.now(), geo }));
  } catch {
    // storage disabled — geo is refetched next load, which is fine
  }
}

let inflight: Promise<GeoInfo> | null = null;

/**
 * Coarse geo for this visitor, cached per browser for a day. Bounded by a short
 * timeout so the page-view write never waits on it noticeably: on a slow first
 * answer the first row goes out without geo and later rows carry it. Never
 * throws; every failure resolves to all-null.
 */
export function getGeo(): Promise<GeoInfo> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return Promise.resolve(EMPTY_GEO);
  }
  const cached = readCachedGeo();
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  const request = (async (): Promise<GeoInfo> => {
    try {
      const controller = typeof AbortController === 'undefined' ? null : new AbortController();
      const timer = controller ? setTimeout(() => controller.abort(), GEO_TIMEOUT_MS) : null;
      const res = await fetch('/api/geo', { signal: controller?.signal });
      if (timer) clearTimeout(timer);
      if (!res.ok) return EMPTY_GEO;
      const json = (await res.json()) as Partial<GeoInfo>;
      const geo: GeoInfo = {
        country: json.country ?? null,
        region: json.region ?? null,
        city: json.city ?? null,
        timezone: json.timezone ?? null,
      };
      // Only cache a real answer — an all-null one (local dev, a transient
      // edge miss) should be retried on the next load.
      if (geo.country) writeCachedGeo(geo);
      return geo;
    } catch {
      return EMPTY_GEO;
    } finally {
      inflight = null;
    }
  })();
  inflight = request;
  return request;
}

/** The browser-side half of the context — synchronous, no network. */
export function getLocalContext(): Omit<VisitorContext, keyof GeoInfo> & {
  timezone: string | null;
} {
  if (typeof navigator === 'undefined') {
    return { browser: null, os: null, lang: null, screen_w: null, screen_h: null, timezone: null };
  }
  const { browser, os } = parseUserAgent(navigator.userAgent);
  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timezone = null;
  }
  const w = typeof window !== 'undefined' ? window.innerWidth : 0;
  const h = typeof window !== 'undefined' ? window.innerHeight : 0;
  return {
    browser,
    os,
    lang: navigator.language ? navigator.language.slice(0, 16) : null,
    screen_w: w > 0 ? Math.round(w) : null,
    screen_h: h > 0 ? Math.round(h) : null,
    timezone,
  };
}

/** Full context for one page-view row. Geo is awaited (bounded), local is sync. */
export async function getVisitorContext(): Promise<VisitorContext> {
  const local = getLocalContext();
  const geo = await getGeo();
  return {
    ...local,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    // The browser's own timezone is the truthful one; the edge guess is a fallback.
    timezone: local.timezone ?? geo.timezone,
  };
}
