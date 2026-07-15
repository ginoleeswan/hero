// Traffic domain — self-hosted web analytics (page_views) for the command center.
// Reads admin_traffic_overview(): headline KPIs with period-over-period growth
// deltas + sparklines, a readable views/visitors trend with a range toggle, what's
// hot (top heroes resolved to names), a live activity feed, and supporting
// breakdowns (pages / referrers / devices).
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { EmptyState, HeroThumb, PillGroup } from '../ui';
import { TrafficSkeleton } from '../skeletons';
import { TrafficKpi, pctDelta } from './traffic/TrafficKpi';
import { TrafficTrendChart } from './traffic/TrafficTrendChart';
import { LiveFeed } from './traffic/LiveFeed';
import type {
  TrafficOverview,
  RouteViews,
  ReferrerViews,
  DeviceViews,
  HeroViews,
  AcquisitionRow,
} from '../../../../lib/db/traffic';

const RANGES = [
  { label: '7d', value: 7 },
  { label: '28d', value: 28 },
  { label: '90d', value: 90 },
];

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

// Signed-in vs anonymous split — a two-segment bar with a small caption. Slots
// into the "Signed-in share" KPI tile's footer.
function SignedSplit({ signedIn, anon }: { signedIn: number; anon: number }) {
  const total = signedIn + anon;
  const pct = total > 0 ? Math.round((signedIn / total) * 100) : 0;
  return (
    <View style={s.splitWrap}>
      <View style={s.splitTrack}>
        <View style={[s.splitFill, { width: `${pct}%` }]} />
      </View>
      <Text style={s.splitCap} numberOfLines={1}>
        {signedIn.toLocaleString()} signed-in · {anon.toLocaleString()} guests
      </Text>
    </View>
  );
}

// Acquisition row: campaign/source label, a visitor bar, and a "N signed in"
// caption — the funnel from a marketing source to actual accounts.
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
        {row.visitors.toLocaleString()} visitors · {row.signups.toLocaleString()} signed in
      </Text>
    </View>
  );
}

// Top-hero row: rank thumbnail, name, view count, and a proportional bar.
function HeroRow({ hero, max, onPress }: { hero: HeroViews; max: number; onPress: () => void }) {
  const pct = max > 0 ? Math.max(4, Math.round((hero.views / max) * 100)) : 0;
  return (
    <Pressable onPress={onPress} style={s.heroRow}>
      <HeroThumb uri={hero.image} size={34} radius={9} />
      <View style={s.heroInfo}>
        <View style={s.heroTop}>
          <Text style={s.heroName} numberOfLines={1}>
            {hero.name}
          </Text>
          <Text style={s.heroViews}>{hero.views.toLocaleString()}</Text>
        </View>
        <View style={s.heroTrack}>
          <View style={[s.heroFill, { width: `${pct}%` }]} />
        </View>
      </View>
      <Ionicons name="open-outline" size={14} color="rgba(41,60,67,0.3)" />
    </Pressable>
  );
}

export function TrafficDomain({
  data,
  loading,
  narrow,
  days,
  onDaysChange,
}: {
  data: TrafficOverview | null;
  loading: boolean;
  narrow: boolean;
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const router = useRouter();

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

  const { totals, prev, audience, series, topHeroes, live, activeNow, today, acquisition } = data;
  const acqMax = Math.max(1, ...acquisition.map((a) => a.visitors));
  const seriesViews = series.map((d) => d.views);
  const seriesVisitors = series.map((d) => d.visitors);
  const signedTotal = audience.signedIn + audience.anon;
  const signedPct = signedTotal > 0 ? Math.round((audience.signedIn / signedTotal) * 100) : 0;
  const heroMax = Math.max(1, ...topHeroes.map((h) => h.views));
  const perDay = (n: number) => Math.max(1, Math.round(n / data.rangeDays));

  return (
    <Bento>
      {/* Headline KPIs — value + growth delta + trend shape */}
      <View style={s.kpiRow}>
        <TrafficKpi
          label="Page views"
          value={totals.pageViews.toLocaleString()}
          tint={COLORS.navy}
          delta={pctDelta(totals.pageViews, prev.pageViews)}
          spark={seriesViews}
          footer={
            <Text style={s.kpiFoot}>{perDay(totals.pageViews).toLocaleString()}/day avg</Text>
          }
        />
        <TrafficKpi
          label="Visitors"
          value={totals.visitors.toLocaleString()}
          tint={COLORS.blue}
          delta={pctDelta(totals.visitors, prev.visitors)}
          spark={seriesVisitors}
          footer={<Text style={s.kpiFoot}>{perDay(totals.visitors).toLocaleString()}/day avg</Text>}
        />
        <TrafficKpi
          label="Active now"
          value={activeNow.toLocaleString()}
          tint={COLORS.green}
          live
          footer={<Text style={s.kpiFoot}>{today.views.toLocaleString()} views today</Text>}
        />
        <TrafficKpi
          label="Signed-in share"
          value={`${signedPct}%`}
          tint={COLORS.orange}
          footer={<SignedSplit signedIn={audience.signedIn} anon={audience.anon} />}
        />
      </View>

      {/* Trend — the readable dual-series chart + range toggle */}
      <Panel
        title="Traffic over time"
        hint={`Views & visitors · last ${data.rangeDays} days`}
        action={<PillGroup options={RANGES} value={days} onChange={onDaysChange} />}
      >
        {totals.pageViews === 0 ? (
          <EmptyState text="No views recorded yet — the trend fills in daily." />
        ) : (
          <TrafficTrendChart series={series} height={narrow ? 176 : 210} />
        )}
      </Panel>

      {/* What's hot + who's here now */}
      <Bento.Row narrow={narrow}>
        <Panel title="Top heroes" hint="Most-viewed characters" style={s.flex15}>
          {topHeroes.length === 0 ? (
            <EmptyState text="No character views yet." />
          ) : (
            <View style={s.heroList}>
              {topHeroes.map((h) => (
                <HeroRow
                  key={h.id}
                  hero={h}
                  max={heroMax}
                  onPress={() => router.push(`/character/${h.id}`)}
                />
              ))}
            </View>
          )}
        </Panel>

        <Panel title="Live activity" hint="Most recent views" style={s.flex1}>
          <LiveFeed hits={live} activeNow={activeNow} />
        </Panel>
      </Bento.Row>

      {/* Acquisition — where visitors (and signups) come from, by tagged campaign */}
      <Panel
        title="Acquisition"
        hint="First-touch by campaign · UTM-tagged links"
        action={<Text style={s.kpiFoot}>{acquisition.length ? '' : 'tag your links →'}</Text>}
      >
        {acquisition.length === 0 ? (
          <EmptyState text="No tagged campaigns yet. Add UTM tags to your TikTok bio link and post links — see docs/marketing/utm-attribution.md." />
        ) : (
          <View style={s.barList}>
            {acquisition.map((a, i) => (
              <AcqRow key={i} row={a} max={acqMax} />
            ))}
          </View>
        )}
      </Panel>

      {/* Breakdowns */}
      <Bento.Row narrow={narrow}>
        <Panel title="Top pages" hint="Grouped routes" style={s.flex1}>
          <BarList<RouteViews>
            rows={data.topPages}
            empty="No page views yet."
            label={(r) => r.route}
            value={(r) => r.views}
          />
        </Panel>
        <Panel title="Top referrers" hint="Where visitors arrive from" style={s.flex1}>
          <BarList<ReferrerViews>
            rows={data.topReferrers}
            empty="No external referrers yet."
            label={(r) => r.source}
            value={(r) => r.views}
          />
        </Panel>
        <Panel title="Devices" hint="Views by device" style={s.flex1}>
          <BarList<DeviceViews>
            rows={data.devices}
            empty="No device data yet."
            label={(d) => d.label}
            value={(d) => d.views}
          />
        </Panel>
      </Bento.Row>
    </Bento>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  flex15: { flex: 1.5 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiFoot: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
  // Signed-in split
  splitWrap: { flex: 1, gap: 4 },
  splitTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(41,60,67,0.1)',
    overflow: 'hidden',
  },
  splitFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.orange },
  splitCap: { fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: COLORS.grey },
  // Top heroes
  heroList: { gap: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  heroInfo: { flex: 1, gap: 4 },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  heroName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  heroViews: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy },
  heroTrack: { height: 5, borderRadius: 999, backgroundColor: '#efe6d6', overflow: 'hidden' },
  heroFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.orange },
  // Horizontal bar lists (breakdowns)
  barList: { gap: 8 },
  barRow: { gap: 4 },
  barLabelWrap: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.black },
  barVal: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: '#efe6d6', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.orange },
  acqCap: { fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: COLORS.grey },
  locked: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  lockedText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 360,
  },
});
