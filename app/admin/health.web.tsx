import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCommandAlerts } from '../../src/contexts/CommandAlertsContext';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/hooks/useAuth';
import { getProfile } from '../../src/lib/db/profiles';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { LogoLoader } from '../../src/components/ui/LogoLoader';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { type CoverageMetric } from '../../src/lib/db/catalogHealth';
import {
  DRAIN_CRON,
  CV_HOURLY_CAP,
  pct,
  METRICS,
  type DomainKey,
} from '../../src/components/admin/health/format';
import { CommandShell } from '../../src/components/admin/health/CommandShell';
import { VitalsBar } from '../../src/components/admin/health/VitalsBar';
import { type Alert } from '../../src/components/admin/health/AlertStack';
import { CommandHome } from '../../src/components/admin/health/domains/CommandHome';
import { CatalogDomain } from '../../src/components/admin/health/domains/CatalogDomain';
import { Bento } from '../../src/components/admin/health/Bento';
import { SubTabs } from '../../src/components/admin/health/SubTabs';
import { PipelinesDomain } from '../../src/components/admin/health/domains/PipelinesDomain';
import { BuildBoard } from '../../src/components/admin/health/BuildBoard';
import { refreshFameScores } from '../../src/lib/db/build';
import { HeroConsole } from '../../src/components/admin/health/HeroConsole';
import { DuplicatesPanel } from '../../src/components/admin/health/DuplicatesPanel';
import { SpendDomain } from '../../src/components/admin/health/domains/SpendDomain';
import { SourcesDomain } from '../../src/components/admin/health/domains/SourcesDomain';
import { fetchSourceCoverage } from '../../src/lib/db/catalogHealth';
import { CampaignsDomain } from '../../src/components/admin/health/domains/CampaignsDomain';
import { ReviewDomain } from '../../src/components/admin/health/domains/ReviewDomain';
import { CommunityDomain } from '../../src/components/admin/health/domains/CommunityDomain';
import { TrafficDomain } from '../../src/components/admin/health/domains/TrafficDomain';
import {
  useActivityLog,
  useCatalogActions,
  useCatalogQueries,
} from '../../src/components/admin/health/hooks';

export default function AdminHealthScreen() {
  // Full-ink command centre: canvas and chrome both ink, declared together so the
  // top band fuses with the floating nav. (Retires the old #10242e one-off.)
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const narrow = winW < 760;
  const { user, loading: authLoading } = useAuth();

  const [metric, setMetric] = useState<CoverageMetric>('portrait');
  const [catSub, setCatSub] = useState<'coverage' | 'distributions' | 'hygiene' | 'review'>(
    'coverage',
  );
  const [page, setPage] = useState(0);
  const [domain, setDomain] = useState<DomainKey>('command');
  const [heroQuery, setHeroQuery] = useState('');
  const [batchSize, setBatchSize] = useState(25);
  const [pubFilter, setPubFilter] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(30);
  const [ambiguousLimit, setAmbiguousLimit] = useState(25);
  // The live foreground Build board's working set. Lifted here so the top-strip
  // Stop can halt it too — a true universal kill switch across server + client runs.
  const [buildIds, setBuildIds] = useState<string[] | null>(null);

  const profileQ = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });
  const sourceCovQ = useQuery({
    queryKey: ['sourceCoverage'],
    queryFn: fetchSourceCoverage,
    enabled: !!user && domain === 'sources',
  });
  const gateResolved = !authLoading && (!user || profileQ.isSuccess || profileQ.isError);
  const isAdmin = !!profileQ.data?.is_admin;
  useEffect(() => {
    if (gateResolved && !isAdmin) router.replace('/explore');
  }, [gateResolved, isAdmin, router]);

  const {
    healthQ,
    gapsQ,
    runsQ,
    cronQ,
    heroSearchQ,
    pingQ,
    usageQ,
    distQ,
    snapsQ,
    spendQ,
    ambiguousQ,
    enrichProgressQ,
    statsPendingQ,
    portraitsPendingQ,
    recentEnrichedQ,
    communityQ,
    trafficQ,
  } = useCatalogQueries({
    enabled: gateResolved && isAdmin,
    domain,
    metric,
    page,
    pubFilter,
    heroQuery,
    historyLimit,
    ambiguousLimit,
  });

  const drainJob = cronQ.data?.find((j) => j.jobname === DRAIN_CRON);
  const cronOn = !!drainJob?.active;
  const { log, toast, flash, logEvent, clearLog } = useActivityLog();
  const queryClient = useQueryClient();
  const {
    busy,
    refreshing,
    onRunDrain,
    onRetryFailed,
    onStop,
    onSnapshot,
    onReenrich,
    onResolveQid,
    onMarkUnresolved,
    onBulkAccept,
    onRunResolve,
    onRunEnrich,
    onToggleCron,
    onToggleAnyCron,
    onRescheduleCron,
    onRefresh,
  } = useCatalogActions({ batchSize, cronOn, flash });

  const pickPublisher = (publisher: string) => {
    setPubFilter(publisher);
    setPage(0);
    setDomain('catalog');
  };
  // Deep-link from the home glance / coverage into a backfill worklist.
  const goToBackfill = (m: CoverageMetric = 'portrait') => {
    setMetric(m);
    setPage(0);
    setPubFilter(null);
    setDomain('catalog');
  };

  const h = healthQ.data;

  // Catalog completeness = mean of the five tracked metric percentages.
  const overall = useMemo(() => {
    if (!h || h.total === 0) return 0;
    const ps = METRICS.map((m) => pct(h.metrics[m.key], h.total));
    return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length);
  }, [h]);

  // One driver animates the bar fills on first paint. (No page-level fade — the
  // shell appears immediately so it never flashes in from the white document body.)
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!h) return;
    Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }).start();
  }, [h, anim]);

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
        logEvent(
          'error',
          `Run #${r.id} errored${r.done ? ` after ${r.done} enriched` : ''}${took}`,
        );
      } else if (r.status === 'stopped') {
        logEvent('info', `Run #${r.id} stopped · ${r.done} enriched${took}`);
      }
    }
  }, [runsQ.data, logEvent]);

  // Alerts surface problems without hunting. Memoised so the auto-collapse effect
  // can re-fold the mobile banner once they drop back to ≤1.
  const alerts = useMemo<Alert[]>(() => {
    const usage = usageQ.data ?? 0;
    const recent = runsQ.data?.runs ?? [];
    const a: Alert[] = [];
    if (pingQ.data === 'limited')
      a.push({
        tone: 'gold',
        text: 'ComicVine is rate-limited right now — drains will mostly retry.',
      });
    else if (usage >= CV_HOURLY_CAP * 0.8)
      a.push({
        tone: 'gold',
        text: `ComicVine usage high — ${usage}/${CV_HOURLY_CAP} calls this hour.`,
      });
    if ((h?.cvStatus.failed ?? 0) > 0)
      a.push({
        tone: 'red',
        text: `${h!.cvStatus.failed} hero(es) marked failed — use "Retry failed" on the Build tab.`,
      });
    if (recent[0]?.status === 'error')
      a.push({ tone: 'red', text: 'The last run errored — see the Build tab.' });
    return a;
  }, [pingQ.data, usageQ.data, runsQ.data, h]);

  // Publish alerts to the global TopBar's bell (mobile has no command band).
  // Cleared on unmount so the bell never lingers off the command center.
  const { setAlerts } = useCommandAlerts();
  useEffect(() => {
    setAlerts(alerts);
    return () => setAlerts([]);
  }, [alerts, setAlerts]);

  // Mobile pull-to-refresh stands in for the (now desktop-only) refresh button.
  const { distance: ptrDist, refreshing: ptrBusy } = usePullToRefresh(onRefresh, narrow);

  if (!gateResolved || !isAdmin) return <LogoLoader />;

  // ── Live ops derivations (feed the always-on vitals ribbon) ─────────────────
  const cvUsage = usageQ.data ?? 0;
  const cvPctUsed = Math.min(100, Math.round((cvUsage / CV_HOURLY_CAP) * 100));
  const cvColor =
    cvUsage >= CV_HOURLY_CAP * 0.8
      ? COLORS.red
      : cvUsage >= CV_HOURLY_CAP * 0.5
        ? COLORS.yellow
        : COLORS.green;
  const runs = runsQ.data?.runs ?? [];
  const activeRun = runs.find((r) => r.status === 'running');
  // Backlog ETA at the observed drain rate (heroes enriched per minute of run time).
  const drainedRuns = runs.filter((r) => r.duration_ms && r.done > 0);
  const drainMs = drainedRuns.reduce((a, r) => a + (r.duration_ms ?? 0), 0);
  const drainDone = drainedRuns.reduce((a, r) => a + r.done, 0);
  const perMin = drainMs > 0 ? drainDone / (drainMs / 60000) : 0;
  const pendingNow = h?.cvStatus.pending ?? 0;
  // The real enrichment backlog: every hero still needing an actionable step —
  // not yet fully enriched, and not terminally failed / awaiting review / unresolvable.
  const ep = enrichProgressQ.data;
  const actionable = ep
    ? Math.max(
        0,
        ep.heroesTotal -
          ep.enriched -
          (h?.cvStatus.failed ?? 0) -
          ep.comicvineUnmatched -
          ep.ambiguous -
          ep.unresolved,
      )
    : pendingNow;
  const etaMin = perMin > 0 ? actionable / perMin : 0;
  const etaLabel =
    perMin > 0 && actionable > 0
      ? etaMin >= 60
        ? `~${(etaMin / 60).toFixed(1)}h to clear`
        : `~${Math.ceil(etaMin)}m to clear`
      : null;

  const ribbon = h ? (
    <VitalsBar
      narrow={narrow}
      pending={actionable}
      etaLabel={etaLabel}
      cvPing={pingQ.data}
      cvUsage={cvUsage}
      cvColor={cvColor}
      cvPctUsed={cvPctUsed}
      activeRun={activeRun}
      stopping={busy === 'stop'}
      onStop={onStop}
      buildActive={!!buildIds}
      onStopBuild={() => setBuildIds(null)}
      cronOn={cronOn}
      drainJob={drainJob}
      spend={spendQ.data}
    />
  ) : null;

  // The ops vitals ribbon (ComicVine rate-limit, run status) only shows on the
  // Build tab; alerts live in the header notification bell (no banner real estate).
  const onlyOnBuild = domain === 'pipelines';

  return (
    <View style={styles.root}>
      {narrow && (ptrDist > 0 || ptrBusy) ? (
        <View
          style={[
            styles.ptr,
            {
              opacity: ptrBusy ? 1 : Math.min(1, ptrDist / 64),
              transform: [{ translateY: ptrDist * 0.35 }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.ptrPill}>
            <ActivityIndicator color={COLORS.orange} />
          </View>
        </View>
      ) : null}
      <CommandShell
        domain={domain}
        onDomain={setDomain}
        overall={overall}
        pending={pendingNow}
        refreshing={refreshing}
        onRefresh={onRefresh}
        narrow={narrow}
        fill={
          domain === 'command' ||
          domain === 'sources' ||
          domain === 'pipelines' ||
          domain === 'catalog'
        }
        ribbon={onlyOnBuild ? ribbon : null}
        alerts={alerts}
      >
        {h && domain === 'command' && (
          <CommandHome
            h={h}
            overall={overall}
            snaps={snapsQ.data ?? []}
            gaps={gapsQ.data}
            spend={spendQ.data}
            progress={enrichProgressQ.data}
            narrow={narrow}
            onJump={goToBackfill}
            onOpenSpend={() => setDomain('spend')}
            onOpenBuild={() => setDomain('pipelines')}
            onSnapshot={onSnapshot}
            snapshotting={busy === 'snapshot'}
          />
        )}
        {h && domain === 'catalog' && (
          <Bento fill={!narrow}>
            <SubTabs
              tabs={[
                { key: 'coverage', label: 'Coverage', icon: 'stats-chart-outline' },
                { key: 'distributions', label: 'Distributions', icon: 'pie-chart-outline' },
                { key: 'hygiene', label: 'Hygiene', icon: 'git-merge-outline' },
                { key: 'review', label: 'Review', icon: 'shield-checkmark-outline' },
              ]}
              active={catSub}
              onChange={setCatSub}
            />
            {catSub === 'coverage' || catSub === 'distributions' ? (
              <CatalogDomain
                h={h}
                gaps={gapsQ.data}
                gapsLoading={gapsQ.isLoading}
                dist={distQ.data}
                metric={metric}
                setMetric={setMetric}
                page={page}
                setPage={setPage}
                pubFilter={pubFilter}
                setPubFilter={setPubFilter}
                pickPublisher={pickPublisher}
                anim={anim}
                narrow={narrow}
                sub={catSub}
                fill={!narrow}
              />
            ) : null}
            {catSub === 'hygiene' ? (
              <ScrollView
                style={!narrow ? { flex: 1, minHeight: 0 } : undefined}
                nestedScrollEnabled
              >
                <HeroConsole
                  heroQuery={heroQuery}
                  setHeroQuery={setHeroQuery}
                  heroResults={heroSearchQ.data ?? []}
                  heroSearchLoading={heroSearchQ.isLoading}
                  busy={busy}
                  onReenrich={onReenrich}
                />
                <View style={{ marginTop: 14 }}>
                  <DuplicatesPanel
                    flash={flash}
                    onChanged={() => {
                      queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
                      queryClient.invalidateQueries({ queryKey: ['catalogDistributions'] });
                      queryClient.invalidateQueries({ queryKey: ['backfillGaps'] });
                    }}
                  />
                </View>
              </ScrollView>
            ) : null}
            {catSub === 'review' ? (
              <ScrollView
                style={!narrow ? { flex: 1, minHeight: 0 } : undefined}
                nestedScrollEnabled
              >
                <ReviewDomain />
              </ScrollView>
            ) : null}
          </Bento>
        )}
        {h && domain === 'pipelines' && (
          <PipelinesDomain
            data={{
              h,
              progress: enrichProgressQ.data,
              ambiguous: ambiguousQ.data ?? [],
              ambiguousFetching: ambiguousQ.isFetching,
              statsPending: statsPendingQ.data ?? 0,
              portraitsPending: portraitsPendingQ.data ?? 0,
              spend: spendQ.data,
              crons: cronQ.data ?? [],
              runs,
              runsTotal: runsQ.data?.total ?? 0,
              runsLoading: runsQ.isLoading,
              runsFetching: runsQ.isFetching,
              recentlyEnriched: recentEnrichedQ.data ?? [],
              log,
            }}
            actions={{
              onLoadMoreAmbiguous: () => setAmbiguousLimit((l) => l + 25),
              onRunDrain,
              onRetryFailed,
              onToggleAnyCron,
              onRescheduleCron,
              onRunResolve,
              onRunEnrich,
              onResolveQid,
              onMarkUnresolved,
              onBulkAccept,
              onLoadMore: () => setHistoryLimit((l) => l + 30),
              clearLog,
              flash,
              onHeroesAdded: () => {
                // Attach popularity to the new/changed heroes now, not next week.
                void refreshFameScores();
                queryClient.invalidateQueries({ queryKey: ['enrichmentProgress'] });
                queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
                queryClient.invalidateQueries({ queryKey: ['statsPending'] });
                queryClient.invalidateQueries({ queryKey: ['portraitsPending'] });
              },
            }}
            controls={{ buildIds, setBuildIds, busy, batchSize, setBatchSize, narrow }}
          />
        )}
        {domain === 'sources' && (
          <SourcesDomain cov={sourceCovQ.data} loading={sourceCovQ.isLoading} narrow={narrow} />
        )}
        {domain === 'campaigns' && <CampaignsDomain />}
        {domain === 'spend' && <SpendDomain spend={spendQ.data} loading={spendQ.isLoading} />}
        {domain === 'community' && (
          <CommunityDomain
            data={communityQ.data ?? null}
            loading={communityQ.isLoading}
            narrow={narrow}
            onOpenReview={() => {
              setCatSub('review');
              setDomain('catalog');
            }}
          />
        )}
        {domain === 'traffic' && (
          <TrafficDomain
            data={trafficQ.data ?? null}
            loading={trafficQ.isLoading}
            narrow={narrow}
          />
        )}
      </CommandShell>
      {/* Foreground Build board lives at page level so the top-strip Stop can halt it. */}
      {buildIds ? (
        <BuildBoard
          heroIds={buildIds}
          flash={flash}
          onClose={() => {
            // A build run fills issue_count / movie data — rescore so the just-built
            // heroes get proper popularity immediately.
            void refreshFameScores();
            setBuildIds(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Pull-to-refresh spinner — pinned just below the floating nav (64 = TOPBAR_HEIGHT).
  ptr: {
    position: 'fixed',
    top: `calc(64px + env(safe-area-inset-top) + 6px)` as unknown as number,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 60,
  } as object,
  ptrPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#10242e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
