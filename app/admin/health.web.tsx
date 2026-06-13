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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { useAuth } from '../../src/hooks/useAuth';
import { getProfile } from '../../src/lib/db/profiles';
import { useWebCanvas } from '../../src/hooks/useWebCanvas';
import { LogoLoader } from '../../src/components/ui/LogoLoader';
import { COLORS } from '../../src/constants/colors';
import {
  getCatalogHealth,
  getCoverageGaps,
  getRecentRuns,
  getCronStatus,
  getComicvineUsageLastHour,
  runDrain,
  retryFailed,
  setDrainCron,
  getHealthSnapshots,
  getCatalogDistributions,
  GAP_PAGE_SIZE,
  type CatalogHealth,
  type CoverageMetric,
  type PublisherCoverage,
  type EnrichmentRun,
  type HealthSnapshot,
} from '../../src/lib/db/catalogHealth';

const DRAIN_CRON = 'enrich-comicvine-pending';
const CV_HOURLY_CAP = 200;

const relTime = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

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
function Gauge({ value }: { value: number }) {
  const size = 150;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tint = healthColor(value);
  const offset = c * (1 - value / 100);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
        <Circle
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

// One publisher sub-table (header + rows) — rendered twice side-by-side on wide.
function PublisherTable({ rows }: { rows: PublisherCoverage[] }) {
  const cell = (val: number) => (
    <View style={styles.pubCellPct}>
      <View style={[styles.heat, { backgroundColor: healthColor(val) + '22' }]}>
        <Text style={[styles.heatText, { color: healthColor(val) }]}>{val}%</Text>
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.pubHeadRow}>
        <Text style={[styles.pubCellName, styles.pubHeadText]}>Publisher</Text>
        <Text style={[styles.pubCellNum, styles.pubHeadText]}>Heroes</Text>
        <Text style={[styles.pubCellPct, styles.pubHeadText]}>Portrait</Text>
        <Text style={[styles.pubCellPct, styles.pubHeadText]}>Summary</Text>
        <Text style={[styles.pubCellPct, styles.pubHeadText]}>Stats</Text>
      </View>
      {rows.map((p) => (
        <View key={p.publisher} style={styles.pubRow}>
          <Text style={styles.pubCellName} numberOfLines={1}>
            {p.publisher}
          </Text>
          <Text style={styles.pubCellNum}>{p.total.toLocaleString()}</Text>
          {cell(pct(p.portrait, p.total))}
          {cell(pct(p.summary, p.total))}
          {cell(pct(p.stats, p.total))}
        </View>
      ))}
    </View>
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

// Segmented ring (alignment split).
function Donut({
  segments,
  total,
}: {
  segments: { value: number; color: string; label: string }[];
  total: number;
}) {
  const size = 132;
  const stroke = 17;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#efe6d6" strokeWidth={stroke} fill="none" />
        {segments.map((s, i) => {
          const frac = total > 0 ? s.value / total : 0;
          const el = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${frac * c} ${c}`}
              strokeDashoffset={-acc * c}
            />
          );
          acc += frac;
          return el;
        })}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={styles.donutNum}>{total.toLocaleString()}</Text>
        <Text style={styles.donutLabel}>heroes</Text>
      </View>
    </View>
  );
}

// Completeness-over-time area+line. Fixed 0–100 Y scale; width measured on layout.
function CompletenessChart({ snaps }: { snaps: HealthSnapshot[] }) {
  const [w, setW] = useState(0);
  const H = 160;
  const padT = 12;
  const padB = 22;
  const vals = snaps.map((s) => {
    const ms = [s.portrait, s.image, s.stats, s.summary, s.first_issue].map((m) =>
      s.total > 0 ? (m / s.total) * 100 : 0,
    );
    return Math.round(ms.reduce((a, b) => a + b, 0) / ms.length);
  });
  const yOf = (v: number) => padT + (1 - v / 100) * (H - padT - padB);
  const xOf = (i: number) => (vals.length <= 1 ? w / 2 : (i / (vals.length - 1)) * w);
  const line = vals.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  const area = vals.length
    ? `M0,${H - padB} ` + vals.map((v, i) => `L${xOf(i)},${yOf(v)}`).join(' ') + ` L${w},${H - padB} Z`
    : '';
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 && (
        <Svg width={w} height={H}>
          {[0, 50, 100].map((g) => (
            <Polyline
              key={g}
              points={`0,${yOf(g)} ${w},${yOf(g)}`}
              stroke="#efe6d6"
              strokeWidth={1}
            />
          ))}
          {area ? <Path d={area} fill={COLORS.green + '1f'} /> : null}
          {vals.length > 1 && (
            <Polyline points={line} fill="none" stroke={COLORS.green} strokeWidth={2.5} />
          )}
          {vals.map((v, i) => (
            <Circle key={i} cx={xOf(i)} cy={yOf(v)} r={vals.length === 1 ? 5 : 3.5} fill={COLORS.green} />
          ))}
        </Svg>
      )}
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
  const [tab, setTab] = useState<'overview' | 'backfill' | 'operations'>('overview');

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

  // ── Ops / monitoring ────────────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const opsEnabled = gateResolved && isAdmin;
  const runsQ = useQuery({
    queryKey: ['enrichmentRuns'],
    queryFn: () => getRecentRuns(8),
    enabled: opsEnabled,
    // Poll fast while a run is in flight, slow otherwise.
    refetchInterval: (q) =>
      ((q.state.data as EnrichmentRun[] | undefined) ?? []).some((r) => r.status === 'running')
        ? 2500
        : 15_000,
  });
  const cronQ = useQuery({ queryKey: ['cronStatus'], queryFn: getCronStatus, enabled: opsEnabled });
  const usageQ = useQuery({
    queryKey: ['cvUsage'],
    queryFn: getComicvineUsageLastHour,
    enabled: opsEnabled,
    refetchInterval: 30_000,
  });
  const distQ = useQuery({
    queryKey: ['distributions'],
    queryFn: getCatalogDistributions,
    enabled: opsEnabled,
    staleTime: 60_000,
  });
  const snapsQ = useQuery({
    queryKey: ['healthSnapshots'],
    queryFn: () => getHealthSnapshots(60),
    enabled: opsEnabled,
    staleTime: 60_000,
  });

  const drainJob = cronQ.data?.find((j) => j.jobname === DRAIN_CRON);
  const cronOn = !!drainJob?.active;
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const onRunDrain = async () => {
    setBusy('drain');
    try {
      await runDrain(25);
      flash('Batch queued — watch it run below.');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['enrichmentRuns'] }), 2000);
    } catch (e) {
      flash(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };
  const onRetryFailed = async () => {
    setBusy('retry');
    try {
      const n = await retryFailed();
      flash(`${n.toLocaleString()} failed hero${n === 1 ? '' : 'es'} requeued.`);
      queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
    } catch (e) {
      flash(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };
  const onToggleCron = async () => {
    setBusy('cron');
    try {
      const state = await setDrainCron(!cronOn);
      flash(`Drain cron ${state}.`);
      queryClient.invalidateQueries({ queryKey: ['cronStatus'] });
    } catch (e) {
      flash(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

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

  // While a run is in flight, poll backlog + usage so the live numbers tick down.
  useEffect(() => {
    const live = (runsQ.data ?? []).some((r) => r.status === 'running');
    if (!live) return;
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
      queryClient.invalidateQueries({ queryKey: ['cvUsage'] });
    }, 4000);
    return () => clearInterval(id);
  }, [runsQ.data, queryClient]);

  if (!gateResolved || !isAdmin) return <LogoLoader />;

  const gaps = gapsQ.data;
  const cvUsage = usageQ.data ?? 0;
  const cvPctUsed = Math.min(100, Math.round((cvUsage / CV_HOURLY_CAP) * 100));
  const cvColor =
    cvUsage >= CV_HOURLY_CAP * 0.8 ? COLORS.red : cvUsage >= CV_HOURLY_CAP * 0.5 ? COLORS.yellow : COLORS.green;
  const runs: EnrichmentRun[] = runsQ.data ?? [];
  const activeRun = runs.find((r) => r.status === 'running');
  const dist = distQ.data;
  const snaps = snapsQ.data ?? [];
  const align = dist?.alignment;
  const alignTotal = align ? align.good + align.bad + align.neutral + align.unknown : 0;
  const histMax = dist ? Math.max(1, ...dist.power_hist.map((b) => b.n)) : 1;
  const pubMax = h && h.byPublisher.length ? h.byPublisher[0].total : 1;
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
          {h && <Gauge value={overall} />}
        </LinearGradient>

        {/* ── Tab bar ── */}
        <View style={styles.tabBar}>
          {([
            { key: 'overview', label: 'Overview', icon: 'stats-chart' },
            { key: 'backfill', label: 'Backfill', icon: 'construct' },
            { key: 'operations', label: 'Operations', icon: 'pulse' },
          ] as const).map((t) => {
            const on = tab === t.key;
            const badge =
              t.key === 'backfill' && h ? (h.cvStatus.pending ?? 0) : undefined;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.navPill, on && styles.navPillOn]}
              >
                <Ionicons name={t.icon} size={16} color={on ? '#fff' : COLORS.navy} />
                <Text style={[styles.navPillText, on && styles.navPillTextOn]}>{t.label}</Text>
                {badge != null && badge > 0 && (
                  <View style={[styles.navBadge, on && styles.navBadgeOn]}>
                    <Text style={[styles.navBadgeText, on && { color: COLORS.orange }]}>
                      {badge > 999 ? `${Math.round(badge / 1000)}k` : badge}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Operations ── */}
        {tab === 'operations' && h && (
          <View style={styles.card}>
            <View style={styles.opsHead}>
              <Text style={styles.cardTitle}>Operations</Text>
              {toast && (
                <View style={styles.toastWrap}>
                  <Ionicons name="information-circle" size={15} color={COLORS.orange} />
                  <Text style={styles.toast}>{toast}</Text>
                </View>
              )}
            </View>
            {activeRun && (
              <View style={styles.activeRun}>
                <ActivityIndicator size="small" color={COLORS.orange} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeRunText}>
                    Draining live · {activeRun.done + activeRun.failed + activeRun.retry}/
                    {activeRun.processed} processed
                  </Text>
                  <Text style={styles.activeRunSub}>
                    {activeRun.done} done · {activeRun.failed} failed · {activeRun.retry} retry ·
                    started {relTime(activeRun.started_at ?? activeRun.created_at)}
                  </Text>
                </View>
              </View>
            )}
            <View style={[styles.opsBody, narrow && { flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={styles.opsActions}>
                <Pressable
                  onPress={onRunDrain}
                  disabled={!!busy}
                  style={[styles.actBtn, styles.actPrimary, !!busy && styles.actDim]}
                >
                  {busy === 'drain' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="play" size={15} color="#fff" />
                  )}
                  <Text style={styles.actPrimaryText}>Run batch · 25</Text>
                </Pressable>
                <Pressable
                  onPress={onRetryFailed}
                  disabled={!!busy || (h.cvStatus.failed ?? 0) === 0}
                  style={[
                    styles.actBtn,
                    styles.actGhost,
                    (!!busy || (h.cvStatus.failed ?? 0) === 0) && styles.actDim,
                  ]}
                >
                  {busy === 'retry' ? (
                    <ActivityIndicator size="small" color={COLORS.navy} />
                  ) : (
                    <Ionicons name="refresh" size={15} color={COLORS.navy} />
                  )}
                  <Text style={styles.actGhostText}>
                    Retry failed{h.cvStatus.failed ? ` · ${h.cvStatus.failed}` : ''}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onToggleCron}
                  disabled={!!busy}
                  style={[styles.actBtn, cronOn ? styles.actOn : styles.actGhost, !!busy && styles.actDim]}
                >
                  {busy === 'cron' ? (
                    <ActivityIndicator size="small" color={cronOn ? '#fff' : COLORS.navy} />
                  ) : (
                    <Ionicons
                      name={cronOn ? 'pause' : 'play-skip-forward'}
                      size={15}
                      color={cronOn ? '#fff' : COLORS.navy}
                    />
                  )}
                  <Text style={cronOn ? styles.actPrimaryText : styles.actGhostText}>
                    {cronOn ? 'Auto-drain ON' : 'Auto-drain OFF'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.opsMetrics}>
                <View style={styles.opsMetric}>
                  <Text style={styles.opsMetricNum}>{(h.cvStatus.pending ?? 0).toLocaleString()}</Text>
                  <Text style={styles.opsMetricLabel}>Pending backlog</Text>
                </View>
                <View style={styles.opsDivider} />
                <View style={styles.opsMetricWide}>
                  <View style={styles.opsMetricHead}>
                    <Text style={styles.opsMetricLabel}>ComicVine · last hour</Text>
                    <Text style={[styles.opsUsageNum, { color: cvColor }]}>
                      {cvUsage}/{CV_HOURLY_CAP}
                    </Text>
                  </View>
                  <View style={styles.cvTrack}>
                    <View style={[styles.cvFill, { width: `${cvPctUsed}%`, backgroundColor: cvColor }]} />
                  </View>
                  <Text style={styles.opsMetricSub}>
                    {cvUsage >= CV_HOURLY_CAP ? 'at cap — drains will throttle' : 'calls consumed'}
                  </Text>
                </View>
                <View style={styles.opsDivider} />
                <View style={styles.opsMetric}>
                  <Text style={[styles.opsMetricNum, { color: cronOn ? COLORS.green : COLORS.grey }]}>
                    {cronOn ? 'ON' : 'OFF'}
                  </Text>
                  <Text style={styles.opsMetricLabel}>
                    {drainJob?.last_run ? `ran ${relTime(drainJob.last_run)}` : 'auto-drain'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {tab === 'backfill' && (
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
        )}

        {/* ── Recent runs (monitoring) ── */}
        {tab === 'operations' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent runs</Text>
          <Text style={styles.cardHint}>Cron + manual · auto-refreshes every 15s</Text>
          {runsQ.isLoading ? (
            <ActivityIndicator color={COLORS.orange} style={{ marginTop: 16 }} />
          ) : runs.length === 0 ? (
            <Text style={styles.runsEmpty}>No runs logged yet — hit “Run batch · 25”.</Text>
          ) : (
            <>
              <View style={styles.runHeadRow}>
                <Text style={[styles.runWhen, styles.runHeadText]}>When</Text>
                <Text style={[styles.runStatusCol, styles.runHeadText]}>State</Text>
                <Text style={[styles.runBy, styles.runHeadText]}>Source</Text>
                <Text style={[styles.runStat, styles.runHeadText]}>Done</Text>
                <Text style={[styles.runStat, styles.runHeadText]}>Failed</Text>
                <Text style={[styles.runStat, styles.runHeadText]}>Retry</Text>
                <Text style={[styles.runStat, styles.runHeadText]}>Left</Text>
                <Text style={[styles.runDur, styles.runHeadText]}>Took</Text>
              </View>
              {runs.map((r) => (
                <View key={r.id} style={styles.runRow}>
                  <Text style={styles.runWhen}>{relTime(r.created_at)}</Text>
                  <View style={styles.runStatusCol}>
                    {(() => {
                      const c =
                        r.status === 'running'
                          ? COLORS.orange
                          : r.status === 'error'
                            ? COLORS.red
                            : COLORS.green;
                      return (
                        <View style={[styles.stChip, { backgroundColor: c + '22' }]}>
                          {r.status === 'running' && (
                            <ActivityIndicator size="small" color={c} style={{ transform: [{ scale: 0.7 }] }} />
                          )}
                          <Text style={[styles.stChipText, { color: c }]}>{r.status}</Text>
                        </View>
                      );
                    })()}
                  </View>
                  <View style={styles.runBy}>
                    <View
                      style={[
                        styles.byChip,
                        { backgroundColor: r.triggered_by === 'admin' ? COLORS.orange + '22' : '#efe6d6' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.byChipText,
                          { color: r.triggered_by === 'admin' ? COLORS.orange : COLORS.navy },
                        ]}
                      >
                        {r.triggered_by}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.runStat, { color: COLORS.green }]}>{r.done}</Text>
                  <Text style={[styles.runStat, { color: r.failed ? COLORS.red : COLORS.grey }]}>
                    {r.failed}
                  </Text>
                  <Text style={[styles.runStat, { color: r.retry ? COLORS.yellow : COLORS.grey }]}>
                    {r.retry}
                  </Text>
                  <Text style={[styles.runStat, { color: COLORS.navy }]}>
                    {r.remaining != null ? r.remaining.toLocaleString() : '—'}
                  </Text>
                  <Text style={styles.runDur}>
                    {r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
        )}

        {/* ── Trends & distribution ── */}
        {tab === 'overview' && h && (
          <View style={[styles.cols, narrow && styles.colsNarrow]}>
            <View style={[styles.card, !narrow && styles.colRight]}>
              <Text style={styles.cardTitle}>Completeness over time</Text>
              <Text style={styles.cardHint}>Daily snapshots · now {overall}%</Text>
              {snaps.length >= 2 ? (
                <CompletenessChart snaps={snaps} />
              ) : (
                <View style={styles.chartEmpty}>
                  <Text style={styles.bigStat}>{overall}%</Text>
                  <Text style={styles.runsEmpty}>
                    History begins today — the trend line fills in daily.
                  </Text>
                </View>
              )}
            </View>

            {dist && (
              <View style={[styles.card, !narrow && styles.colDonut]}>
                <Text style={styles.cardTitle}>Alignment</Text>
                <Text style={styles.cardHint}>Hero vs villain split</Text>
                <View style={styles.donutWrap}>
                  <Donut
                    total={alignTotal}
                    segments={[
                      { value: align!.good, color: COLORS.green, label: 'Heroes' },
                      { value: align!.bad, color: COLORS.red, label: 'Villains' },
                      { value: align!.neutral, color: COLORS.yellow, label: 'Neutral' },
                      { value: align!.unknown, color: COLORS.grey, label: 'Unknown' },
                    ]}
                  />
                  <View style={styles.legend}>
                    {[
                      { c: COLORS.green, l: 'Heroes', v: align!.good },
                      { c: COLORS.red, l: 'Villains', v: align!.bad },
                      { c: COLORS.yellow, l: 'Neutral', v: align!.neutral },
                      { c: COLORS.grey, l: 'Unknown', v: align!.unknown },
                    ].map((s) => (
                      <View key={s.l} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: s.c }]} />
                        <Text style={styles.legendLabel}>{s.l}</Text>
                        <Text style={styles.legendVal}>{s.v.toLocaleString()}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {tab === 'overview' && h && dist && (
          <View style={[styles.cols, narrow && styles.colsNarrow]}>
            <View style={[styles.card, { flex: 1 }]}>
              <Text style={styles.cardTitle}>Power distribution</Text>
              <Text style={styles.cardHint}>Total powerstats (0–600)</Text>
              <View style={styles.histRow}>
                {dist.power_hist.map((b) => (
                  <View key={b.label} style={styles.histCol}>
                    <Text style={styles.histN}>{b.n}</Text>
                    <View style={styles.histTrack}>
                      <View
                        style={[styles.histBar, { height: `${Math.round((b.n / histMax) * 100)}%` }]}
                      />
                    </View>
                    <Text style={styles.histLabel}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.card, { flex: 1 }]}>
              <Text style={styles.cardTitle}>Largest publishers</Text>
              <Text style={styles.cardHint}>By hero count</Text>
              {h.byPublisher.slice(0, 8).map((p) => (
                <View key={p.publisher} style={styles.pbRow}>
                  <Text style={styles.pbName} numberOfLines={1}>
                    {p.publisher}
                  </Text>
                  <View style={styles.pbTrack}>
                    <View style={[styles.pbFill, { width: `${Math.round((p.total / pubMax) * 100)}%` }]} />
                  </View>
                  <Text style={styles.pbNum}>{p.total.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Publisher heatmap (two columns on wide screens) ── */}
        {tab === 'overview' && h && h.byPublisher.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Coverage by publisher</Text>
            <Text style={styles.cardHint}>Top {h.byPublisher.length} by catalogue size</Text>
            {narrow ? (
              <PublisherTable rows={h.byPublisher} />
            ) : (
              <View style={styles.pubSplit}>
                <PublisherTable rows={h.byPublisher.slice(0, Math.ceil(h.byPublisher.length / 2))} />
                <View style={styles.pubSplitDivider} />
                <PublisherTable rows={h.byPublisher.slice(Math.ceil(h.byPublisher.length / 2))} />
              </View>
            )}
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

  // Tab bar
  tabBar: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 2 },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
  },
  navPillOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  navPillText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.navy },
  navPillTextOn: { color: '#fff' },
  navBadge: {
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  navBadgeOn: { backgroundColor: '#fff' },
  navBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },

  // Operations
  opsHead: { flexDirection: 'row', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' },
  activeRun: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.orange + '14',
    borderWidth: 1,
    borderColor: COLORS.orange + '33',
  },
  activeRunText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  activeRunSub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, marginTop: 1 },
  runStatusCol: { width: 96 },
  stChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stChipText: { fontFamily: 'Nunito_700Bold', fontSize: 11, textTransform: 'capitalize' },
  toastWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toast: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange },
  opsBody: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 14 },
  opsActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actPrimary: { backgroundColor: COLORS.orange },
  actPrimaryText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
  actGhost: { backgroundColor: '#efe6d6' },
  actGhostText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  actOn: { backgroundColor: COLORS.green },
  actDim: { opacity: 0.4 },
  opsMetrics: { flexDirection: 'row', alignItems: 'center', gap: 18, flex: 1, flexWrap: 'wrap' },
  opsDivider: { width: 1, height: 38, backgroundColor: '#efe6d6' },
  opsMetric: { gap: 2 },
  opsMetricWide: { gap: 4, flex: 1, minWidth: 180 },
  opsMetricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  opsMetricNum: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.black, lineHeight: 26 },
  opsUsageNum: { fontFamily: 'Flame-Regular', fontSize: 16 },
  opsMetricLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
  opsMetricSub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  cvTrack: { height: 8, borderRadius: 4, backgroundColor: '#efe6d6', overflow: 'hidden' },
  cvFill: { height: 8, borderRadius: 4 },

  // Recent runs
  runHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#efe6d6',
    marginTop: 4,
  },
  runHeadText: { color: COLORS.grey, fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 0.4 },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f0e6',
  },
  runWhen: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  runBy: { width: 84 },
  byChip: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  byChipText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  runStat: { width: 58, textAlign: 'right', fontFamily: 'Nunito_700Bold', fontSize: 13 },
  runDur: { width: 64, textAlign: 'right', fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
  runsEmpty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.grey, marginTop: 12 },

  colDonut: { width: 300, flexGrow: 0, flexShrink: 0 },

  // Charts
  chartEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 6 },
  bigStat: { fontFamily: 'Flame-Regular', fontSize: 52, color: COLORS.green, lineHeight: 54 },
  donutNum: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.black, lineHeight: 28 },
  donutLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
  donutWrap: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 10 },
  legendLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  legendVal: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
  histRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 },
  histCol: { flex: 1, alignItems: 'center', gap: 6 },
  histN: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  histTrack: { width: '100%', height: 120, backgroundColor: '#f6f0e6', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  histBar: { width: '100%', backgroundColor: COLORS.orange, borderRadius: 8 },
  histLabel: { fontFamily: 'Nunito_400Regular', fontSize: 10, color: COLORS.grey },
  pbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  pbName: { width: 130, fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.black },
  pbTrack: { flex: 1, height: 14, backgroundColor: '#f6f0e6', borderRadius: 7, overflow: 'hidden' },
  pbFill: { height: 14, backgroundColor: COLORS.blue, borderRadius: 7 },
  pbNum: { width: 52, textAlign: 'right', fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

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
  pubSplit: { flexDirection: 'row', gap: 28 },
  pubSplitDivider: { width: 1, backgroundColor: '#efe6d6' },
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
