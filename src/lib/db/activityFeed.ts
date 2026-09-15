import { supabase } from '../supabase';

// Read layer for the command center's cross-domain activity history. One
// keyset-paginated RPC (admin_activity_feed) merges page views, favourites,
// votes, contributions and enrichment runs newest-first; the client pages back
// by passing the last row's `at` as the cursor.

export type ActivityEventKind = 'view' | 'favourite' | 'vote' | 'contribution' | 'run';
/** The server-side filter vocabulary. 'engagement' = favourite + vote + contribution. */
export type ActivityFilter = 'all' | 'view' | 'engagement' | 'run';

export interface ActivityEvent {
  kind: ActivityEventKind;
  at: string;
  heroId: string | null;
  heroName: string | null;
  /** Page-view context (null for other kinds). */
  route: string | null;
  path: string | null;
  sessionId: string | null;
  signedIn: boolean | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  /** Enrichment-run context (null for other kinds). */
  runId: number | null;
  runStatus: string | null;
  runDone: number | null;
  /** Contribution detail ("edited alignment") or the run type. */
  text: string | null;
}

export interface ActivityPage {
  items: ActivityEvent[];
  /** Cursor for the next page — the oldest `at` on this page — or null at the end. */
  nextBefore: string | null;
}

type FeedJson = ({ authorized: false } | { authorized: true; items: ActivityEvent[] }) | null;

/**
 * Fetch one page of the activity timeline. Returns `null` when the caller isn't
 * an admin or the RPC isn't deployed yet, so the overview can fall back to its
 * merged-streams feed instead of erroring.
 */
export async function fetchActivityFeed({
  before = null,
  limit = 40,
  kind = 'all',
}: {
  before?: string | null;
  limit?: number;
  kind?: ActivityFilter;
} = {}): Promise<ActivityPage | null> {
  const { data, error } = await supabase.rpc('admin_activity_feed', {
    p_before: before ?? undefined,
    p_limit: limit,
    p_kind: kind,
  });
  if (error) {
    console.warn('[fetchActivityFeed] error:', error.message);
    return null;
  }
  const json = data as unknown as FeedJson;
  if (!json || json.authorized !== true) return null;
  const items = json.items ?? [];
  return {
    items,
    nextBefore: items.length >= limit ? items[items.length - 1].at : null,
  };
}
