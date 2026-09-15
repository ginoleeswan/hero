import { supabase } from '../supabase';

// Read layer for the command center's Audience › Visitors sub-tab. Two
// admin-guarded RPCs: admin_audience_breakdown() (where visitors are from, how
// they arrived, what they use, when they come) and admin_audience_sessions()
// (the per-visitor drill-down, filterable + cursor-paged). page_views stays
// insert-only; these are the only read paths.

export interface CountRow {
  label: string;
  visitors: number;
  views?: number;
}
export interface CountryRow {
  /** ISO 3166-1 alpha-2, or 'unknown'. */
  code: string;
  visitors: number;
  views: number;
}
export interface RegionRow {
  code: string | null;
  region: string;
  visitors: number;
}
export interface CityRow {
  code: string | null;
  city: string;
  visitors: number;
}
export interface SourceRow {
  /** utm_source, else referrer host, else 'direct'. */
  source: string;
  medium: string | null;
  campaign: string | null;
  visitors: number;
  /** Sessions with more than one page view. */
  engaged: number;
  signedIn: number;
}
export interface ReferrerRow {
  host: string;
  visitors: number;
  views: number;
}
export interface LandingRow {
  path: string;
  sessions: number;
  engaged: number;
}
export interface HourRow {
  hour: number;
  visitors: number;
  views: number;
}
export interface WeekdayRow {
  /** 0 = Sunday … 6 = Saturday. */
  dow: number;
  visitors: number;
  views: number;
}

export interface AudienceBreakdown {
  rangeDays: number;
  totals: {
    sessions: number;
    signedIn: number;
    bounced: number;
    avgViews: number;
    avgMinutes: number;
    countries: number;
  };
  newVsReturning: { new: number; returning: number };
  countries: CountryRow[];
  regions: RegionRow[];
  cities: CityRow[];
  devices: CountRow[];
  browsers: CountRow[];
  os: CountRow[];
  languages: CountRow[];
  timezones: CountRow[];
  screens: CountRow[];
  sources: SourceRow[];
  referrers: ReferrerRow[];
  landings: LandingRow[];
  hours: HourRow[];
  weekdays: WeekdayRow[];
}

export interface TrailStep {
  path: string;
  route: string;
  /** Hero name when the step is a character page. */
  name: string | null;
  at: string;
}

/** One browser session: who (coarsely), where, on what, how they arrived, what they saw. */
export interface AudienceSession {
  sessionId: string;
  firstAt: string;
  lastAt: string;
  views: number;
  signedIn: boolean;
  displayName: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  lang: string | null;
  timezone: string | null;
  screenW: number | null;
  screenH: number | null;
  source: string;
  medium: string | null;
  campaign: string | null;
  landing: string | null;
  /** Seen before this window opened. */
  returning: boolean;
  /** Oldest → newest, capped at the last 20 steps. */
  trail: TrailStep[];
}

export interface SessionFilters {
  country?: string | null;
  device?: string | null;
  browser?: string | null;
  source?: string | null;
}

export interface SessionsPage {
  sessions: AudienceSession[];
  nextBefore: string | null;
}

type BreakdownJson = ({ authorized: false } | ({ authorized: true } & AudienceBreakdown)) | null;
type SessionsJson =
  ({ authorized: false } | { authorized: true; sessions: AudienceSession[] }) | null;

const EMPTY_TOTALS: AudienceBreakdown['totals'] = {
  sessions: 0,
  signedIn: 0,
  bounced: 0,
  avgViews: 0,
  avgMinutes: 0,
  countries: 0,
};

/** Breakdown for the last `days` calendar days; null when not admin / not deployed. */
export async function fetchAudienceBreakdown(days = 28): Promise<AudienceBreakdown | null> {
  const { data, error } = await supabase.rpc('admin_audience_breakdown', { p_days: days });
  if (error) {
    console.warn('[fetchAudienceBreakdown] error:', error.message);
    return null;
  }
  const json = data as unknown as BreakdownJson;
  if (!json || json.authorized !== true) return null;
  return {
    rangeDays: json.rangeDays,
    totals: { ...EMPTY_TOTALS, ...(json.totals ?? {}) },
    newVsReturning: json.newVsReturning ?? { new: 0, returning: 0 },
    countries: json.countries ?? [],
    regions: json.regions ?? [],
    cities: json.cities ?? [],
    devices: json.devices ?? [],
    browsers: json.browsers ?? [],
    os: json.os ?? [],
    languages: json.languages ?? [],
    timezones: json.timezones ?? [],
    screens: json.screens ?? [],
    sources: json.sources ?? [],
    referrers: json.referrers ?? [],
    landings: json.landings ?? [],
    hours: json.hours ?? [],
    weekdays: json.weekdays ?? [],
  };
}

/** One page of sessions, most recently active first. */
export async function fetchAudienceSessions({
  days = 28,
  before = null,
  limit = 25,
  filters = {},
}: {
  days?: number;
  before?: string | null;
  limit?: number;
  filters?: SessionFilters;
} = {}): Promise<SessionsPage | null> {
  const { data, error } = await supabase.rpc('admin_audience_sessions', {
    p_days: days,
    p_before: before ?? undefined,
    p_limit: limit,
    p_country: filters.country ?? undefined,
    p_device: filters.device ?? undefined,
    p_browser: filters.browser ?? undefined,
    p_source: filters.source ?? undefined,
  });
  if (error) {
    console.warn('[fetchAudienceSessions] error:', error.message);
    return null;
  }
  const json = data as unknown as SessionsJson;
  if (!json || json.authorized !== true) return null;
  const sessions = (json.sessions ?? []).map((s) => ({ ...s, trail: s.trail ?? [] }));
  return {
    sessions,
    nextBefore: sessions.length >= limit ? sessions[sessions.length - 1].lastAt : null,
  };
}

/** Human-readable country name for an ISO code, falling back to the code. Pure. */
export function countryName(code: string | null | undefined): string {
  if (!code || code === 'unknown') return 'Unknown';
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
