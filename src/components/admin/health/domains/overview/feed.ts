// Cross-domain activity feed — the command center's live pulse. Merges three
// independent event streams (enrichment runs, live page views, community
// engagement) into one time-ordered timeline. Pure + tested: the component
// just renders what this returns.
import { COLORS } from '../../../../../constants/colors';
import type { EnrichmentRun } from '../../../../../lib/db/catalogHealth';
import type { LiveHit } from '../../../../../lib/db/traffic';
import type { ActivityItem } from '../../../../../lib/db/community';
import type { ActivityEvent } from '../../../../../lib/db/activityFeed';
import { countryName } from '../../../../../lib/db/audience';

/** One row in the merged feed. `icon` is an Ionicons glyph name. */
export interface FeedItem {
  at: string;
  icon: string;
  tint: string;
  text: string;
  /** Secondary context line — "Berlin, Germany · mobile · Safari". */
  meta?: string;
  /** Set when the row can deep-link to a character. */
  heroId?: string | null;
}

const runItem = (r: EnrichmentRun): FeedItem => {
  if (r.status === 'error')
    return {
      at: r.created_at,
      icon: 'close-circle',
      tint: COLORS.red,
      text: `Run #${r.id} errored`,
    };
  if (r.status === 'running')
    return {
      at: r.created_at,
      icon: 'sync',
      tint: COLORS.orange,
      text: `Run #${r.id} running · ${r.done} enriched`,
    };
  if (r.status === 'stopped')
    return {
      at: r.created_at,
      icon: 'stop-circle',
      tint: COLORS.navy,
      text: `Run #${r.id} stopped`,
    };
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
  heroId: h.name && h.path.startsWith('/character/') ? h.path.split('/')[2] : null,
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

const RUN_STATUS: Record<string, { icon: string; tint: string; verb: string }> = {
  error: { icon: 'close-circle', tint: COLORS.red, verb: 'errored' },
  running: { icon: 'sync', tint: COLORS.orange, verb: 'running' },
  stopped: { icon: 'stop-circle', tint: COLORS.navy, verb: 'stopped' },
};

/** "Berlin, Germany · mobile · Safari on iOS" from whatever a view row carries. Pure. */
export function viewMeta(e: Pick<ActivityEvent, 'country' | 'city' | 'device' | 'browser' | 'os'>) {
  const where = [e.city, e.country ? countryName(e.country) : null].filter(Boolean).join(', ');
  const on = e.browser && e.os ? `${e.browser} on ${e.os}` : (e.browser ?? e.os ?? null);
  return [where || null, e.device, on].filter(Boolean).join(' · ');
}

/**
 * One server-side activity event (admin_activity_feed) → a feed row. The same
 * vocabulary as the merged three-stream feed above, plus the enriched context
 * line page views now carry. Pure + tested.
 */
export function eventToFeedItem(e: ActivityEvent): FeedItem {
  switch (e.kind) {
    case 'view': {
      const meta = viewMeta(e);
      return {
        at: e.at,
        icon: 'eye-outline',
        tint: COLORS.blue,
        text: e.heroName ? `Viewing ${e.heroName}` : `Visit · ${e.path ?? e.route ?? '/'}`,
        meta: [meta || null, e.signedIn ? 'signed in' : null].filter(Boolean).join(' · ') || undefined,
        heroId: e.heroId,
      };
    }
    case 'run': {
      const st = RUN_STATUS[e.runStatus ?? ''];
      const done = e.runDone ?? 0;
      return {
        at: e.at,
        icon: st?.icon ?? 'checkmark-circle',
        tint: st?.tint ?? COLORS.green,
        text: `Run #${e.runId} ${st?.verb ?? 'finished'}${
          st?.verb === 'errored' || st?.verb === 'stopped' ? '' : ` · ${done} enriched`
        }`,
        meta: e.text ?? undefined,
      };
    }
    default: {
      const m = COMMUNITY_ICON[e.kind];
      return {
        at: e.at,
        icon: m?.icon ?? 'ellipse-outline',
        tint: m?.tint ?? COLORS.grey,
        text: `${m?.verb ?? 'Did'} ${e.heroName ?? ''}`.trim(),
        meta: e.text ?? undefined,
        heroId: e.heroId,
      };
    }
  }
}
