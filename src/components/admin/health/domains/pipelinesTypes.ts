// Grouped prop contracts for the Build ("Pipelines") domain. Splitting the ~35
// flat props the screen used to drill into three intent-named buckets — what to
// show (data), what the buttons do (actions), and the orchestration state
// (controls) — documents the boundary in one place and keeps the component tidy.
import type { LogTone, LogEntry } from '../format';
import type {
  AmbiguousHero,
  CatalogHealth,
  CronJob,
  EnrichmentProgress,
  EnrichmentRun,
  GeminiSpend,
  RecentlyEnriched,
} from '../../../../lib/db/catalogHealth';

/** Everything the Build views render — query results and screen-derived values. */
export interface PipelinesData {
  h: CatalogHealth;
  progress: EnrichmentProgress | undefined;
  ambiguous: AmbiguousHero[];
  ambiguousFetching: boolean;
  statsPending: number;
  portraitsPending: number;
  spend: GeminiSpend | undefined;
  crons: CronJob[];
  runs: EnrichmentRun[];
  runsTotal: number;
  runsLoading: boolean;
  runsFetching: boolean;
  recentlyEnriched: RecentlyEnriched[];
  log: LogEntry[];
}

/** Every callback the Build views invoke (drains, cron toggles, review, paging). */
export interface PipelinesActions {
  onLoadMoreAmbiguous: () => void;
  onRunDrain: () => void;
  onRetryFailed: () => void;
  onToggleAnyCron: (jobname: string, enabled: boolean) => void;
  onRescheduleCron: (jobname: string, schedule: string, limit: number | null) => void;
  onRunResolve: () => void;
  onRunEnrich: () => void;
  onResolveQid: (id: string, qid: string, name: string) => void;
  onMarkUnresolved: (id: string, name: string) => void;
  onBulkAccept: (heroes: AmbiguousHero[], threshold: number) => void;
  onLoadMore: () => void;
  clearLog: () => void;
  flash: (msg: string, tone?: LogTone) => void;
  onHeroesAdded: () => void;
}

/** Orchestration state shared with the screen (live board set, busy key, batch). */
export interface PipelinesControls {
  buildIds: string[] | null;
  setBuildIds: (ids: string[] | null) => void;
  busy: string | null;
  batchSize: number;
  setBatchSize: (n: number) => void;
  narrow: boolean;
}
