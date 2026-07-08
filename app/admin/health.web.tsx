import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useCommandAlerts } from '../../src/contexts/CommandAlertsContext';
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/hooks/useAuth';
import { getProfile } from '../../src/lib/db/profiles';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { LogoLoader } from '../../src/components/ui/LogoLoader';
import { COLORS, SURFACE } from '../../src/constants/colors';
import {
  DRAIN_CRON,
  CV_HOURLY_CAP,
  pct,
  METRICS,
  buildAlerts,
  actionableBacklog,
  backlogEtaLabel,
  type DomainKey,
  type LaneJump,
} from '../../src/components/admin/health/format';
import { CommandShell, CHROME_TOP } from '../../src/components/admin/health/CommandShell';
import { VitalsBar } from '../../src/components/admin/health/VitalsBar';
import { type Alert } from '../../src/components/admin/health/AlertStack';
import { CommandHome } from '../../src/components/admin/health/domains/CommandHome';
import {
  CatalogLane,
  type CatalogJump,
} from '../../src/components/admin/health/domains/CatalogLane';
import { Bento } from '../../src/components/admin/health/Bento';
import {
  PipelinesDomain,
  type BuildSub,
} from '../../src/components/admin/health/domains/PipelinesDomain';
import { BuildBoard } from '../../src/components/admin/health/BuildBoard';
import { refreshFameScores } from '../../src/lib/db/build';
import { listUnbrandedHeroes } from '../../src/lib/db/catalogHealth';
import { InboxLane, type InboxSub } from '../../src/components/admin/health/domains/InboxLane';
import { AudienceLane } from '../../src/components/admin/health/domains/AudienceLane';
import { PublishLane } from '../../src/components/admin/health/domains/PublishLane';
import { fetchReportsQueue } from '../../src/lib/db/reports';
import { getReviewQueue } from '../../src/lib/db/contributions';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';
import {
  CommandHomeSkeleton,
  CatalogSkeleton,
  PipelinesSkeleton,
} from '../../src/components/admin/health/skeletons';
import {
  useActivityLog,
  useCatalogActions,
  useCatalogQueries,
  useRunLogStream,
} from '../../src/components/admin/health/hooks';

export default function AdminHealthScreen() {
  // Full-ink command centre: canvas and chrome both ink, declared together so the
  // top band fuses with the floating nav. (Retires the old #10242e one-off.)
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const narrow = winW < 760;
  const { user, loading: authLoading } = useAuth();

  const [domain, setDomain] = useState<DomainKey>('command');
  const [batchSize, setBatchSize] = useState(25);
  const [historyLimit, setHistoryLimit] = useState(30);
  const [ambiguousLimit, setAmbiguousLimit] = useState(25);
  // The live foreground Build board's working set. Lifted here so the top-strip
  // Stop can halt it too — a true universal kill switch across server + client runs.
  const [buildIds, setBuildIds] = useState<string[] | null>(null);
  // Cross-lane deep-links: monotonically increasing token per lane.
  const [catalogJump, setCatalogJump] = useState<CatalogJump | null>(null);
  const [inboxJump, setInboxJump] = useState<LaneJump<InboxSub> | null>(null);
  const [buildJump, setBuildJump] = useState<LaneJump<BuildSub> | null>(null);

  const jumpCatalog = (j: Omit<CatalogJump, 'n'>) => {
    setCatalogJump({ ...j, n: (catalogJump?.n ?? 0) + 1 });
    setDomain('catalog');
  };
  const jumpInbox = (sub: InboxSub) => {
    setInboxJump({ sub, n: (inboxJump?.n ?? 0) + 1 });
    setDomain('inbox');
  };
  const jumpBuild = (sub: BuildSub) => {
    setBuildJump({ sub, n: (buildJump?.n ?? 0) + 1 });
    setDomain('pipelines');
  };

  const profileQ = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });
  const unbrandedQ = useQuery({
    queryKey: ['unbrandedHeroes'],
    queryFn: () => listUnbrandedHeroes(300),
    enabled: !!user,
  });
  const openReportsQ = useQuery({
    queryKey: ['reportsQueue', 'open'],
    queryFn: () => fetchReportsQueue('open'),
    enabled: !!user,
  });
  const gateResolved = !authLoading && (!user || profileQ.isSuccess || profileQ.isError);
  const isAdmin = !!profileQ.data?.is_admin;
  useEffect(() => {
    if (gateResolved && !isAdmin) router.replace('/explore');
  }, [gateResolved, isAdmin, router]);

  // Review-queue count for the Inbox rail badge (shares the lane's cache key).
  const reviewQ = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: () => getReviewQueue(),
    enabled: gateResolved && isAdmin,
    staleTime: 30_000,
  });

  const {
    healthQ,
    gapsQ,
    runsQ,
    cronQ,
    pingQ,
    usageQ,
    snapsQ,
    spendQ,
    ambiguousQ,
    enrichProgressQ,
    statsPendingQ,
    portraitsPendingQ,
    recentEnrichedQ,
  } = useCatalogQueries({
    enabled: gateResolved && isAdmin,
    domain,
    historyLimit,
    ambiguousLimit,
  });

  const drainJob = cronQ.data?.find((j) => j.jobname === DRAIN_CRON);
  const cronOn = !!drainJob?.active;
  const { log, flash, logEvent, clearLog } = useActivityLog();
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
    onToggleAnyCron,
    onRescheduleCron,
    onRefresh,
  } = useCatalogActions({ batchSize, cronOn, flash });

  const h = healthQ.data;
  // The three dashboard tabs are gated on the catalog_health snapshot (`h`). Drive
  // their skeleton off a phased transition so a fast load (now ~80ms) never flashes
  // a half-frame of skeleton — only a load that outlasts the delay shows one.
  const healthLoadPhase = useSkeletonTransition(!h);
  const showHealthSkeleton = healthLoadPhase === 'skeleton';

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

  // Run-log streaming (extracted hook).
  useRunLogStream(runsQ.data?.runs, logEvent);

  // Alerts surface problems without hunting. Memoised so the auto-collapse effect
  // can re-fold the mobile banner once they drop back to ≤1.
  const alerts = useMemo<Alert[]>(
    () =>
      buildAlerts({
        cvPing: pingQ.data,
        cvUsage: usageQ.data ?? 0,
        cvFailed: h?.cvStatus.failed ?? 0,
        lastRunStatus: runsQ.data?.runs[0]?.status,
        unbrandedCount: unbrandedQ.data?.length ?? 0,
        openReports: openReportsQ.data?.length ?? 0,
      }),
    [pingQ.data, usageQ.data, h, runsQ.data, unbrandedQ.data, openReportsQ.data],
  );

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
  // Backlog vitals (pure helpers from Task 1).
  const pendingNow = h?.cvStatus.pending ?? 0;
  const actionable = actionableBacklog(enrichProgressQ.data, h?.cvStatus.failed ?? 0, pendingNow);
  const etaLabel = backlogEtaLabel(runsQ.data?.runs ?? [], actionable);

  // Rail/tab badges from the registry's badge keys.
  const badges: Partial<Record<DomainKey, number>> = {
    catalog: pendingNow,
    inbox: (openReportsQ.data?.length ?? 0) + (reviewQ.data?.length ?? 0),
  };

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
      <SkeletonProvider>
        <CommandShell
          domain={domain}
          onDomain={setDomain}
          overall={overall}
          badges={badges}
          refreshing={refreshing}
          onRefresh={onRefresh}
          narrow={narrow}
          ribbon={domain === 'pipelines' ? ribbon : null}
          alerts={alerts}
        >
          {domain === 'command' &&
            (h ? (
              <CommandHome
                h={h}
                overall={overall}
                snaps={snapsQ.data ?? []}
                gaps={gapsQ.data}
                spend={spendQ.data}
                progress={enrichProgressQ.data}
                narrow={narrow}
                onJump={(m) => jumpCatalog({ sub: 'coverage', metric: m })}
                onOpenSpend={() => jumpBuild('spend')}
                onOpenBuild={() => setDomain('pipelines')}
                onSnapshot={onSnapshot}
                snapshotting={busy === 'snapshot'}
              />
            ) : showHealthSkeleton ? (
              <CommandHomeSkeleton narrow={narrow} />
            ) : null)}
          {domain === 'catalog' &&
            (h ? (
              <Bento fill={!narrow}>
                <CatalogLane
                  h={h}
                  narrow={narrow}
                  anim={anim}
                  unbranded={unbrandedQ.data ?? []}
                  unbrandedLoading={unbrandedQ.isLoading}
                  busy={busy}
                  onReenrich={onReenrich}
                  flash={flash}
                  jump={catalogJump}
                />
              </Bento>
            ) : showHealthSkeleton ? (
              <CatalogSkeleton narrow={narrow} />
            ) : null)}
          {domain === 'pipelines' &&
            (h ? (
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
                jump={buildJump}
              />
            ) : showHealthSkeleton ? (
              <PipelinesSkeleton narrow={narrow} />
            ) : null)}
          {domain === 'inbox' && <InboxLane jump={inboxJump} />}
          {domain === 'audience' && (
            <AudienceLane narrow={narrow} onOpenReview={() => jumpInbox('review')} />
          )}
          {domain === 'publish' && <PublishLane />}
        </CommandShell>
      </SkeletonProvider>
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
    backgroundColor: CHROME_TOP,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
