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

export interface TrafficOverview {
  rangeDays: number;
  totals: { pageViews: number; visitors: number };
  /** Unique visitors seen in the last 5 minutes. */
  activeNow: number;
  series: TrafficSeriesPoint[];
  topPages: RouteViews[];
  topReferrers: ReferrerViews[];
  devices: DeviceViews[];
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
    activeNow: json.activeNow,
    series: json.series,
    topPages: json.topPages,
    topReferrers: json.topReferrers,
    devices: json.devices,
  };
}
