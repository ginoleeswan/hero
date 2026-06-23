import { supabase } from '../supabase';

// Read layer for the command-center "Community" domain. All aggregation happens
// server-side in the admin-guarded admin_community_overview() RPC (the per-user
// tables carry RLS); this wrapper just invokes it and shapes the loose JSON.

export interface HeroStat {
  id: string;
  name: string;
  image_url: string | null;
  publisher: string | null;
  count: number;
  /** Only present on the "most-backed" leaderboard (picked / appearances). */
  winRate?: number | null;
}

export interface Contributor {
  userId: string;
  displayName: string | null;
  approved: number;
  level: string | null;
}

export type ActivityKind = 'favourite' | 'view' | 'compare' | 'vote' | 'contribution';

export interface ActivityItem {
  kind: ActivityKind;
  at: string;
  heroId: string;
  heroName: string;
  /** Verdict text (compare) or "edited <field>" (contribution); else null. */
  text?: string | null;
}

export interface OnlineMember {
  userId: string;
  displayName: string | null;
  lastSeenAt: string;
  /** Seen within the last 5 minutes (computed server-side). */
  live: boolean;
}

export interface PresenceSummary {
  /** Signed-in members seen in the last 5 minutes. */
  onlineNow: number;
  /** Signed-in members seen in the last 24 hours. */
  activeToday: number;
  /** Most-recently-seen members (up to 8). */
  recent: OnlineMember[];
}

export interface CommunityOverview {
  totals: {
    members: number;
    favourites: number;
    views: number;
    compares: number;
    votes: number;
    contributions: number;
  };
  online: PresenceSummary;
  topViewed: HeroStat[];
  topFavourited: HeroStat[];
  topBacked: HeroStat[];
  topContributors: Contributor[];
  contributionsByStatus: { pending: number; approved: number; rejected: number };
  recent: ActivityItem[];
}

// Shape returned by the RPC. `authorized:false` for non-admins; otherwise the
// full overview is spread alongside it.
type OverviewJson = ({ authorized: false } | ({ authorized: true } & CommunityOverview)) | null;

/**
 * Fetch the whole community overview in one round trip. Returns `null` when the
 * caller isn't an admin or on error, so the UI shows a calm empty/locked state
 * instead of crashing.
 */
export async function fetchCommunityOverview(): Promise<CommunityOverview | null> {
  // NOTE: `admin_community_overview` is absent from database.generated.ts until
  // the migration is applied and types are regenerated (Supabase MCP). The name
  // cast keeps this compiling in the meantime; drop it after regeneration.
  const { data, error } = await supabase.rpc('admin_community_overview' as never);
  if (error) {
    console.warn('[fetchCommunityOverview] error:', error.message);
    return null;
  }
  const json = data as unknown as OverviewJson;
  if (!json || json.authorized !== true) return null;
  // Re-pick the fields explicitly so the `authorized` flag never leaks out.
  return {
    totals: json.totals,
    online: json.online,
    topViewed: json.topViewed,
    topFavourited: json.topFavourited,
    topBacked: json.topBacked,
    topContributors: json.topContributors,
    contributionsByStatus: json.contributionsByStatus,
    recent: json.recent,
  };
}
