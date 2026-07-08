// Cross-domain activity feed — the command center's live pulse. Merges three
// independent event streams (enrichment runs, live page views, community
// engagement) into one time-ordered timeline. Pure + tested: the component
// just renders what this returns.
import { COLORS } from '../../../../../constants/colors';
import type { EnrichmentRun } from '../../../../../lib/db/catalogHealth';
import type { LiveHit } from '../../../../../lib/db/traffic';
import type { ActivityItem } from '../../../../../lib/db/community';

/** One row in the merged feed. `icon` is an Ionicons glyph name. */
export interface FeedItem {
  at: string;
  icon: string;
  tint: string;
  text: string;
}

const runItem = (r: EnrichmentRun): FeedItem => {
  if (r.status === 'error')
    return { at: r.created_at, icon: 'close-circle', tint: COLORS.red, text: `Run #${r.id} errored` };
  if (r.status === 'running')
    return {
      at: r.created_at,
      icon: 'sync',
      tint: COLORS.orange,
      text: `Run #${r.id} running · ${r.done} enriched`,
    };
  if (r.status === 'stopped')
    return { at: r.created_at, icon: 'stop-circle', tint: COLORS.navy, text: `Run #${r.id} stopped` };
  return {
    at: r.created_at,
    icon: 'checkmark-circle',
    tint: COLORS.green,
    text: `Run #${r.id} finished · ${r.done} enriched`,
  };
};

const hitItem = (h: LiveHit): FeedItem => ({
  at: h.at,
  icon: 'eye-outline',
  tint: COLORS.blue,
  text: h.name ? `Viewing ${h.name}` : `Visit · ${h.path}`,
});

// Community 'view' items are page views too — skip them (traffic.live owns the
// view pulse) so the feed isn't double-counted. Keep the engagement kinds.
const COMMUNITY_ICON: Record<string, { icon: string; tint: string; verb: string }> = {
  favourite: { icon: 'heart', tint: COLORS.red, verb: 'Favourited' },
  vote: { icon: 'flame', tint: COLORS.orange, verb: 'Voted' },
  compare: { icon: 'git-compare', tint: COLORS.blue, verb: 'Compared' },
  contribution: { icon: 'create', tint: COLORS.gold, verb: 'Edited' },
};

const communityItem = (a: ActivityItem): FeedItem | null => {
  const m = COMMUNITY_ICON[a.kind];
  if (!m) return null; // 'view' and anything unknown
  return { at: a.at, icon: m.icon, tint: m.tint, text: `${m.verb} ${a.heroName}` };
};

/** Merge the three streams into a newest-first timeline, capped to `limit`. */
export function mergeActivityFeed({
  runs = [],
  live = [],
  community = [],
  limit = 14,
}: {
  runs?: EnrichmentRun[];
  live?: LiveHit[];
  community?: ActivityItem[];
  limit?: number;
}): FeedItem[] {
  const items: FeedItem[] = [
    ...runs.map(runItem),
    ...live.map(hitItem),
    ...community.map(communityItem).filter((x): x is FeedItem => x !== null),
  ];
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, limit);
}
