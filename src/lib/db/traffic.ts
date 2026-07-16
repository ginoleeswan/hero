import { supabase } from '../supabase';

// Read layer for the command-center "Traffic" domain. Aggregation happens
// server-side in the admin-guarded admin_traffic_overview() RPC (page_views is
// RLS-locked to inserts); this wrapper invokes it and shapes the loose JSON.

export interface TrafficSeriesPoint {
  day: string;
  views: number;
  visitors: number;
}
export interface RouteViews {
  route: string;
  views: number;
}
export interface ReferrerViews {
  source: string;
  views: number;
}
export interface DeviceViews {
  label: string;
  views: number;
}
/** A character route resolved to the hero being viewed. */
export interface HeroViews {
  id: string;
  name: string;
  image: string | null;
  views: number;
}
/** A first-touch acquisition bucket: campaign/source → visitors + sign-ins. */
export interface AcquisitionRow {
  /** Display label — campaign, else source, else referrer, else 'direct'. */
  label: string;
  source: string | null;
  campaign: string | null;
  /** Distinct sessions first seen in the window from this bucket. */
  visitors: number;
  /** Of those, sessions with ≥2 page views — they stayed past the landing. */
  engaged: number;
  /** How many of those sessions were signed in on any page view. */
  signups: number;
}
/** One recent page view for the live activity feed. `name` is set when the path
 *  is a character route that resolves to a hero. */
export interface LiveHit {
  route: string;
  path: string;
  name: string | null;
  at: string;
}

export interface TrafficOverview {
  rangeDays: number;
  totals: { pageViews: number; visitors: number };
  /** Same-length previous window — for period-over-period growth deltas. */
  prev: { pageViews: number; visitors: number };
  /** Distinct signed-in vs anonymous visitors over the window. */
  audience: { signedIn: number; anon: number };
  today: { views: number; visitors: number };
  yesterday: { views: number };
  /** Unique visitors seen in the last 5 minutes. */
  activeNow: number;
  series: TrafficSeriesPoint[];
  topPages: RouteViews[];
  topReferrers: ReferrerViews[];
  devices: DeviceViews[];
  /** Which characters are being viewed, resolved to names. */
  topHeroes: HeroViews[];
  /** Most recent views for the live feed, newest first. */
  live: LiveHit[];
  /** First-touch acquisition by campaign/source. Empty until links are tagged. */
  acquisition: AcquisitionRow[];
}

type OverviewJson = ({ authorized: false } | ({ authorized: true } & TrafficOverview)) | null;

/**
 * Fetch the traffic overview for the last `days` calendar days. Returns `null`
 * when the caller isn't an admin or on error, so the UI shows an empty/locked
 * state rather than crashing.
 */
export async function fetchTrafficOverview(days = 28): Promise<TrafficOverview | null> {
  const { data, error } = await supabase.rpc('admin_traffic_overview', { p_days: days });
  if (error) {
    console.warn('[fetchTrafficOverview] error:', error.message);
    return null;
  }
  const json = data as unknown as OverviewJson;
  if (!json || json.authorized !== true) return null;
  return {
    rangeDays: json.rangeDays,
    totals: json.totals,
    prev: json.prev ?? { pageViews: 0, visitors: 0 },
    audience: json.audience ?? { signedIn: 0, anon: 0 },
    today: json.today ?? { views: 0, visitors: 0 },
    yesterday: json.yesterday ?? { views: 0 },
    activeNow: json.activeNow,
    series: json.series,
    topPages: json.topPages,
    topReferrers: json.topReferrers,
    devices: json.devices,
    topHeroes: json.topHeroes ?? [],
    live: json.live ?? [],
    // `engaged` arrives with overview v4 — default 0 while v3 is still deployed.
    acquisition: (json.acquisition ?? []).map((r) => ({ ...r, engaged: r.engaged ?? 0 })),
  };
}
