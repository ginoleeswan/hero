// Traffic domain — self-hosted web analytics (page_views) for the command
// center. Read-only view of the admin_traffic_overview() RPC: headline totals +
// live "active now", a daily trend, and top pages / referrers / device split.
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { StatTile, EmptyState } from '../ui';
import { TrafficSkeleton } from '../skeletons';
import type {
  TrafficOverview,
  RouteViews,
  ReferrerViews,
  DeviceViews,
} from '../../../../lib/db/traffic';

// Horizontal bar-list row: label on the left, a proportional fill, value right.
function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <View style={s.barRow}>
      <View style={s.barLabelWrap}>
        <Text style={s.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={s.barVal}>{value.toLocaleString()}</Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function BarList<T>({
  rows,
  empty,
  label,
  value,
}: {
  rows: T[];
  empty: string;
  label: (r: T) => string;
  value: (r: T) => number;
}) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  const max = Math.max(1, ...rows.map(value));
  return (
    <View style={s.barList}>
      {rows.map((r, i) => (
        <BarRow key={i} label={label(r)} value={value(r)} max={max} />
      ))}
    </View>
  );
}

export function TrafficDomain({
  data,
  loading,
  narrow,
}: {
  data: TrafficOverview | null;
  loading: boolean;
  narrow: boolean;
}) {
  if (loading && !data) {
    return <TrafficSkeleton narrow={narrow} />;
  }
  if (!data) {
    return (
      <Panel title="Traffic">
        <View style={s.locked}>
          <Ionicons name="lock-closed-outline" size={26} color={COLORS.grey} />
          <Text style={s.lockedText}>
            Traffic analytics are admin-only, or no page views have been recorded yet.
          </Text>
        </View>
      </Panel>
    );
  }

  const days = data.series;
  const maxViews = Math.max(1, ...days.map((d) => d.views));

  return (
    <Bento>
      <Bento.Row narrow={narrow}>
        {/* Headline */}
        <Panel title="Traffic" hint={`Last ${data.rangeDays} days`} style={s.flex15}>
          <View style={s.tiles}>
            <StatTile
              label="Page views"
              value={data.totals.pageViews.toLocaleString()}
              tint={COLORS.navy}
            />
            <StatTile
              label="Visitors"
              value={data.totals.visitors.toLocaleString()}
              tint={COLORS.blue}
            />
            <StatTile
              label="Active now"
              value={data.activeNow.toLocaleString()}
              tint={COLORS.green}
            />
          </View>
        </Panel>

        {/* Devices */}
        <Panel title="Devices" hint="Views by device" style={s.flex1}>
          <BarList<DeviceViews>
            rows={data.devices}
            empty="No device data yet."
            label={(d) => d.label}
            value={(d) => d.views}
          />
        </Panel>
      </Bento.Row>

      {/* Traffic over time */}
      <Panel title="Traffic over time" hint="Page views per day">
        {days.length === 0 || maxViews === 1 ? (
          <EmptyState text="No views recorded yet — the trend fills in daily." />
        ) : (
          <View style={s.bars}>
            {days.map((d) => (
              <View key={d.day} style={s.barCol}>
                <View style={s.barColTrack}>
                  <View
                    style={[s.barColFill, { height: `${Math.round((d.views / maxViews) * 100)}%` }]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </Panel>

      <Bento.Row narrow={narrow}>
        {/* Top pages */}
        <Panel title="Top pages" hint="Grouped routes" style={s.flex1}>
          <BarList<RouteViews>
            rows={data.topPages}
            empty="No page views yet."
            label={(r) => r.route}
            value={(r) => r.views}
          />
        </Panel>

        {/* Top referrers */}
        <Panel title="Top referrers" hint="Where visitors arrive from" style={s.flex1}>
          <BarList<ReferrerViews>
            rows={data.topReferrers}
            empty="No external referrers yet."
            label={(r) => r.source}
            value={(r) => r.views}
          />
        </Panel>
      </Bento.Row>
    </Bento>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  flex15: { flex: 1.5 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Daily trend (vertical bars)
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 90, marginTop: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barColTrack: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  barColFill: { width: '100%', backgroundColor: COLORS.blue, borderRadius: 2, minHeight: 2 },
  // Horizontal bar lists
  barList: { gap: 8 },
  barRow: { gap: 4 },
  barLabelWrap: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.black },
  barVal: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: '#efe6d6', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.orange },
  locked: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  lockedText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 360,
  },
});
