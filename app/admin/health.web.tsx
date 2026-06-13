import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../../src/hooks/useAuth';
import { getProfile } from '../../src/lib/db/profiles';
import { useWebCanvas } from '../../src/hooks/useWebCanvas';
import { LogoLoader } from '../../src/components/ui/LogoLoader';
import { COLORS } from '../../src/constants/colors';
import {
  getCatalogHealth,
  getCoverageGaps,
  GAP_PAGE_SIZE,
  type CatalogHealth,
  type CoverageMetric,
} from '../../src/lib/db/catalogHealth';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const pct = (have: number, total: number) => (total > 0 ? Math.round((have / total) * 100) : 0);

/** Health colour ramp: red (poor) → gold (partial) → green (strong). */
const healthColor = (p: number) =>
  p >= 80 ? COLORS.green : p >= 50 ? COLORS.yellow : COLORS.red;

// ── Coverage metric catalogue (label, tint, whether it has a worklist) ────────
interface MetricDef {
  key: keyof CatalogHealth['metrics'];
  label: string;
  blurb: string;
  tint: string;
  worklist?: CoverageMetric;
}
const METRICS: MetricDef[] = [
  { key: 'portrait', label: 'AI Portraits', blurb: 'Styled hero art', tint: COLORS.orange, worklist: 'portrait' },
  { key: 'summary', label: 'Summaries', blurb: 'Short bio deck', tint: COLORS.blue, worklist: 'summary' },
  { key: 'firstIssue', label: 'First Issue', blurb: 'Debut + cover', tint: COLORS.gold, worklist: 'firstIssue' },
  { key: 'image', label: 'Source Image', blurb: 'ComicVine art', tint: COLORS.green },
  { key: 'stats', label: 'Powerstats', blurb: 'The six dials', tint: COLORS.green },
];

const WORKLIST_LABEL: Record<CoverageMetric, string> = {
  portrait: 'AI Portraits',
  summary: 'Summaries',
  firstIssue: 'First Issue',
};

// ── Completeness gauge ────────────────────────────────────────────────────────
function Gauge({ value, anim }: { value: number; anim: Animated.Value }) {
  const size = 150;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tint = healthColor(value);
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [c, c * (1 - value / 100)] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </Svg>
      <View style={styles.gaugeCenter}>
        <View style={styles.gaugeNumRow}>
          <Text style={styles.gaugeNum}>{value}</Text>
          <Text style={styles.gaugePct}>%</Text>
        </View>
        <Text style={[styles.gaugeCaption, { color: tint }]}>complete</Text>
      </View>
    </View>
  );
}

// ── Coverage row (tappable → drives the worklist) ─────────────────────────────
function CoverageRow({
  def,
  have,
  total,
  anim,
  active,
  onPress,
}: {
  def: MetricDef;
  have: number;
  total: number;
  anim: Animated.Value;
  active: boolean;
  onPress?: () => void;
}) {
  const p = pct(have, total);
  const gap = total - have;
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${p}%`] });
  const tappable = !!onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={!tappable}
      style={({ hovered }: { hovered?: boolean }) =>
        [styles.covRow, active && styles.covRowActive, hovered && tappable && styles.covRowHover] as object
      }
    >
      <View style={[styles.covDot, { backgroundColor: def.tint }]} />
      <View style={styles.covMain}>
        <View style={styles.covHead}>
          <Text style={styles.covLabel}>
            {def.label}
            {gap === 0 && <Text style={styles.covDone}>  ✓</Text>}
          </Text>
          <Text style={[styles.covPctNum, { color: def.tint }]}>{p}%</Text>
        </View>
        <View style={styles.covTrack}>
          <Animated.View style={[styles.covFill, { width, backgroundColor: def.tint }]} />
        </View>
        <View style={styles.covFoot}>
          <Text style={styles.covBlurb}>{def.blurb}</Text>
          <Text style={styles.covGap}>
            {gap > 0 ? `${gap.toLocaleString()} missing` : 'fully covered'}
          </Text>
        </View>
      </View>
      {tappable && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={active ? def.tint : 'rgba(41,60,67,0.25)'}
          style={{ marginLeft: 4 }}
        />
      )}
    </Pressable>
  );
}

function MastStat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={styles.mstat}>
      <Text style={[styles.mstatNum, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={styles.mstatLabel}>{label}</Text>
    </View>
  );
}

export default function AdminHealthScreen() {
  useWebCanvas(COLORS.beige);
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const narrow = winW < 760;
  const { user, loading: authLoading } = useAuth();

  const [metric, setMetric] = useState<CoverageMetric>('portrait');
  const [page, setPage] = useState(0);

  const profileQ = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });
  const gateResolved = !authLoading && (!user || profileQ.isSuccess || profileQ.isError);
  const isAdmin = !!profileQ.data?.is_admin;
  useEffect(() => {
    if (gateResolved && !isAdmin) router.replace('/explore');
  }, [gateResolved, isAdmin, router]);

  const healthQ = useQuery({
    queryKey: ['catalogHealth'],
    queryFn: getCatalogHealth,
    enabled: gateResolved && isAdmin,
    staleTime: 60_000,
  });
  const gapsQ = useQuery({
    queryKey: ['coverageGaps', metric, page],
    queryFn: () => getCoverageGaps(metric, { page }),
    enabled: gateResolved && isAdmin,
    staleTime: 60_000,
  });

  const h = healthQ.data;

  // Catalog completeness = mean of the five tracked metric percentages.
  const overall = useMemo(() => {
    if (!h || h.total === 0) return 0;
    const ps = METRICS.map((m) => pct(h.metrics[m.key], h.total));
    return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length);
  }, [h]);

  // One driver animates the gauge sweep + every bar fill on first paint.
  const anim = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!h) return;
    Animated.stagger(90, [
      Animated.timing(enter, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
    ]).start();
  }, [h, anim, enter]);

  if (!gateResolved || !isAdmin) return <LogoLoader />;

  const gaps = gapsQ.data;
  const enterStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };

  return (
    <View style={styles.page}>
      <Animated.View style={[styles.inner, enterStyle]}>
        {/* ── Masthead ── */}
        <LinearGradient
          colors={['#10242e', COLORS.deepNavy]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.masthead, narrow && styles.mastheadNarrow]}
        >
          <View style={styles.mastheadGlow} />
          <View style={styles.mastheadLeft}>
            <Text style={styles.kicker}>MYTHIQUE · ARCHIVE CONTROL</Text>
            <Text style={styles.title}>Catalog Health</Text>
            <Text style={styles.subtitle}>
              {h ? 'Live coverage across the archive' : 'Loading the archive…'}
            </Text>
            {h && (
              <View style={styles.scoreboard}>
                <MastStat value={h.total.toLocaleString()} label="Heroes" />
                <View style={styles.scoreDivider} />
                <MastStat
                  value={`${pct(h.metrics.portrait, h.total)}%`}
                  label="Portraits"
                  tint={COLORS.orange}
                />
                <View style={styles.scoreDivider} />
                <MastStat
                  value={(h.total - h.metrics.portrait).toLocaleString()}
                  label="Awaiting"
                  tint={COLORS.yellow}
                />
                <View style={styles.scoreDivider} />
                <MastStat value={`${h.byPublisher.length}`} label="Publishers" tint={COLORS.blue} />
              </View>
            )}
            <View style={styles.statusRow}>
              {h &&
                Object.entries(h.cvStatus).map(([k, v]) => (
                  <View key={k} style={styles.statusChip}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            k === 'done' ? COLORS.green : k === 'failed' ? COLORS.red : COLORS.yellow,
                        },
                      ]}
                    />
                    <Text style={styles.statusChipText}>
                      {k} · {v.toLocaleString()}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
          {h && <Gauge value={overall} anim={anim} />}
        </LinearGradient>

        <View style={[styles.cols, narrow && styles.colsNarrow]}>
          {/* ── Coverage ── */}
          <View style={[styles.card, styles.coverageCard, !narrow && styles.colLeft]}>
            <Text style={styles.cardTitle}>Coverage</Text>
            <Text style={styles.cardHint}>Sorted by weakest first · tap one to load its queue</Text>
            {!h ? (
              <ActivityIndicator color={COLORS.orange} style={{ marginTop: 20 }} />
            ) : (
              [...METRICS]
                .sort((a, b) => pct(h.metrics[a.key], h.total) - pct(h.metrics[b.key], h.total))
                .map((def) => (
                  <CoverageRow
                    key={def.key}
                    def={def}
                    have={h.metrics[def.key]}
                    total={h.total}
                    anim={anim}
                    active={def.worklist === metric}
                    onPress={
                      def.worklist
                        ? () => {
                            setMetric(def.worklist!);
                            setPage(0);
                          }
                        : undefined
                    }
                  />
                ))
            )}
          </View>

          {/* ── Backfill queue ── */}
          <View style={[styles.card, !narrow && styles.colRight]}>
            <View style={styles.queueHead}>
              <Text style={styles.cardTitle}>Backfill queue</Text>
              <Text style={styles.cardHint}>Most-viewed first</Text>
            </View>
            <View style={styles.tabs}>
              {(Object.keys(WORKLIST_LABEL) as CoverageMetric[]).map((m) => {
                const def = METRICS.find((d) => d.worklist === m)!;
                const gap = h ? h.total - h.metrics[def.key] : 0;
                const on = metric === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setMetric(m);
                      setPage(0);
                    }}
                    style={[styles.tab, on && { backgroundColor: def.tint }]}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>{WORKLIST_LABEL[m]}</Text>
                    {h && (
                      <View style={[styles.tabBadge, on && styles.tabBadgeOn]}>
                        <Text style={[styles.tabBadgeText, on && { color: def.tint }]}>
                          {gap.toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {gapsQ.isLoading || !gaps ? (
              <ActivityIndicator color={COLORS.orange} style={{ marginTop: 24 }} />
            ) : gaps.heroes.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="checkmark-done-circle" size={40} color={COLORS.green} />
                <Text style={styles.emptyText}>Queue clear — every hero has this.</Text>
              </View>
            ) : (
              <>
                {gaps.heroes.map((hero, i) => (
                  <Pressable
                    key={hero.id}
                    onPress={() => router.push(`/character/${hero.id}`)}
                    style={({ hovered }: { hovered?: boolean }) =>
                      [styles.gapRow, hovered && styles.gapRowHover] as object
                    }
                  >
                    <Text style={styles.gapRank}>{page * GAP_PAGE_SIZE + i + 1}</Text>
                    {hero.image_url ? (
                      <Image source={{ uri: hero.image_url }} style={styles.thumb} contentFit="cover" transition={150} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbBlank]}>
                        <Ionicons name="person" size={16} color="rgba(41,60,67,0.3)" />
                      </View>
                    )}
                    <View style={styles.gapInfo}>
                      <Text style={styles.gapName} numberOfLines={1}>
                        {hero.name}
                      </Text>
                      <View style={styles.gapSub}>
                        <View style={styles.pubChip}>
                          <Text style={styles.pubChipText} numberOfLines={1}>
                            {hero.publisher ?? '—'}
                          </Text>
                        </View>
                        {hero.issue_count != null && (
                          <Text style={styles.gapApps}>{hero.issue_count.toLocaleString()} apps</Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name="open-outline" size={16} color="rgba(41,60,67,0.3)" />
                  </Pressable>
                ))}
                <View style={styles.pager}>
                  <Pressable
                    disabled={page === 0}
                    onPress={() => setPage((p) => Math.max(0, p - 1))}
                    style={[styles.pageBtn, page === 0 && styles.pageBtnOff]}
                  >
                    <Ionicons name="arrow-back" size={15} color="#fff" />
                  </Pressable>
                  <Text style={styles.pageInfo}>
                    {(page * GAP_PAGE_SIZE + 1).toLocaleString()}–
                    {Math.min((page + 1) * GAP_PAGE_SIZE, gaps.total).toLocaleString()} of{' '}
                    {gaps.total.toLocaleString()}
                  </Text>
                  <Pressable
                    disabled={(page + 1) * GAP_PAGE_SIZE >= gaps.total}
                    onPress={() => setPage((p) => p + 1)}
                    style={[
                      styles.pageBtn,
                      (page + 1) * GAP_PAGE_SIZE >= gaps.total && styles.pageBtnOff,
                    ]}
                  >
                    <Ionicons name="arrow-forward" size={15} color="#fff" />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Publisher heatmap ── */}
        {h && h.byPublisher.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Coverage by publisher</Text>
            <Text style={styles.cardHint}>Top {h.byPublisher.length} by catalogue size</Text>
            <View style={[styles.pubHeadRow]}>
              <Text style={[styles.pubCellName, styles.pubHeadText]}>Publisher</Text>
              <Text style={[styles.pubCellNum, styles.pubHeadText]}>Heroes</Text>
              <Text style={[styles.pubCellPct, styles.pubHeadText]}>Portrait</Text>
              <Text style={[styles.pubCellPct, styles.pubHeadText]}>Summary</Text>
              <Text style={[styles.pubCellPct, styles.pubHeadText]}>Stats</Text>
            </View>
            {h.byPublisher.map((p) => {
              const pp = pct(p.portrait, p.total);
              const ps = pct(p.summary, p.total);
              const pt = pct(p.stats, p.total);
              const cell = (val: number) => (
                <View style={styles.pubCellPct}>
                  <View style={[styles.heat, { backgroundColor: healthColor(val) + '22' }]}>
                    <Text style={[styles.heatText, { color: healthColor(val) }]}>{val}%</Text>
                  </View>
                </View>
              );
              return (
                <View key={p.publisher} style={styles.pubRow}>
                  <Text style={styles.pubCellName} numberOfLines={1}>
                    {p.publisher}
                  </Text>
                  <Text style={styles.pubCellNum}>{p.total.toLocaleString()}</Text>
                  {cell(pp)}
                  {cell(ps)}
                  {cell(pt)}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.View>
    </View>
  );
}

const card = {
  backgroundColor: '#fffdf8',
  borderRadius: 20,
  padding: 22,
  borderWidth: 1,
  borderColor: 'rgba(41,60,67,0.06)',
  shadowColor: '#3a2a14',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
} as const;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.beige, minHeight: '100%' as unknown as number },
  inner: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 24, gap: 18 },

  // Masthead
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 24,
    padding: 28,
    paddingRight: 36,
    overflow: 'hidden',
  },
  mastheadNarrow: { flexDirection: 'column', alignItems: 'flex-start', gap: 24, paddingRight: 28 },
  mastheadGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: COLORS.orange,
    opacity: 0.14,
  },
  mastheadLeft: { gap: 6, flexShrink: 1 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    color: COLORS.orange,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 46, color: '#fff', lineHeight: 50 },
  subtitle: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.6)' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 7 },
  statusChipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.85)' },

  // Gauge
  gaugeCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  gaugeNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  gaugeNum: { fontFamily: 'Flame-Regular', fontSize: 46, color: '#fff', lineHeight: 48 },
  gaugePct: { fontFamily: 'Flame-Regular', fontSize: 19, color: 'rgba(255,255,255,0.55)' },
  gaugeCaption: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // Masthead scoreboard
  scoreboard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' },
  scoreDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.13)' },
  mstat: { gap: 1 },
  mstatNum: { fontFamily: 'Flame-Regular', fontSize: 27, color: '#fff', lineHeight: 29 },
  mstatLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.5)',
  },

  // Columns
  cols: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  colsNarrow: { flexDirection: 'column' },
  colLeft: { width: 360, flexGrow: 0, flexShrink: 0 },
  colRight: { flex: 1 },

  card,
  coverageCard: { gap: 4 },
  cardTitle: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.black },
  cardHint: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey, marginBottom: 8 },

  // Coverage rows
  covRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 14,
  },
  covRowActive: { backgroundColor: 'rgba(231,115,51,0.06)' },
  covRowHover: { backgroundColor: 'rgba(41,60,67,0.04)' },
  covDot: { width: 10, height: 10, borderRadius: 10, marginTop: 2, alignSelf: 'flex-start' },
  covMain: { flex: 1, gap: 6 },
  covHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  covLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.black },
  covDone: { color: COLORS.green },
  covPctNum: { fontFamily: 'Flame-Regular', fontSize: 20 },
  covTrack: { height: 9, borderRadius: 5, backgroundColor: '#efe6d6', overflow: 'hidden' },
  covFill: { height: 9, borderRadius: 5 },
  covFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  covBlurb: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  covGap: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  // Queue
  queueHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 8, flexWrap: 'wrap' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#efe6d6',
  },
  tabText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  tabTextOn: { color: '#fff' },
  tabBadge: {
    backgroundColor: 'rgba(41,60,67,0.12)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  tabBadgeOn: { backgroundColor: '#fff' },
  tabBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.navy },

  empty: { alignItems: 'center', gap: 10, paddingVertical: 36 },
  emptyText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.grey },

  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 12,
  },
  gapRowHover: { backgroundColor: 'rgba(41,60,67,0.04)' },
  gapRank: {
    width: 26,
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: 'rgba(41,60,67,0.35)',
    textAlign: 'center',
  },
  thumb: { width: 38, height: 48, borderRadius: 8, backgroundColor: '#efe6d6' },
  thumbBlank: { alignItems: 'center', justifyContent: 'center' },
  gapInfo: { flex: 1, gap: 4, minWidth: 0 },
  gapName: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  gapSub: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pubChip: {
    backgroundColor: '#efe6d6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 160,
  },
  pubChipText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.navy },
  gapApps: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },

  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1ece2',
  },
  pageBtn: {
    width: 38,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnOff: { opacity: 0.3 },
  pageInfo: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },

  // Publisher heatmap
  pubHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#efe6d6',
    marginTop: 4,
  },
  pubHeadText: { color: COLORS.grey, fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 0.5 },
  pubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f0e6',
  },
  pubCellName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  pubCellNum: { width: 70, textAlign: 'right', fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.navy },
  pubCellPct: { width: 92, alignItems: 'flex-end' },
  heat: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3, minWidth: 46, alignItems: 'center' },
  heatText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
});
