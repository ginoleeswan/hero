// Command home — the read-only glance. Synthesises the catalogue's state from
// existing primitives and deep-links into each domain. No mutations live here
// (actions are in Operations); no big gauge (the dark top bar owns it).
import { View, Text, Pressable, Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { HeroThumb } from '../atoms';
import { Donut, CompletenessChart } from '../charts';
import { pct, healthColor, METRICS } from '../format';
import type {
  CatalogHealth,
  GapPage,
  Distributions,
  HealthSnapshot,
  GeminiSpend,
  CoverageMetric,
} from '../../../../lib/db/catalogHealth';

function CoverageBar({
  label,
  tint,
  have,
  total,
  anim,
  onPress,
}: {
  label: string;
  tint: string;
  have: number;
  total: number;
  anim: Animated.Value;
  onPress?: () => void;
}) {
  const p = pct(have, total);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${p}%`] });
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={s.cbRow}>
      <View style={s.cbHead}>
        <Text style={s.cbLabel}>{label}</Text>
        <Text style={[s.cbPct, { color: tint }]}>{p}%</Text>
      </View>
      <View style={s.cbTrack}>
        <Animated.View style={[s.cbFill, { width, backgroundColor: tint }]} />
      </View>
    </Pressable>
  );
}

export function CommandHome({
  h,
  overall,
  snaps,
  dist,
  gaps,
  spend,
  anim,
  narrow,
  onJump,
  onOpenSpend,
  onSnapshot,
  snapshotting,
}: {
  h: CatalogHealth;
  overall: number;
  snaps: HealthSnapshot[];
  dist?: Distributions;
  gaps?: GapPage;
  spend?: GeminiSpend;
  anim: Animated.Value;
  narrow: boolean;
  onJump: (metric?: CoverageMetric) => void;
  onOpenSpend: () => void;
  onSnapshot: () => void;
  snapshotting: boolean;
}) {
  const router = useRouter();
  const align = dist?.alignment;
  const alignTotal = align ? align.good + align.bad + align.neutral + align.unknown : 0;
  const queue = gaps?.heroes.slice(0, 4) ?? [];
  const days = spend?.available ? (spend.days ?? []) : [];
  const spendMax = Math.max(1, ...days.map((d) => d.cost));

  return (
    <Bento>
      <Bento.Row narrow={narrow}>
        {/* Coverage */}
        <Panel
          title="Catalog coverage"
          hint="Tap a metric to load its backfill queue"
          style={s.flex15}
        >
          <View style={s.headline}>
            <View>
              <Text style={[s.bigPct, { color: healthColor(overall) }]}>{overall}%</Text>
              <Text style={s.bigCaption}>catalogue complete</Text>
            </View>
            <View style={s.headlineStat}>
              <Text style={s.statNum}>{h.total.toLocaleString()}</Text>
              <Text style={s.statLabel}>heroes tracked</Text>
            </View>
          </View>
          <View style={s.bars}>
            {[...METRICS]
              .sort((a, b) => pct(h.metrics[a.key], h.total) - pct(h.metrics[b.key], h.total))
              .map((def) => (
                <CoverageBar
                  key={def.key}
                  label={def.label}
                  tint={def.tint}
                  have={h.metrics[def.key]}
                  total={h.total}
                  anim={anim}
                  onPress={def.worklist ? () => onJump(def.worklist) : undefined}
                />
              ))}
          </View>
        </Panel>

        {/* Completeness trend */}
        <Panel
          title="Completeness over time"
          hint={`Daily snapshots · now ${overall}%`}
          style={s.flex1}
          action={
            <Pressable
              onPress={onSnapshot}
              disabled={snapshotting}
              style={[s.mini, snapshotting && s.dim]}
            >
              {snapshotting ? (
                <ActivityIndicator size="small" color={COLORS.navy} />
              ) : (
                <Ionicons name="camera-outline" size={14} color={COLORS.navy} />
              )}
              <Text style={s.miniText}>Snapshot</Text>
            </Pressable>
          }
        >
          {snaps.length >= 2 ? (
            <CompletenessChart snaps={snaps} />
          ) : (
            <View style={s.empty}>
              <Ionicons name="trending-up-outline" size={18} color={COLORS.grey} />
              <Text style={s.emptyText}>History begins today — the trend line fills in daily.</Text>
            </View>
          )}
        </Panel>
      </Bento.Row>

      <Bento.Row narrow={narrow}>
        {/* Backfill queue preview */}
        <Panel
          title="Backfill queue"
          hint="Weakest metric · most-viewed first"
          style={s.flex15}
          action={
            <Pressable onPress={() => onJump()} style={s.mini}>
              <Text style={s.miniText}>View all</Text>
              <Ionicons name="chevron-forward" size={13} color={COLORS.navy} />
            </Pressable>
          }
        >
          {queue.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-done-circle" size={22} color={COLORS.green} />
              <Text style={s.emptyText}>Queue clear.</Text>
            </View>
          ) : (
            queue.map((hero) => (
              <Pressable
                key={hero.id}
                onPress={() => router.push(`/character/${hero.id}`)}
                style={s.qRow}
              >
                <HeroThumb uri={hero.image_url} size={30} radius={8} />
                <View style={s.qInfo}>
                  <Text style={s.qName} numberOfLines={1}>
                    {hero.name}
                  </Text>
                  <Text style={s.qSub} numberOfLines={1}>
                    {hero.publisher ?? '—'}
                    {hero.issue_count != null ? ` · ${hero.issue_count.toLocaleString()} apps` : ''}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={15} color="rgba(41,60,67,0.3)" />
              </Pressable>
            ))
          )}
        </Panel>

        {/* Alignment */}
        <Panel title="Alignment" hint="Hero vs villain split" style={s.flex1}>
          {align ? (
            <View style={s.alignWrap}>
              <Donut
                total={alignTotal}
                segments={[
                  { value: align.good, color: COLORS.green, label: 'Heroes' },
                  { value: align.bad, color: COLORS.red, label: 'Villains' },
                  { value: align.neutral, color: COLORS.yellow, label: 'Neutral' },
                  { value: align.unknown, color: COLORS.grey, label: 'Unknown' },
                ]}
              />
              <View style={s.legend}>
                {[
                  { c: COLORS.green, l: 'Heroes', v: align.good },
                  { c: COLORS.red, l: 'Villains', v: align.bad },
                  { c: COLORS.yellow, l: 'Neutral', v: align.neutral },
                  { c: COLORS.grey, l: 'Unknown', v: align.unknown },
                ].map((seg) => (
                  <View key={seg.l} style={s.legendRow}>
                    <View style={[s.legendDot, { backgroundColor: seg.c }]} />
                    <Text style={s.legendLabel}>{seg.l}</Text>
                    <Text style={s.legendVal}>{seg.v.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <ActivityIndicator color={COLORS.orange} style={{ marginTop: 16 }} />
          )}
        </Panel>

        {/* Spend */}
        <Panel title="Spend · 28d" hint="Gemini / GCP" style={s.flex1}>
          <Pressable onPress={onOpenSpend} style={s.spendWrap}>
            <Text style={s.spendBig}>
              {spend?.available ? `$${(spend.monthToDate ?? 0).toFixed(0)}` : '—'}
            </Text>
            <Text style={s.spendLabel}>month to date</Text>
            {days.length > 0 && (
              <View style={s.spendBars}>
                {days.map((d) => (
                  <View key={d.day} style={s.spendCol}>
                    <View
                      style={[s.spendBar, { height: `${Math.round((d.cost / spendMax) * 100)}%` }]}
                    />
                  </View>
                ))}
              </View>
            )}
            <View style={s.spendCta}>
              <Text style={s.miniText}>Open spend</Text>
              <Ionicons name="chevron-forward" size={13} color={COLORS.navy} />
            </View>
          </Pressable>
        </Panel>
      </Bento.Row>
    </Bento>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  flex15: { flex: 1.5 },
  headline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bigPct: { fontFamily: 'Flame-Regular', fontSize: 40, lineHeight: 42 },
  bigCaption: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  headlineStat: { alignItems: 'flex-end' },
  statNum: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.black, lineHeight: 24 },
  statLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.4, color: COLORS.grey },
  bars: { gap: 9 },
  cbRow: { gap: 4 },
  cbHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cbLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.black },
  cbPct: { fontFamily: 'Flame-Regular', fontSize: 13 },
  cbTrack: { height: 6, borderRadius: 4, backgroundColor: '#ece2cf', overflow: 'hidden' },
  cbFill: { height: 6, borderRadius: 4 },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#efe6d6',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  miniText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  dim: { opacity: 0.4 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  emptyText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 220,
  },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  qInfo: { flex: 1, gap: 1 },
  qName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  qSub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  alignWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legend: { flex: 1, gap: 5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 8 },
  legendLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.black },
  legendVal: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  spendWrap: { gap: 2 },
  spendBig: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.black, lineHeight: 28 },
  spendLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    color: COLORS.grey,
  },
  spendBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 40, marginTop: 8 },
  spendCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  spendBar: { borderRadius: 2, backgroundColor: COLORS.orange, opacity: 0.8 },
  spendCta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 10 },
});
