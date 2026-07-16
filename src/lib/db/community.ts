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
  avatarUrl: string | null;
  isAdmin: boolean;
  isSupporter: boolean;
  joinedAt: string;
  lastSeenAt: string;
  /** Seen within the last 5 minutes (computed server-side). */
  live: boolean;
}

export interface PresenceSummary {
  /** Signed-in members seen in the last 5 minutes. */
  onlineNow: number;
  /** Signed-in members seen in the last 24 hours. */
  activeToday: number;
  /** Visitors (anon + signed-in) active in page_views in the last 5 min. */
  activeVisitors: number;
  /** Most-recently-seen members (up to 8). */
  recent: OnlineMember[];
}

/** One row in the full member roster: profile + lifetime engagement counts. */
export interface Member {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isSupporter: boolean;
  supporterSince: string | null;
  /** Account creation date. */
  joinedAt: string;
  lastSeenAt: string | null;
  /** Seen within the last 5 minutes (computed server-side). */
  live: boolean;
  /** Contributor tier (steward/curator/new) when they've submitted edits. */
  contributorLevel: string | null;
  favourites: number;
  views: number;
  votes: number;
  contributions: number;
}

/** Full drill-down for one member — profile, counts, favourites, own activity. */
export interface MemberDetail {
  profile: {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    isAdmin: boolean;
    isSupporter: boolean;
    supporterSince: string | null;
    joinedAt: string;
    lastSeenAt: string | null;
    live: boolean;
    contributorLevel: string | null;
    counts: {
      favourites: number;
      views: number;
      votes: number;
      contributions: number;
      approved: number;
      pending: number;
      rejected: number;
    };
  };
  /** Their most-recently favourited heroes (up to 12). */
  favourites: HeroStat[];
  /** Member-scoped newest-first activity feed (up to 15). */
  recent: ActivityItem[];
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
  /** Members joined in the last 7 days. */
  newThisWeek: number;
  /** Full member roster (up to 60, richest-signal first). */
  members: Member[];
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
  const { data, error } = await supabase.rpc('admin_community_overview');
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
    newThisWeek: json.newThisWeek,
    members: json.members,
    topViewed: json.topViewed,
    topFavourited: json.topFavourited,
    topBacked: json.topBacked,
    topContributors: json.topContributors,
    contributionsByStatus: json.contributionsByStatus,
    recent: json.recent,
  };
}

type MemberDetailJson = ({ authorized: false } | ({ authorized: true } & MemberDetail)) | null;

/**
 * Fetch one member's full drill-down (profile, counts, favourites, activity).
 * Returns `null` for non-admins or on error, mirroring the overview fetcher.
 */
export async function fetchMemberDetail(userId: string): Promise<MemberDetail | null> {
  const { data, error } = await supabase.rpc('admin_member_detail', { p_user_id: userId });
  if (error) {
    console.warn('[fetchMemberDetail] error:', error.message);
    return null;
  }
  const json = data as unknown as MemberDetailJson;
  if (!json || json.authorized !== true) return null;
  return { profile: json.profile, favourites: json.favourites, recent: json.recent };
}
