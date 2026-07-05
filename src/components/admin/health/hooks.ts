// Logic hooks for the catalog-health dashboard — keep the screen thin & the
// behaviour unit-testable.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  getCatalogHealth,
  getCoverageGaps,
  getRunHistory,
  getCronStatus,
  getComicvineUsageLastHour,
  searchHeroesAdmin,
  pingComicvine,
  getHealthSnapshots,
  getCatalogDistributions,
  runDrain,
  retryFailed,
  stopRun,
  snapshotNow,
  reenrichHero,
  setDrainCron,
  rescheduleCron,
  getGeminiSpend,
  getAmbiguousHeroes,
  resolveHeroQid,
  markHeroUnresolved,
  runWikidataResolve,
  runWikidataEnrich,
  getEnrichmentProgress,
  getRecentlyEnriched,
  toggleCron,
  type CoverageMetric,
  type RunHistoryPage,
} from '../../../lib/db/catalogHealth';
import { getPendingStatsCount } from '../../../lib/db/stats';
import { getPendingPortraitCount } from '../../../lib/db/portraits';
import { fetchCommunityOverview } from '../../../lib/db/community';
import { fetchTrafficOverview } from '../../../lib/db/traffic';
import { fetchClientErrorOverview } from '../../../lib/db/clientErrors';
import type { LogTone, LogEntry, DomainKey } from './format';

type Flash = (msg: string, tone?: LogTone) => void;

/**
 * All of the dashboard's read queries plus the two data-freshness effects
 * (fast-poll while a run is live, and realtime invalidation on enrichment_runs).
 * Returns the query objects; the screen reads `.data`.
 */
export function useCatalogQueries({
  enabled,
  domain,
  metric,
  page,
  pubFilter,
  heroQuery,
  historyLimit,
  ambiguousLimit,
  trafficDays,
}: {
  enabled: boolean;
  domain: DomainKey;
  metric: CoverageMetric;
  page: number;
  pubFilter: string | null;
  heroQuery: string;
  historyLimit: number;
  ambiguousLimit: number;
  trafficDays: number;
}) {
  const queryClient = useQueryClient();
  // Only run/poll a query on the tab(s) that actually render its data — avoids
  // continuous ComicVine pings + DB polling on tabs that never show them. The
  // overall gauge (healthQ) is the one thing every tab needs.
  const onHome = domain === 'command';
  const onCatalog = domain === 'catalog';
  const onBuild = domain === 'pipelines';
  const onSpend = domain === 'spend';
  const onCommunity = domain === 'community';
  const onTraffic = domain === 'traffic';
  const onErrors = domain === 'errors';

  const healthQ = useQuery({
    queryKey: ['catalogHealth'],
    queryFn: getCatalogHealth,
    enabled,
    staleTime: 60_000,
  });
  const gapsQ = useQuery({
    queryKey: ['coverageGaps', metric, page, pubFilter],
    queryFn: () => getCoverageGaps(metric, { page, publisher: pubFilter }),
    enabled: enabled && (onHome || onCatalog),
    staleTime: 60_000,
  });
  const runsQ = useQuery({
    queryKey: ['enrichmentRuns', historyLimit],
    queryFn: () => getRunHistory(historyLimit),
    enabled: enabled && onBuild,
    placeholderData: (prev) => prev, // keep history visible while "load more" fetches
    // Poll fast while a run is in flight, slow otherwise.
    refetchInterval: (q) =>
      ((q.state.data as RunHistoryPage | undefined)?.runs ?? []).some((r) => r.status === 'running')
        ? 2500
        : 15_000,
  });
  const cronQ = useQuery({
    queryKey: ['cronStatus'],
    queryFn: getCronStatus,
    enabled: enabled && onBuild,
  });
  const heroSearchQ = useQuery({
    queryKey: ['adminHeroSearch', heroQuery],
    queryFn: () => searchHeroesAdmin(heroQuery),
    enabled: enabled && heroQuery.trim().length >= 2,
    staleTime: 30_000,
  });
  const pingQ = useQuery({
    queryKey: ['cvPing'],
    queryFn: pingComicvine,
    enabled: enabled && onBuild,
    refetchInterval: 60_000,
  });
  const usageQ = useQuery({
    queryKey: ['cvUsage'],
    queryFn: getComicvineUsageLastHour,
    enabled: enabled && onBuild,
    refetchInterval: 30_000,
  });
  const distQ = useQuery({
    queryKey: ['distributions'],
    queryFn: getCatalogDistributions,
    enabled: enabled && onCatalog,
    staleTime: 60_000,
  });
  const snapsQ = useQuery({
    queryKey: ['healthSnapshots'],
    queryFn: () => getHealthSnapshots(60),
    enabled: enabled && onHome,
    staleTime: 60_000,
  });
  const spendQ = useQuery({
    queryKey: ['geminiSpend'],
    queryFn: getGeminiSpend,
    enabled: enabled && (onHome || onSpend || onBuild),
    staleTime: 5 * 60_000,
  });
  const ambiguousQ = useQuery({
    queryKey: ['ambiguousHeroes', ambiguousLimit],
    queryFn: () => getAmbiguousHeroes(ambiguousLimit),
    enabled: enabled && onBuild,
    placeholderData: (prev) => prev, // keep the list visible while "load more" fetches
    staleTime: 30_000,
  });
  const enrichProgressQ = useQuery({
    queryKey: ['enrichmentProgress'],
    queryFn: getEnrichmentProgress,
    enabled: enabled && (onHome || onBuild),
    staleTime: 30_000,
  });
  const statsPendingQ = useQuery({
    queryKey: ['statsPending'],
    queryFn: getPendingStatsCount,
    enabled: enabled && onBuild,
    staleTime: 30_000,
  });
  const portraitsPendingQ = useQuery({
    queryKey: ['portraitsPending'],
    queryFn: getPendingPortraitCount,
    enabled: enabled && onBuild,
    staleTime: 30_000,
  });
  const recentEnrichedQ = useQuery({
    queryKey: ['recentlyEnriched'],
    queryFn: () => getRecentlyEnriched(24),
    enabled: enabled && onBuild,
    staleTime: 15_000,
  });
  const communityQ = useQuery({
    queryKey: ['communityOverview'],
    queryFn: fetchCommunityOverview,
    enabled: enabled && onCommunity,
    staleTime: 60_000,
  });
  const trafficQ = useQuery({
    queryKey: ['trafficOverview', trafficDays],
    queryFn: () => fetchTrafficOverview(trafficDays),
    enabled: enabled && onTraffic,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev, // keep the chart up while switching ranges
  });
  const errorsQ = useQuery({
    queryKey: ['clientErrorOverview'],
    queryFn: () => fetchClientErrorOverview(7),
    enabled: enabled && onErrors,
    staleTime: 60_000,
  });

  // While a run is in flight, poll backlog + usage so the live numbers tick down.
  const runsData = runsQ.data;
  useEffect(() => {
    const live = (runsData?.runs ?? []).some((r) => r.status === 'running');
    if (!live) return;
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
      queryClient.invalidateQueries({ queryKey: ['cvUsage'] });
    }, 4000);
    return () => clearInterval(id);
  }, [runsData, queryClient]);

  // Realtime: any change to enrichment_runs refreshes the runs view instantly.
  // Unique channel name per effect run — reusing a fixed name returns the
  // already-subscribed channel and ".on() after subscribe()" throws (StrictMode
  // double-mount / re-runs).
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`admin-enrichment-runs-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrichment_runs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['enrichmentRuns'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  return {
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
    errorsQ,
  };
}

/**
 * Session activity log + a transient toast. `flash` shows the toast AND records
 * it permanently in the log; `logEvent` records without a toast.
 */
export function useActivityLog() {
  const seq = useRef(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const logEvent = useCallback((tone: LogTone, text: string) => {
    setLog((prev) => [{ id: ++seq.current, at: Date.now(), tone, text }, ...prev].slice(0, 80));
  }, []);

  const flash = useCallback(
    (msg: string, tone: LogTone = 'info') => {
      setToast(msg);
      setTimeout(() => setToast(null), 4000);
      logEvent(tone, msg);
    },
    [logEvent],
  );

  const clearLog = useCallback(() => setLog([]), []);

  return { log, toast, flash, logEvent, clearLog };
}

// This screen's React Query keys — refreshed together, not the whole app cache.
const REFRESH_KEYS = [
  'catalogHealth',
  'coverageGaps',
  'enrichmentRuns',
  'cronStatus',
  'cvPing',
  'cvUsage',
  'distributions',
  'healthSnapshots',
  'geminiSpend',
  'ambiguousHeroes',
  'enrichmentProgress',
  'recentlyEnriched',
];

/**
 * Admin mutations (drain / retry / stop / snapshot / re-enrich / cron) plus a
 * scoped manual refresh. Each action drives a single `busy` key and reports via
 * `flash`; callers wire the result into buttons.
 */
export function useCatalogActions({
  batchSize,
  cronOn,
  flash,
}: {
  batchSize: number;
  cronOn: boolean;
  flash: Flash;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRunDrain = async () => {
    setBusy('drain');
    try {
      await runDrain(batchSize);
      flash(`Batch of ${batchSize} queued — watch it run below.`, 'pending');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['enrichmentRuns'] }), 2000);
    } catch (e) {
      flash(`Drain failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onRetryFailed = async () => {
    setBusy('retry');
    try {
      const n = await retryFailed();
      flash(`${n.toLocaleString()} failed hero${n === 1 ? '' : 'es'} requeued.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['catalogHealth'] });
    } catch (e) {
      flash(`Retry failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onStop = async (runId: number) => {
    setBusy('stop');
    try {
      const ok = await stopRun(runId);
      flash(
        ok ? `Stopping run #${runId} after the current hero…` : 'Run already finished.',
        'info',
      );
      queryClient.invalidateQueries({ queryKey: ['enrichmentRuns'] });
    } catch (e) {
      flash(`Stop failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onSnapshot = async () => {
    setBusy('snapshot');
    try {
      await snapshotNow();
      flash('Snapshot captured.', 'success');
      queryClient.invalidateQueries({ queryKey: ['healthSnapshots'] });
    } catch (e) {
      flash(`Snapshot failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onReenrich = async (id: string, name: string) => {
    setBusy(`reenrich-${id}`);
    try {
      await reenrichHero(id);
      flash(`Re-fetching ${name} from ComicVine…`, 'pending');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['adminHeroSearch'] }), 5000);
    } catch (e) {
      flash(`Re-fetch failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onRunResolve = async () => {
    setBusy('resolve');
    try {
      await runWikidataResolve(15);
      flash('Wikidata resolve batch queued — watch it run below.', 'pending');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['enrichmentRuns'] });
        queryClient.invalidateQueries({ queryKey: ['ambiguousHeroes'] });
        queryClient.invalidateQueries({ queryKey: ['enrichmentProgress'] });
      }, 4000);
    } catch (e) {
      flash(`Resolve failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onRunEnrich = async () => {
    setBusy('enrich');
    try {
      await runWikidataEnrich(10);
      flash('Wikidata enrich batch queued — watch it run below.', 'pending');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['enrichmentRuns'] });
        queryClient.invalidateQueries({ queryKey: ['enrichmentProgress'] });
      }, 4000);
    } catch (e) {
      flash(`Enrich failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onResolveQid = async (id: string, qid: string, name: string) => {
    setBusy(`resolveqid-${id}`);
    try {
      await resolveHeroQid(id, qid);
      flash(`Set ${name} → ${qid}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['ambiguousHeroes'] });
      queryClient.invalidateQueries({ queryKey: ['enrichmentProgress'] });
    } catch (e) {
      flash(`Set QID failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  // "None of these" — drop a hero out of the ambiguous queue as unresolved.
  const onMarkUnresolved = async (id: string, name: string) => {
    setBusy(`resolveqid-${id}`);
    try {
      await markHeroUnresolved(id);
      flash(`Marked ${name} unresolved.`, 'info');
      queryClient.invalidateQueries({ queryKey: ['ambiguousHeroes'] });
      queryClient.invalidateQueries({ queryKey: ['enrichmentProgress'] });
    } catch (e) {
      flash(`Update failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  // Accept the top candidate for every hero whose best score clears the bar.
  const onBulkAccept = async (
    heroes: { id: string; candidates: { qid: string; score: number }[] }[],
    threshold: number,
  ) => {
    const picks = heroes
      .map((h) => ({ id: h.id, top: [...h.candidates].sort((a, b) => b.score - a.score)[0] }))
      .filter(
        (p): p is { id: string; top: { qid: string; score: number } } =>
          !!p.top && p.top.score >= threshold,
      );
    if (picks.length === 0) {
      flash(`No matches at or above ${threshold.toFixed(2)}.`, 'info');
      return;
    }
    setBusy('bulk-accept');
    let ok = 0;
    try {
      for (const p of picks) {
        try {
          await resolveHeroQid(p.id, p.top.qid);
          ok++;
        } catch {
          /* skip, continue */
        }
      }
      flash(`Accepted ${ok} confident match${ok === 1 ? '' : 'es'}.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['ambiguousHeroes'] });
      queryClient.invalidateQueries({ queryKey: ['enrichmentProgress'] });
    } finally {
      setBusy(null);
    }
  };

  const onToggleAnyCron = async (jobname: string, enabled: boolean) => {
    setBusy(`cron-${jobname}`);
    try {
      const state = await toggleCron(jobname, enabled);
      flash(`Cron "${jobname}" ${state}.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['cronStatus'] });
    } catch (e) {
      flash(`Cron toggle failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onRescheduleCron = async (jobname: string, schedule: string, limit: number | null) => {
    setBusy(`cron-${jobname}`);
    try {
      await rescheduleCron(jobname, schedule, limit);
      flash(`Cron "${jobname}" updated.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['cronStatus'] });
    } catch (e) {
      flash(`Cron update failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const onToggleCron = async () => {
    setBusy('cron');
    try {
      const state = await setDrainCron(!cronOn);
      flash(`Auto-drain cron ${state}.`, 'success');
      queryClient.invalidateQueries({ queryKey: ['cronStatus'] });
    } catch (e) {
      flash(`Cron toggle failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  // Refetch this screen's queries (not the whole app cache) and keep the spinner
  // up until they settle, with a small minimum so the tap registers.
  const onRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    const started = Date.now();
    Promise.all(REFRESH_KEYS.map((k) => queryClient.invalidateQueries({ queryKey: [k] }))).finally(
      () => setTimeout(() => setRefreshing(false), Math.max(0, 450 - (Date.now() - started))),
    );
  };

  return {
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
  };
}
