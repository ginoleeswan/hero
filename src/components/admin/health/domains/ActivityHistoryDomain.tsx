// Audience › Activity — the full, filterable activity history. The same
// cross-domain timeline the overview's "Live activity" panel shows, but as a
// page you can scroll back through indefinitely (cursor-paged, 40 rows at a
// time) and narrow to page views / engagement / enrichment runs.
import { View, StyleSheet } from 'react-native';
import { Text } from '../../../ui/Text';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { PillGroup, LoadFailed } from '../ui';
import { ActivityFeed } from './overview/ActivityFeed';
import { eventToFeedItem } from './overview/feed';
import { useActivityHistory } from '../../../../hooks/useActivityHistory';
import type { ActivityFilter } from '../../../../lib/db/activityFeed';
import { TrafficSkeleton } from '../skeletons';

const KINDS: { label: string; value: ActivityFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Views', value: 'view' },
  { label: 'Engagement', value: 'engagement' },
  { label: 'Runs', value: 'run' },
];

export function ActivityHistoryDomain({
  narrow,
  kind,
  onKindChange,
}: {
  narrow: boolean;
  kind: ActivityFilter;
  onKindChange: (k: ActivityFilter) => void;
}) {
  const history = useActivityHistory({ kind, live: true });

  if (history.loading && history.items.length === 0) {
    return <TrafficSkeleton narrow={narrow} />;
  }
  if (history.unavailable) {
    return (
      <LoadFailed
        what="the activity history (is migration 20260915120000 applied?)"
        onRetry={() => void history.refetch()}
      />
    );
  }

  const items = history.items.map(eventToFeedItem);
  return (
    <Bento>
      <Panel
        title="Activity history"
        hint="Every page view, favourite, vote, edit and enrichment run — newest first"
        action={<PillGroup options={KINDS} value={kind} onChange={onKindChange} />}
      >
        <Text style={s.count}>
          {items.length.toLocaleString()} loaded
          {history.hasMore ? ' · more below' : ' · end of history'}
        </Text>
        <View style={s.list}>
          <ActivityFeed
            items={items}
            narrow={narrow}
            dense={false}
            hasMore={history.hasMore}
            loadingMore={history.loadingMore}
            onLoadMore={history.loadMore}
          />
        </View>
      </Panel>
    </Bento>
  );
}

const s = StyleSheet.create({
  count: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey, marginBottom: 6 },
  list: { marginTop: 2 },
});
