// Acquisition domain — first-touch marketing attribution as its own Audience
// sub-tab (promoted out of the Traffic breakdowns, where it was buried). Answers
// "which campaigns bring visitors, and which of those become accounts?" off the
// same admin_traffic_overview() payload the Traffic tab reads, so it adds no
// extra query.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { EmptyState, PillGroup } from '../ui';
import { TrafficSkeleton } from '../skeletons';
import { TrafficKpi } from './traffic/TrafficKpi';
import type { TrafficOverview, AcquisitionRow } from '../../../../lib/db/traffic';

const RANGES = [
  { label: '7d', value: 7 },
  { label: '28d', value: 28 },
  { label: '90d', value: 90 },
];

// Campaign row: label, a proportional visitor bar, and a "N signed in" caption —
// the funnel from a marketing source to actual accounts.
function AcqRow({ row, max }: { row: AcquisitionRow; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((row.visitors / max) * 100)) : 0;
  return (
    <View style={s.barRow}>
      <View style={s.barLabelWrap}>
        <Text style={s.barLabel} numberOfLines={1}>
          {row.label}
        </Text>
        <Text style={s.barVal}>{row.visitors.toLocaleString()}</Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={s.acqCap} numberOfLines={1}>
        {row.visitors.toLocaleString()} visitors · {row.engaged.toLocaleString()} engaged ·{' '}
        {row.signups.toLocaleString()} signed in
      </Text>
    </View>
  );
}

export function AcquisitionDomain({
  data,
  loading,
  narrow,
  days,
  onDaysChange,
  onOpenPromote,
}: {
  data: TrafficOverview | null;
  loading: boolean;
  narrow: boolean;
  days: number;
  onDaysChange: (d: number) => void;
  /** Jump to Publish → Promote — where ad links are built. */
  onOpenPromote?: () => void;
}) {
  if (loading && !data) {
    return <TrafficSkeleton narrow={narrow} />;
  }
  if (!data) {
    return (
      <Panel title="Acquisition">
        <View style={s.locked}>
          <Ionicons name="lock-closed-outline" size={26} color={COLORS.grey} />
          <Text style={s.lockedText}>
            Acquisition analytics are admin-only, or no page views have been recorded yet.
          </Text>
        </View>
      </Panel>
    );
  }

  const rows = data.acquisition;
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  const totalVisitors = rows.reduce((n, r) => n + r.visitors, 0);
  const totalEngaged = rows.reduce((n, r) => n + r.engaged, 0);
  const totalSignups = rows.reduce((n, r) => n + r.signups, 0);
  const engagedPct = totalVisitors > 0 ? Math.round((totalEngaged / totalVisitors) * 100) : 0;
  const convPct = totalVisitors > 0 ? Math.round((totalSignups / totalVisitors) * 100) : 0;

  return (
    <Bento>
      {/* Headline: how much attributed traffic, and how much of it converted */}
      <View style={s.kpiRow}>
        <TrafficKpi
          label="Attributed visitors"
          value={totalVisitors.toLocaleString()}
          tint={COLORS.navy}
          footer={<Text style={s.kpiFoot}>tagged first-touch · {data.rangeDays}d</Text>}
        />
        <TrafficKpi
          label="Engaged"
          value={totalEngaged.toLocaleString()}
          tint={COLORS.blue}
          footer={<Text style={s.kpiFoot}>{engagedPct}% stayed past the landing</Text>}
        />
        <TrafficKpi
          label="Signups"
          value={totalSignups.toLocaleString()}
          tint={COLORS.green}
          footer={<Text style={s.kpiFoot}>from tagged sources</Text>}
        />
        <TrafficKpi
          label="Conversion"
          value={`${convPct}%`}
          tint={COLORS.orange}
          footer={<Text style={s.kpiFoot}>signups ÷ visitors</Text>}
        />
      </View>

      {/* The campaign leaderboard — sorted by visitors, with the signed-in count */}
      <Panel
        title="By campaign"
        hint="First-touch source · UTM-tagged links"
        action={<PillGroup options={RANGES} value={days} onChange={onDaysChange} />}
      >
        {rows.length === 0 ? (
          <EmptyState text="No tagged campaigns yet. Build a tagged link in Publish → Promote and use it as the promote's destination URL." />
        ) : (
          <View style={s.barList}>
            {rows.map((r, i) => (
              <AcqRow key={i} row={r} max={max} />
            ))}
          </View>
        )}
        {onOpenPromote ? (
          <Pressable style={s.promoteBtn} onPress={onOpenPromote}>
            <Ionicons name="rocket-outline" size={13} color="#fff" />
            <Text style={s.promoteText}>Build ad links · Publish → Promote</Text>
          </Pressable>
        ) : null}
      </Panel>
    </Bento>
  );
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiFoot: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
  barList: { gap: 8 },
  barRow: { gap: 4 },
  barLabelWrap: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.black },
  barVal: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: '#efe6d6', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.orange },
  acqCap: { fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: COLORS.grey },
  promoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navy,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  promoteText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  locked: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  lockedText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 360,
  },
});
