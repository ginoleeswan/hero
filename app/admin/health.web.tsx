import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { getProfile } from '../../src/lib/db/profiles';
import { useWebCanvas } from '../../src/hooks/useWebCanvas';
import { useChromeColor } from '../../src/contexts/WebChromeContext';
import { LogoLoader } from '../../src/components/ui/LogoLoader';
import { COLORS } from '../../src/constants/colors';
import {
  GAP_PAGE_SIZE,
  type CoverageMetric,
  type PublisherCoverage,
  type EnrichmentRun,
  type AdminHeroResult,
  type GeminiSpend,
} from '../../src/lib/db/catalogHealth';
import {
  DRAIN_CRON,
  CV_HOURLY_CAP,
  relTime,
  pct,
  logClock,
  healthColor,
  LOG_TONE_COLOR,
  METRICS,
  WORKLIST_LABEL,
  TABS,
  type MetricDef,
  type TabKey,
} from '../../src/components/admin/health/format';
import { Donut, BarRow, CompletenessChart } from '../../src/components/admin/health/charts';
import { Masthead } from '../../src/components/admin/health/Masthead';
import { RunHistory } from '../../src/components/admin/health/RunHistory';
import { VitalsBar } from '../../src/components/admin/health/VitalsBar';
import { Chip } from '../../src/components/admin/health/atoms';
import {
  useActivityLog,
  useCatalogActions,
  useCatalogQueries,
} from '../../src/components/admin/health/hooks';

// Mobile bottom navigation — fixed to the viewport (sticky releases here because
// #root is clamped to 100dvh; fixed + translateZ pins it like the global TopBar).
function BottomTabBar({
  tab,
  onChange,
  pending,
}: {
  tab: TabKey;
  onChange: (k: TabKey) => void;
  pending?: number;
}) {
  return (
    <View style={styles.btab}>
      {TABS.map((t) => {
        const on = tab === t.key;
        const badge = t.key === 'backfill' ? pending : undefined;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.btabItem}>
            <View style={[styles.btabIconWrap, on && styles.btabIconWrapOn]}>
              <Ionicons name={t.icon} size={22} color={on ? COLORS.orange : COLORS.navy} />
              {badge != null && badge > 0 && (
                <View style={styles.btabBadge}>
                  <Text style={styles.btabBadgeText}>
                    {badge > 999 ? `${Math.round(badge / 1000)}k` : badge}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.btabLabel, on && styles.btabLabelOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Pulsing placeholder cards shown while the first health payload loads, so the
// page has shape immediately instead of a blank flash.
function SkeletonCards({ narrow }: { narrow: boolean }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const bar = (w: number | string, h = 14) => (
    <Animated.View style={[styles.skBar, { width: w as number, height: h, opacity: pulse }]} />
  );
  return (
    <>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.card, narrow && styles.cardNarrow]}>
          {bar('45%', 18)}
          {bar('70%', 12)}
          <View style={{ height: 12 }} />
          {bar('100%', 44)}
        </View>
      ))}
    </>
  );
}

// Alert pill — one tone-coloured row. Renders as a Pressable (with optional
// trailing content) when onPress is supplied; otherwise a static row. Shared by
// the expanded list and the collapsed mobile banner so they never drift.
function AlertPill({
  tone,
  text,
  onPress,
  trailing,
  numberOfLines,
}: {
  tone: 'red' | 'gold';
  text: string;
  onPress?: () => void;
  trailing?: ReactNode;
  numberOfLines?: number;
}) {
  const base = tone === 'red' ? COLORS.red : COLORS.yellow;
  const style = [styles.alert, { backgroundColor: base + '18', borderColor: base + '44' }];
  const inner = (
    <>
      <Ionicons
        name={tone === 'red' ? 'alert-circle' : 'warning'}
        size={16}
        color={tone === 'red' ? COLORS.red : COLORS.gold}
      />
      <Text style={styles.alertText} numberOfLines={numberOfLines}>
        {text}
      </Text>
      {trailing}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={style}>
      {inner}
    </Pressable>
  ) : (
    <View style={style}>{inner}</View>
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
  compact,
}: {
  def: MetricDef;
  have: number;
  total: number;
  anim: Animated.Value;
  active: boolean;
  onPress?: () => void;
  compact?: boolean;
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
        [
          styles.covRow,
          compact && styles.covRowNarrow,
          active && styles.covRowActive,
          hovered && tappable && styles.covRowHover,
        ] as object
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
// Rows are tappable → drill into that publisher's backfill queue.
function PublisherTable({
  rows,
  onPick,
}: {
  rows: PublisherCoverage[];
  onPick: (publisher: string) => void;
}) {
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
        <Pressable
          key={p.publisher}
          onPress={() => onPick(p.publisher)}
          style={({ hovered }: { hovered?: boolean }) =>
            [styles.pubRow, hovered && styles.pubRowHover] as object
          }
        >
          <Text style={styles.pubCellName} numberOfLines={1}>
            {p.publisher}
          </Text>
          <Text style={styles.pubCellNum}>{p.total.toLocaleString()}</Text>
          {cell(pct(p.portrait, p.total))}
          {cell(pct(p.summary, p.total))}
          {cell(pct(p.stats, p.total))}
        </Pressable>
      ))}
    </View>
  );
}

// Labelled heat pill — the mobile stand-in for a heatmap cell.
function HeatPill({ label, val }: { label: string; val: number }) {
  const c = healthColor(val);
  return (
    <View style={styles.heatPill}>
      <Text style={styles.heatPillLabel}>{label}</Text>
      <View style={[styles.heatPillVal, { backgroundColor: c + '22' }]}>
        <Text style={[styles.heatPillNum, { color: c }]}>{val}%</Text>
      </View>
    </View>
  );
}

// Mobile publisher coverage as a stacked card (replaces the wide heatmap table
// on narrow screens, where the fixed columns would overflow horizontally).
function PublisherCard({ row, onPick }: { row: PublisherCoverage; onPick: (publisher: string) => void }) {
  return (
    <Pressable onPress={() => onPick(row.publisher)} style={styles.pubCard}>
      <View style={styles.pubCardHead}>
        <Text style={styles.pubCardName} numberOfLines={1}>
          {row.publisher}
        </Text>
        <Text style={styles.pubCardCount}>{row.total.toLocaleString()} heroes</Text>
        <Ionicons name="chevron-forward" size={15} color="rgba(41,60,67,0.3)" />
      </View>
      <View style={styles.pubCardHeats}>
        <HeatPill label="Portrait" val={pct(row.portrait, row.total)} />
        <HeatPill label="Summary" val={pct(row.summary, row.total)} />
        <HeatPill label="Stats" val={pct(row.stats, row.total)} />
      </View>
    </Pressable>
  );
}

const money = (n: number, cur?: string) =>
  cur && cur !== 'USD' ? `${n.toFixed(2)} ${cur}` : `$${n.toFixed(2)}`;

// Gemini / GCP spend from the BigQuery billing export (AI Studio "Spend" parity).
function SpendCard({ spend, loading, narrow }: { spend?: GeminiSpend; loading: boolean; narrow: boolean }) {
  const title = (
    <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Gemini / GCP Spend</Text>
  );
  if (loading || !spend) {
    return (
      <View style={[styles.card, narrow && styles.cardNarrow]}>
        {title}
        <ActivityIndicator color={COLORS.orange} style={{ marginTop: 16 }} />
      </View>
    );
  }
  if (!spend.available) {
    return (
      <View style={[styles.card, narrow && styles.cardNarrow]}>
        {title}
        <View style={spend_s.empty}>
          <Ionicons name="cloud-offline-outline" size={26} color={COLORS.grey} />
          <Text style={spend_s.emptyText}>{spend.reason ?? 'Spend data not available yet.'}</Text>
          <Text style={spend_s.emptySub}>
            Enable the BigQuery billing export on the billing account; data appears ~24h later.
          </Text>
        </View>
      </View>
    );
  }
  const cur = spend.currency;
  const days = spend.days ?? [];
  const max = Math.max(1, ...days.map((d) => d.cost));
  const services = spend.byService ?? [];
  return (
    <View style={[styles.card, narrow && styles.cardNarrow]}>
      {title}
      <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>
        BigQuery billing export · last 28 days
      </Text>
      <View style={spend_s.top}>
        <View>
          <Text style={spend_s.big}>{money(spend.monthToDate ?? 0, cur)}</Text>
          <Text style={spend_s.bigLabel}>this month</Text>
        </View>
        <View>
          <Text style={spend_s.med}>{money(spend.total28 ?? 0, cur)}</Text>
          <Text style={spend_s.bigLabel}>last 28 days</Text>
        </View>
      </View>
      {days.length > 0 && (
        <View style={spend_s.bars}>
          {days.map((d) => (
            <View key={d.day} style={spend_s.barCol}>
              <View style={spend_s.barTrack}>
                <View style={[spend_s.bar, { height: `${Math.round((d.cost / max) * 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}
      {services.length > 0 && (
        <View style={spend_s.svcWrap}>
          {services.slice(0, 6).map((s) => (
            <View key={s.service} style={spend_s.svcRow}>
              <Text style={spend_s.svcName} numberOfLines={1}>
                {s.service}
              </Text>
              <Text style={spend_s.svcVal}>{money(s.cost, cur)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AdminHealthScreen() {
  useWebCanvas(COLORS.beige);
  // Masthead is dark-topped and bleeds up behind the floating nav, so lock the
  // chrome (status-bar tint + bar) to its top colour for a seamless top edge.
  useChromeColor('#10242e');
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const narrow = winW < 760;
  const { user, loading: authLoading } = useAuth();

  const [metric, setMetric] = useState<CoverageMetric>('portrait');
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<TabKey>('overview');
  const [heroQuery, setHeroQuery] = useState('');
  const [batchSize, setBatchSize] = useState(25);
  const [pubFilter, setPubFilter] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(30);

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

  const { healthQ, gapsQ, runsQ, cronQ, heroSearchQ, pingQ, usageQ, distQ, snapsQ, spendQ } = useCatalogQueries({
    enabled: gateResolved && isAdmin,
    metric,
    page,
    pubFilter,
    heroQuery,
    historyLimit,
  });

  const drainJob = cronQ.data?.find((j) => j.jobname === DRAIN_CRON);
  const cronOn = !!drainJob?.active;
  const { log, toast, flash, logEvent, clearLog } = useActivityLog();
  const { busy, refreshing, onRunDrain, onRetryFailed, onStop, onSnapshot, onReenrich, onToggleCron, onRefresh } =
    useCatalogActions({ batchSize, cronOn, flash });

  const pickPublisher = (publisher: string) => {
    setPubFilter(publisher);
    setPage(0);
    setTab('backfill');
  };
  // Deep-link from the masthead into a backfill worklist.
  const goToBackfill = (m: CoverageMetric = 'portrait') => {
    setMetric(m);
    setPage(0);
    setPubFilter(null);
    setTab('backfill');
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

  // Stream run state changes into the activity log. The first batch only primes
  // the seen-map (so existing history doesn't flood the log on mount); after that
  // every transition — started, done, error, stopped — is logged with detail.
  const seenRuns = useRef<Map<number, string>>(new Map());
  const runLogPrimed = useRef(false);
  useEffect(() => {
    const data = runsQ.data?.runs;
    if (!data) return;
    if (!runLogPrimed.current) {
      for (const r of data) seenRuns.current.set(r.id, r.status);
      runLogPrimed.current = true;
      return;
    }
    for (const r of data) {
      const prev = seenRuns.current.get(r.id);
      if (prev === r.status) continue;
      seenRuns.current.set(r.id, r.status);
      const took = r.duration_ms != null ? ` in ${(r.duration_ms / 1000).toFixed(1)}s` : '';
      if (r.status === 'running' && prev == null) {
        logEvent('pending', `Run #${r.id} started · ${r.triggered_by}`);
      } else if (r.status === 'done') {
        logEvent(
          'success',
          `Run #${r.id} finished · ${r.done} enriched${r.failed ? `, ${r.failed} failed` : ''}${
            r.retry ? `, ${r.retry} retry` : ''
          }${took}`,
        );
      } else if (r.status === 'error') {
        logEvent('error', `Run #${r.id} errored${r.done ? ` after ${r.done} enriched` : ''}${took}`);
      } else if (r.status === 'stopped') {
        logEvent('info', `Run #${r.id} stopped · ${r.done} enriched${took}`);
      }
    }
  }, [runsQ.data, logEvent]);

  // Alerts surface problems without hunting. Memoised so the auto-collapse
  // effect can re-fold the mobile banner once they drop back to ≤1.
  const alerts = useMemo<{ tone: 'red' | 'gold'; text: string }[]>(() => {
    const usage = usageQ.data ?? 0;
    const recent = runsQ.data?.runs ?? [];
    const a: { tone: 'red' | 'gold'; text: string }[] = [];
    if (pingQ.data === 'limited')
      a.push({ tone: 'gold', text: 'ComicVine is rate-limited right now — drains will mostly retry.' });
    else if (usage >= CV_HOURLY_CAP * 0.8)
      a.push({ tone: 'gold', text: `ComicVine usage high — ${usage}/${CV_HOURLY_CAP} calls this hour.` });
    if ((h?.cvStatus.failed ?? 0) > 0)
      a.push({ tone: 'red', text: `${h!.cvStatus.failed} hero(es) marked failed — Retry failed in Operations.` });
    if (recent[0]?.status === 'error')
      a.push({ tone: 'red', text: 'The last run errored — see Recent runs.' });
    return a;
  }, [pingQ.data, usageQ.data, runsQ.data, h]);

  // Once alerts fall back to one (or none), reset the mobile banner so the next
  // time multiple appear it starts collapsed again instead of staying expanded.
  useEffect(() => {
    if (alerts.length <= 1) setAlertsOpen(false);
  }, [alerts.length]);

  if (!gateResolved || !isAdmin) return <LogoLoader />;

  const gaps = gapsQ.data;
  const cvUsage = usageQ.data ?? 0;
  const cvPctUsed = Math.min(100, Math.round((cvUsage / CV_HOURLY_CAP) * 100));
  const cvColor =
    cvUsage >= CV_HOURLY_CAP * 0.8 ? COLORS.red : cvUsage >= CV_HOURLY_CAP * 0.5 ? COLORS.yellow : COLORS.green;
  const runs: EnrichmentRun[] = runsQ.data?.runs ?? [];
  const runsTotal = runsQ.data?.total ?? runs.length;
  const activeRun = runs.find((r) => r.status === 'running');
  // Backlog ETA at the observed drain rate (heroes enriched per minute of run time).
  const drainedRuns = runs.filter((r) => r.duration_ms && r.done > 0);
  const drainMs = drainedRuns.reduce((a, r) => a + (r.duration_ms ?? 0), 0);
  const drainDone = drainedRuns.reduce((a, r) => a + r.done, 0);
  const perMin = drainMs > 0 ? drainDone / (drainMs / 60000) : 0;
  const pendingNow = h?.cvStatus.pending ?? 0;
  const etaMin = perMin > 0 ? pendingNow / perMin : 0;
  const etaLabel =
    perMin > 0 && pendingNow > 0
      ? etaMin >= 60
        ? `~${(etaMin / 60).toFixed(1)}h to clear`
        : `~${Math.ceil(etaMin)}m to clear`
      : null;

  // ── Alerts: surface problems without hunting (built in a memo above) ─────────
  const cvPing = pingQ.data;
  // Mobile collapses multiple alerts into one banner (worst-first) to save space.
  const leadAlert = alerts.find((a) => a.tone === 'red') ?? alerts[0];
  const alertsCollapsed = narrow && !alertsOpen && alerts.length > 1;

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
      <Animated.View style={[styles.root, enterStyle]}>
        {/* ── Masthead — full-bleed dark band that fuses with the floating nav ── */}
        <Masthead
          h={h}
          overall={overall}
          narrow={narrow}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onJump={goToBackfill}
        />

        <View style={[styles.body, narrow && styles.bodyNarrow]}>
        {/* ── Always-on vitals (live ops signals, visible on every tab) ── */}
        {h && (
          <VitalsBar
            narrow={narrow}
            pending={h.cvStatus.pending ?? 0}
            etaLabel={etaLabel}
            cvPing={cvPing}
            cvUsage={cvUsage}
            cvColor={cvColor}
            cvPctUsed={cvPctUsed}
            activeRun={activeRun}
            stopping={busy === 'stop'}
            onStop={onStop}
            cronOn={cronOn}
            drainJob={drainJob}
            spend={spendQ.data}
          />
        )}
        {/* ── Tab bar (desktop pill row; mobile uses the fixed bottom bar) ── */}
        {!narrow && (
        <View style={styles.tabBar}>
          {TABS.map((t) => {
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
        )}

        {/* ── Alerts (mobile collapses to a single worst-first banner) ── */}
        {alertsCollapsed ? (
          <AlertPill
            tone={leadAlert.tone}
            text={leadAlert.text}
            numberOfLines={1}
            onPress={() => setAlertsOpen(true)}
            trailing={
              <>
                <View style={styles.alertCount}>
                  <Text style={styles.alertCountText}>+{alerts.length - 1}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
              </>
            }
          />
        ) : (
          alerts.length > 0 && (
            <View style={styles.alertWrap}>
              {alerts.map((a, i) => (
                <AlertPill key={i} tone={a.tone} text={a.text} />
              ))}
              {narrow && alerts.length > 1 && (
                <Pressable onPress={() => setAlertsOpen(false)} style={styles.alertCollapse}>
                  <Ionicons name="chevron-up" size={14} color={COLORS.grey} />
                  <Text style={styles.alertCollapseText}>Show less</Text>
                </Pressable>
              )}
            </View>
          )
        )}

        {/* ── Loading skeleton (first health payload) ── */}
        {!h && <SkeletonCards narrow={narrow} />}

        {/* ── Operations ── */}
        {tab === 'operations' && h && (
          <View style={[styles.card, narrow && styles.cardNarrow]}>
            <View style={styles.opsHead}>
              <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Operations</Text>
              {toast && (
                <View style={styles.toastWrap}>
                  <Ionicons name="information-circle" size={15} color={COLORS.orange} />
                  <Text style={styles.toast}>{toast}</Text>
                </View>
              )}
            </View>
            <View style={[styles.opsBody, narrow && styles.opsBodyNarrow]}>
              <View style={styles.opsActions}>
                <View style={styles.sizeSel}>
                  {[10, 25, 50].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setBatchSize(n)}
                      style={[styles.sizePill, batchSize === n && styles.sizePillOn]}
                    >
                      <Text style={[styles.sizePillText, batchSize === n && styles.sizePillTextOn]}>
                        {n}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={onRunDrain}
                  disabled={!!busy}
                  style={[styles.actBtn, styles.actPrimary, narrow && styles.actGrow, !!busy && styles.actDim]}
                >
                  {busy === 'drain' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="play" size={15} color="#fff" />
                  )}
                  <Text style={styles.actPrimaryText}>Run batch · {batchSize}</Text>
                </Pressable>
                <Pressable
                  onPress={onRetryFailed}
                  disabled={!!busy || (h.cvStatus.failed ?? 0) === 0}
                  style={[
                    styles.actBtn,
                    styles.actGhost,
                    narrow && styles.actGrow,
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
                  style={[
                    styles.actBtn,
                    cronOn ? styles.actOn : styles.actGhost,
                    narrow && styles.actGrow,
                    !!busy && styles.actDim,
                  ]}
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

            </View>
          </View>
        )}

        {/* ── Run history (monitoring dashboard) ── */}
        {tab === 'operations' && (
          <View style={[styles.card, narrow && styles.cardNarrow]}>
            <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Run history</Text>
            <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>
              {runsTotal.toLocaleString()} runs logged · cron + manual · auto-refreshes
            </Text>
            <RunHistory
              runs={runs}
              total={runsTotal}
              narrow={narrow}
              loading={runsQ.isLoading}
              fetching={runsQ.isFetching}
              onLoadMore={() => setHistoryLimit((l) => l + 30)}
            />
          </View>
        )}

        {/* ── Gemini / GCP spend ── */}
        {tab === 'operations' && (
          <SpendCard spend={spendQ.data} loading={spendQ.isLoading} narrow={narrow} />
        )}

        {/* ── Activity log + Hero console (paired side-by-side) ── */}
        {tab === 'operations' && (
          <View style={[styles.cols, narrow && styles.colsNarrow]}>
          <View style={[styles.opsHalf, styles.card, narrow && styles.cardNarrow]}>
            <View style={styles.logHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Activity log</Text>
                <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>Live results of actions & runs this session</Text>
              </View>
              {log.length > 0 && (
                <Pressable onPress={clearLog} style={styles.miniBtn}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.navy} />
                  <Text style={styles.miniBtnText}>Clear</Text>
                </Pressable>
              )}
            </View>
            {log.length === 0 ? (
              <Text style={styles.runsEmpty}>
                Nothing yet — run a batch or action and results stream in here.
              </Text>
            ) : (
              <ScrollView
                style={styles.logPanel}
                contentContainerStyle={styles.logPanelInner}
                nestedScrollEnabled
              >
                {log.map((e) => (
                  <View key={e.id} style={styles.logRow}>
                    <Text style={styles.logTime}>{logClock(e.at)}</Text>
                    <View style={[styles.logDot, { backgroundColor: LOG_TONE_COLOR[e.tone] }]} />
                    <Text style={styles.logText}>{e.text}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
          <View style={[styles.opsHalf, styles.card, narrow && styles.cardNarrow]}>
            <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Hero console</Text>
            <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>Find any hero and re-fetch its ComicVine data on demand</Text>
            <View style={styles.heroSearchBox}>
              <Ionicons name="search" size={16} color={COLORS.grey} />
              <TextInput
                value={heroQuery}
                onChangeText={setHeroQuery}
                placeholder="Search heroes by name…"
                placeholderTextColor={COLORS.grey}
                style={[styles.heroSearchInput, { outlineStyle: 'none' }] as object}
              />
              {heroQuery.length > 0 && (
                <Pressable onPress={() => setHeroQuery('')}>
                  <Ionicons name="close-circle" size={16} color={COLORS.grey} />
                </Pressable>
              )}
            </View>
            {heroQuery.trim().length >= 2 && (
              <View style={{ marginTop: 6 }}>
                {heroSearchQ.isLoading ? (
                  <ActivityIndicator color={COLORS.orange} style={{ marginTop: 14 }} />
                ) : (heroSearchQ.data ?? []).length === 0 ? (
                  <Text style={styles.runsEmpty}>No heroes match “{heroQuery}”.</Text>
                ) : (
                  (heroSearchQ.data as AdminHeroResult[]).map((hero) => {
                    const st = hero.comicvine_status ?? 'none';
                    const stc =
                      st === 'done' ? COLORS.green : st === 'failed' ? COLORS.red : st === 'pending' ? COLORS.yellow : COLORS.grey;
                    const busyThis = busy === `reenrich-${hero.id}`;
                    return (
                      <View key={hero.id} style={styles.hcRow}>
                        {hero.portrait_url || hero.image_url ? (
                          <Image
                            source={{ uri: hero.portrait_url ?? hero.image_url ?? undefined }}
                            style={styles.hcThumb}
                            contentFit="cover"
                            transition={150}
                          />
                        ) : (
                          <View style={[styles.hcThumb, styles.thumbBlank]}>
                            <Ionicons name="person" size={15} color="rgba(41,60,67,0.3)" />
                          </View>
                        )}
                        <Pressable style={styles.hcInfo} onPress={() => router.push(`/character/${hero.id}`)}>
                          <Text style={styles.hcName} numberOfLines={1}>
                            {hero.name}
                          </Text>
                          <View style={styles.hcMetaRow}>
                            <Text style={styles.hcPub} numberOfLines={1}>
                              {hero.publisher ?? '—'}
                            </Text>
                            <Chip bg={stc + '22'} fg={stc} text={st} capitalize />

                            {!hero.portrait_url && (
                              <Text style={styles.hcFlag}>no portrait</Text>
                            )}
                          </View>
                        </Pressable>
                        <Pressable
                          onPress={() => onReenrich(hero.id, hero.name)}
                          disabled={!!busy}
                          style={[styles.hcBtn, !!busy && styles.actDim]}
                        >
                          {busyThis ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="refresh" size={14} color="#fff" />
                          )}
                          <Text style={styles.hcBtnText}>Re-fetch</Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
          </View>
        )}

        {tab === 'backfill' && (
          <View style={[styles.cols, narrow && styles.colsNarrow]}>
          {/* ── Coverage ── */}
          <View style={[styles.card, narrow && styles.cardNarrow, styles.coverageCard, !narrow && styles.colLeft]}>
            <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Coverage</Text>
            <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>Sorted by weakest first · tap one to load its queue</Text>
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
                    compact={narrow}
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
          <View style={[styles.card, narrow && styles.cardNarrow, !narrow && styles.colRight]}>
            <View style={styles.queueHead}>
              <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Backfill queue</Text>
              <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>Most-viewed first</Text>
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

            {pubFilter && (
              <Pressable
                onPress={() => {
                  setPubFilter(null);
                  setPage(0);
                }}
                style={styles.filterChip}
              >
                <Ionicons name="funnel" size={12} color={COLORS.orange} />
                <Text style={styles.filterChipText}>{pubFilter}</Text>
                <Ionicons name="close" size={13} color={COLORS.navy} />
              </Pressable>
            )}

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

        {/* ── Trends & distribution ── */}
        {tab === 'overview' && h && (
          <View style={[styles.cols, narrow && styles.colsNarrow]}>
            <View style={[styles.card, narrow && styles.cardNarrow, !narrow && styles.colRight]}>
              <View style={styles.cardTitleRow}>
                <View>
                  <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Completeness over time</Text>
                  <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>Daily snapshots · now {overall}%</Text>
                </View>
                <Pressable
                  onPress={onSnapshot}
                  disabled={busy === 'snapshot'}
                  style={[styles.miniBtn, busy === 'snapshot' && styles.actDim]}
                >
                  {busy === 'snapshot' ? (
                    <ActivityIndicator size="small" color={COLORS.navy} />
                  ) : (
                    <Ionicons name="camera-outline" size={14} color={COLORS.navy} />
                  )}
                  <Text style={styles.miniBtnText}>Snapshot now</Text>
                </Pressable>
              </View>
              {snaps.length >= 2 ? (
                <CompletenessChart snaps={snaps} />
              ) : narrow ? (
                // Mobile: the masthead gauge already shows the % — keep this slim.
                <View style={styles.trendEmpty}>
                  <Ionicons name="trending-up-outline" size={18} color={COLORS.grey} />
                  <Text style={styles.trendEmptyText}>
                    Daily history starts today — the trend line fills in over time.
                  </Text>
                </View>
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
              <View style={[styles.card, narrow && styles.cardNarrow, !narrow && styles.colDonut]}>
                <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Alignment</Text>
                <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>Hero vs villain split</Text>
                {narrow ? (
                  <View style={styles.barList}>
                    {[
                      { l: 'Heroes', v: align!.good, c: COLORS.green },
                      { l: 'Villains', v: align!.bad, c: COLORS.red },
                      { l: 'Neutral', v: align!.neutral, c: COLORS.yellow },
                      { l: 'Unknown', v: align!.unknown, c: COLORS.grey },
                    ].map((s) => (
                      <BarRow key={s.l} label={s.l} value={s.v} max={alignTotal} color={s.c} />
                    ))}
                  </View>
                ) : (
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
                )}
              </View>
            )}
          </View>
        )}

        {tab === 'overview' && h && dist && (
          <View style={[styles.cols, narrow && styles.colsNarrow]}>
            <View style={[styles.card, narrow && styles.cardNarrow, { flex: 1 }]}>
              <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Power distribution</Text>
              <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>Total powerstats (0–600)</Text>
              {narrow ? (
                <View style={styles.barList}>
                  {dist.power_hist.map((b) => (
                    <BarRow key={b.label} label={b.label} value={b.n} max={histMax} color={COLORS.orange} />
                  ))}
                </View>
              ) : (
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
              )}
            </View>

            {/* Largest publishers is redundant with Coverage-by-publisher on mobile. */}
            {!narrow && (
              <View style={[styles.card, { flex: 1 }]}>
                <Text style={styles.cardTitle}>Largest publishers</Text>
                <Text style={styles.cardHint}>By hero count</Text>
                <View style={styles.barList}>
                  {h.byPublisher.slice(0, 8).map((p) => (
                    <BarRow key={p.publisher} label={p.publisher} value={p.total} max={pubMax} color={COLORS.blue} />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Publisher heatmap (two columns on wide screens) ── */}
        {tab === 'overview' && h && h.byPublisher.length > 0 && (
          <View style={[styles.card, narrow && styles.cardNarrow]}>
            <Text style={[styles.cardTitle, narrow && styles.cardTitleNarrow]}>Coverage by publisher</Text>
            <Text style={[styles.cardHint, narrow && styles.cardHintNarrow]}>Top {h.byPublisher.length} by catalogue size</Text>
            {narrow ? (
              <View style={styles.pubCards}>
                {h.byPublisher.map((p) => (
                  <PublisherCard key={p.publisher} row={p} onPick={pickPublisher} />
                ))}
              </View>
            ) : (
              <View style={styles.pubSplit}>
                <PublisherTable
                  rows={h.byPublisher.slice(0, Math.ceil(h.byPublisher.length / 2))}
                  onPick={pickPublisher}
                />
                <View style={styles.pubSplitDivider} />
                <PublisherTable
                  rows={h.byPublisher.slice(Math.ceil(h.byPublisher.length / 2))}
                  onPick={pickPublisher}
                />
              </View>
            )}
          </View>
        )}

        <View style={[styles.bottomSpacer, narrow && styles.bottomSpacerNarrow]} />
        </View>
      </Animated.View>
      {narrow && <BottomTabBar tab={tab} onChange={setTab} pending={h?.cvStatus.pending} />}
    </View>
  );
}

const card = {
  backgroundColor: '#fffdf8',
  borderRadius: 16,
  padding: 18,
  borderWidth: 1,
  borderColor: 'rgba(41,60,67,0.06)',
  shadowColor: '#3a2a14',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
} as const;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.beige, minHeight: '100%' as unknown as number },
  root: { width: '100%' },
  body: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 24, gap: 14 },
  // Mobile: list-style — content sits on the beige canvas, inset from the screen
  // edges; sections are separated by hairline dividers (see cardNarrow), no gaps.
  bodyNarrow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 0 },
  bottomSpacer: { height: 40 },
  // Clear the fixed bottom tab bar + the home-indicator inset on mobile.
  bottomSpacerNarrow: {
    height: (`calc(env(safe-area-inset-bottom) + 84px)` as unknown) as number,
  },

  // ── Mobile bottom navigation (fixed to viewport) ──────────────────────────────
  btab: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    flexDirection: 'row',
    backgroundColor: '#fffdf8',
    borderTopWidth: 1,
    borderTopColor: 'rgba(41,60,67,0.1)',
    paddingTop: 9,
    paddingBottom: `calc(env(safe-area-inset-bottom) + 9px)`,
    shadowColor: '#3a2a14',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    transform: 'translateZ(0)',
  } as object,
  btabItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  btabIconWrap: { paddingHorizontal: 16, paddingVertical: 3, borderRadius: 999 },
  btabIconWrapOn: { backgroundColor: COLORS.orange + '1a' },
  btabLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.navy },
  btabLabelOn: { color: COLORS.orange },
  btabBadge: {
    position: 'absolute',
    top: -5,
    right: -11,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    minWidth: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  btabBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff', lineHeight: 14 },

  // Columns
  cols: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  colsNarrow: { flexDirection: 'column', gap: 0 },
  colLeft: { width: 360, flexGrow: 0, flexShrink: 0 },
  colRight: { flex: 1 },

  card,
  // Mobile: no card chrome — transparent section on the canvas, set off only by a
  // bottom hairline divider (list-style). Horizontal inset comes from the body.
  cardNarrow: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    paddingVertical: 22,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.1)',
    shadowOpacity: 0,
    elevation: 0,
  },
  skBar: { backgroundColor: '#ece3d4', borderRadius: 8, marginBottom: 10 },

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
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.red,
  },
  stopBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },

  // Hero console
  heroSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f6f0e6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 10,
  },
  heroSearchInput: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.black,
  },
  hcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f0e6',
  },
  hcThumb: { width: 34, height: 44, borderRadius: 7, backgroundColor: '#efe6d6' },
  hcInfo: { flex: 1, gap: 4, minWidth: 0 },
  hcName: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  hcMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  hcPub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, maxWidth: 150 },
  hcFlag: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.red },
  hcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
  },
  hcBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },

  // Alerts
  alertWrap: { gap: 8 },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  alertText: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  alertCount: {
    backgroundColor: 'rgba(41,60,67,0.12)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  alertCountText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.navy },
  alertCollapse: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', paddingTop: 2 },
  alertCollapseText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },

  // ComicVine ping
  pingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pingDot: { width: 8, height: 8, borderRadius: 8 },

  // Batch-size selector
  sizeSel: { flexDirection: 'row', backgroundColor: '#efe6d6', borderRadius: 10, padding: 3 },
  sizePill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8 },
  sizePillOn: { backgroundColor: '#fff' },
  sizePillText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.grey },
  sizePillTextOn: { color: COLORS.navy },

  // Snapshot-now / mini button
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#efe6d6',
  },
  miniBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },

  // Publisher drill-down
  pubRowHover: { backgroundColor: 'rgba(231,115,51,0.06)' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginBottom: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.orange + '18',
    borderWidth: 1,
    borderColor: COLORS.orange + '33',
  },
  filterChipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  toastWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toast: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange },
  opsBody: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 14 },
  opsBodyNarrow: { flexDirection: 'column', alignItems: 'stretch' },
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
  // On mobile the action buttons stretch to fill the column for big tap targets.
  actGrow: { flexGrow: 1, flexBasis: 140, justifyContent: 'center' },
  opsMetrics: { flexDirection: 'row', alignItems: 'center', gap: 18, flex: 1, flexWrap: 'wrap' },
  opsMetricsNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
    paddingTop: 12,
    flexGrow: 0,
    flexBasis: 'auto',
  },
  opsMetricWideNarrow: { flexGrow: 0, flexBasis: 'auto' },
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

  runsEmpty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.grey, marginTop: 12 },

  // Activity log — console-style timeline of actions + run transitions.
  logHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logPanel: {
    maxHeight: 300,
    marginTop: 6,
    backgroundColor: '#faf6ee',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
  },
  logPanelInner: { paddingVertical: 2 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f1ece2',
  },
  logTime: {
    width: 62,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  logDot: { width: 8, height: 8, borderRadius: 8 },
  logText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.black },

  colDonut: { width: 300, flexGrow: 0, flexShrink: 0 },

  // Charts
  chartEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 6 },
  bigStat: { fontFamily: 'Flame-Regular', fontSize: 52, color: COLORS.green, lineHeight: 54 },
  // Mobile completeness empty state (the masthead gauge already shows the %).
  trendEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  trendEmptyText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
  // Horizontal stat bars (mobile Alignment + Power, desktop Largest publishers):
  // full-width bar under a label/value line.
  barList: { gap: 10, marginTop: 8 },
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

  coverageCard: { gap: 4 },
  cardTitle: { fontFamily: 'Flame-Regular', fontSize: 19, color: COLORS.black },
  // Mobile: lighter section headers create clearer hierarchy under the 28px page title.
  cardTitleNarrow: { fontSize: 18 },
  cardHint: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey, marginBottom: 8 },
  cardHintNarrow: { fontSize: 12, marginBottom: 10 },

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
  covRowNarrow: { paddingVertical: 8, gap: 10 },
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

  // Publisher heatmap — mobile card layout (replaces the wide table on narrow).
  pubCards: { gap: 10, marginTop: 4 },
  pubCard: {
    backgroundColor: '#faf6ee',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
    padding: 13,
    gap: 11,
  },
  pubCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pubCardName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.black },
  pubCardCount: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
  pubCardHeats: { flexDirection: 'row', gap: 8 },
  heatPill: { flex: 1, alignItems: 'center', gap: 4 },
  heatPillLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  heatPillVal: {
    alignSelf: 'stretch',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  heatPillNum: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  // Equal-width column for paired Operations cards (Activity log + Hero console).
  opsHalf: { flex: 1, minWidth: 0 },
});

const spend_s = StyleSheet.create({
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy, textAlign: 'center' },
  emptySub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 360,
  },
  top: { flexDirection: 'row', gap: 36, marginTop: 10, marginBottom: 14 },
  big: { fontFamily: 'Flame-Regular', fontSize: 38, color: COLORS.green, lineHeight: 40 },
  med: { fontFamily: 'Flame-Regular', fontSize: 30, color: COLORS.navy, lineHeight: 34 },
  bigLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey, marginTop: 2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90, marginTop: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: COLORS.green, borderRadius: 3, minHeight: 2 },
  svcWrap: { marginTop: 14, gap: 7 },
  svcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f0e6',
  },
  svcName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  svcVal: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
});
