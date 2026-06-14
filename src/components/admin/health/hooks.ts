// Logic hooks for the catalog-health dashboard — keep the screen thin & the
// behaviour unit-testable.
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  runDrain,
  retryFailed,
  stopRun,
  snapshotNow,
  reenrichHero,
  setDrainCron,
} from '../../../lib/db/catalogHealth';
import type { LogTone, LogEntry } from './format';

type Flash = (msg: string, tone?: LogTone) => void;

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
      flash(ok ? `Stopping run #${runId} after the current hero…` : 'Run already finished.', 'info');
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
    Promise.all(REFRESH_KEYS.map((k) => queryClient.invalidateQueries({ queryKey: [k] }))).finally(() =>
      setTimeout(() => setRefreshing(false), Math.max(0, 450 - (Date.now() - started))),
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
    onToggleCron,
    onRefresh,
  };
}
