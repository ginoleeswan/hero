// Pure helpers, constants and types shared across the catalog-health dashboard.
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { CatalogHealth, CoverageMetric } from '../../../lib/db/catalogHealth';
import type { Alert } from './AlertStack';

export const DRAIN_CRON = 'enrich-comicvine-pending';
export const CV_HOURLY_CAP = 200;

// Soft monthly Gemini budget (USD). The AI-generation runners (powerstats, later
// portraits) disable their Run button once month-to-date spend reaches this, so
// you never kick off paid work over budget. Adjust to your actual billing cap.
export const GEMINI_MONTHLY_BUDGET = 150;

// Rough per-item cost estimates (USD) for the AI runners, so a batch can show an
// approximate spend before you launch it. Powerstats is a tiny flash-lite text
// call; a portrait is a Gemini image generation (style transfer / Imagen). These
// are ballpark figures for the preview only — actual billing is authoritative.
export const STATS_COST_PER_ITEM = 0.002;
export const PORTRAIT_COST_PER_ITEM = 0.04;

/** "<$0.01" for tiny sums, otherwise "$0.42" / "$3" — for batch cost previews. */
export const estCost = (n: number, perItem: number): string => {
  const total = n * perItem;
  if (total === 0) return '$0';
  if (total < 0.01) return '<$0.01';
  return total < 1 ? `$${total.toFixed(2)}` : `$${total.toFixed(total < 10 ? 1 : 0)}`;
};

export const relTime = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// Day bucketing for the run-history dashboard.
export const dayKey = (iso: string) => new Date(iso).toDateString();
export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

export const pct = (have: number, total: number) =>
  total > 0 ? Math.round((have / total) * 100) : 0;

/**
 * Overlay an opacity (0–1) onto a 6-digit hex colour → 8-digit `#RRGGBBAA`.
 * One home for the dashboard's many translucent tints, replacing scattered
 * `COLORS.navy + '12'` string math with `withAlpha(COLORS.navy, 0.07)`.
 */
export const withAlpha = (hex: string, opacity: number): string =>
  hex +
  Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');

/** Wall-clock HH:MM:SS for log lines (24h, no locale surprises). */
export const logClock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour12: false });

/** Shared status → colour for runs (table + mobile cards + log). */
export const runStatusColor = (status: string) =>
  status === 'running'
    ? COLORS.orange
    : status === 'error'
      ? COLORS.red
      : status === 'stopped'
        ? COLORS.navy
        : COLORS.green;

/** Shared source ("admin"/cron) chip colours for runs (table + mobile cards). */
export const runSourceChip = (by: string) => ({
  bg: by === 'admin' ? COLORS.orange + '22' : '#efe6d6',
  fg: by === 'admin' ? COLORS.orange : COLORS.navy,
});

/** Friendly label for a run's pipeline, from its run_type. */
export const runTypeLabel = (runType: string): string => {
  const t = (runType ?? '').toLowerCase();
  if (t === 'wikidata_resolve') return 'Wikidata · resolve';
  if (t === 'wikidata_enrich') return 'Wikidata · appearances';
  if (t.includes('tmdb')) return 'TMDB · media';
  if (t.includes('comicvine')) return 'ComicVine';
  if (t.includes('wikidata')) return 'Wikidata';
  if (t.includes('snapshot')) return 'Health snapshot';
  return runType || 'run';
};

/** Health colour ramp: red (poor) → gold (partial) → green (strong). */
export const healthColor = (p: number) =>
  p >= 80 ? COLORS.green : p >= 50 ? COLORS.yellow : COLORS.red;

// ── Activity log ──────────────────────────────────────────────────────────────
export type LogTone = 'info' | 'success' | 'error' | 'pending';
export interface LogEntry {
  id: number;
  at: number;
  tone: LogTone;
  text: string;
}
export const LOG_TONE_COLOR: Record<LogTone, string> = {
  success: COLORS.green,
  error: COLORS.red,
  pending: COLORS.orange,
  info: COLORS.navy,
};

// ── Coverage metric catalogue (label, tint, whether it has a worklist) ────────
export interface MetricDef {
  key: keyof CatalogHealth['metrics'];
  label: string;
  blurb: string;
  tint: string;
  worklist?: CoverageMetric;
}
export const METRICS: MetricDef[] = [
  {
    key: 'portrait',
    label: 'AI Portraits',
    blurb: 'Styled hero art',
    tint: COLORS.orange,
    worklist: 'portrait',
  },
  {
    key: 'summary',
    label: 'Summaries',
    blurb: 'Short bio deck',
    tint: COLORS.blue,
    worklist: 'summary',
  },
  {
    key: 'firstIssue',
    label: 'First Issue',
    blurb: 'Debut + cover',
    tint: COLORS.gold,
    worklist: 'firstIssue',
  },
  { key: 'image', label: 'Source Image', blurb: 'ComicVine art', tint: COLORS.green },
  { key: 'stats', label: 'Powerstats', blurb: 'The six dials', tint: COLORS.green },
];

export const WORKLIST_LABEL: Record<CoverageMetric, string> = {
  portrait: 'AI Portraits',
  summary: 'Summaries',
  firstIssue: 'First Issue',
};

// ── Domains (command-center rail) ─────────────────────────────────────────────
export type DomainKey =
  | 'command'
  | 'catalog'
  | 'sources'
  | 'pipelines'
  | 'campaigns'
  | 'social'
  | 'spend'
  | 'community'
  | 'traffic'
  | 'errors'
  | 'reports';

export interface DomainDef {
  key: DomainKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Future app-wide domains: render a "coming soon" placeholder. */
  placeholder?: boolean;
  /** Show the pending backlog badge on this rail item. */
  badge?: 'pending';
}

export const DOMAINS: DomainDef[] = [
  { key: 'command', label: 'Overview', icon: 'grid' },
  { key: 'catalog', label: 'Catalog', icon: 'albums', badge: 'pending' },
  { key: 'sources', label: 'Sources', icon: 'git-network-outline' },
  { key: 'pipelines', label: 'Build', icon: 'construct-outline' },
  { key: 'campaigns', label: 'Campaigns', icon: 'megaphone-outline' },
  { key: 'social', label: 'Social', icon: 'share-social-outline' },
  { key: 'spend', label: 'Spend', icon: 'cash-outline' },
  { key: 'community', label: 'Community', icon: 'people-outline' },
  { key: 'traffic', label: 'Traffic', icon: 'trending-up-outline' },
  { key: 'errors', label: 'Errors', icon: 'bug-outline' },
  { key: 'reports', label: 'Reports', icon: 'flag-outline' },
];

/** Primary (non-placeholder) domain keys — the mobile bottom-bar set. */
export const primaryDomainKeys = (): DomainKey[] =>
  DOMAINS.filter((d) => !d.placeholder).map((d) => d.key);

// ── Density scale (compact command-center spacing/sizing) ──────────────────────
export const DENSITY = {
  panelPad: 12,
  // Mobile gets more inner breathing room than the dense desktop grid, so full-
  // width content (bar lists, rows) doesn't run flush to the card edge and read
  // as spilling out of the box.
  panelPadNarrow: 18,
  radius: 12,
  gap: 10,
  rowH: 28,
  labelSize: 10,
  hintSize: 11,
} as const;

// ── Command-center alert + backlog derivations (pure, unit-tested) ────────────

/** Everything the alert stack derives from — plain values, no query objects. */
export interface AlertInputs {
  /** ComicVine ping result ('ok' | 'limited' | 'error' | undefined while loading). */
  cvPing: string | undefined;
  cvUsage: number;
  cvFailed: number;
  lastRunStatus: string | undefined;
  unbrandedCount: number;
  openReports: number;
}

/** Derive the alert list (bell + mobile banner) from current vitals. */
export function buildAlerts(i: AlertInputs): Alert[] {
  const a: Alert[] = [];
  if (i.cvPing === 'limited')
    a.push({ tone: 'gold', text: 'ComicVine is rate-limited right now — drains will mostly retry.' });
  else if (i.cvUsage >= CV_HOURLY_CAP * 0.8)
    a.push({ tone: 'gold', text: `ComicVine usage high — ${i.cvUsage}/${CV_HOURLY_CAP} calls this hour.` });
  if (i.cvFailed > 0)
    a.push({ tone: 'red', text: `${i.cvFailed} hero(es) marked failed — use "Retry failed" on the Build tab.` });
  if (i.lastRunStatus === 'error')
    a.push({ tone: 'red', text: 'The last run errored — see the Build tab.' });
  if (i.unbrandedCount > 0)
    a.push({
      tone: 'gold',
      text: `${i.unbrandedCount} character${i.unbrandedCount === 1 ? '' : 's'} need a universe — see Catalog › Hygiene.`,
    });
  if (i.openReports > 0)
    a.push({ tone: 'red', text: `${i.openReports} open report${i.openReports === 1 ? '' : 's'} — see Inbox.` });
  return a;
}

/** The subset of EnrichmentProgress the backlog math needs. */
export interface BacklogProgress {
  heroesTotal: number;
  enriched: number;
  comicvineUnmatched: number;
  ambiguous: number;
  unresolved: number;
}

/**
 * The real enrichment backlog: heroes still needing an actionable step — not yet
 * fully enriched and not terminally failed / awaiting review / unresolvable.
 */
export function actionableBacklog(
  progress: BacklogProgress | undefined,
  cvFailed: number,
  pendingNow: number,
): number {
  if (!progress) return pendingNow;
  return Math.max(
    0,
    progress.heroesTotal -
      progress.enriched -
      cvFailed -
      progress.comicvineUnmatched -
      progress.ambiguous -
      progress.unresolved,
  );
}

/** The subset of a run row the ETA math needs. */
export interface RunLike {
  status: string;
  duration_ms: number | null;
  done: number;
}

/** "~5m to clear" / "~1.5h to clear" at the observed drain rate, or null. */
export function backlogEtaLabel(runs: RunLike[], actionable: number): string | null {
  const drained = runs.filter((r) => r.duration_ms && r.done > 0);
  const ms = drained.reduce((a, r) => a + (r.duration_ms ?? 0), 0);
  const done = drained.reduce((a, r) => a + r.done, 0);
  const perMin = ms > 0 ? done / (ms / 60000) : 0;
  if (perMin <= 0 || actionable <= 0) return null;
  const etaMin = actionable / perMin;
  return etaMin >= 60 ? `~${(etaMin / 60).toFixed(1)}h to clear` : `~${Math.ceil(etaMin)}m to clear`;
}

// ── Lane deep-links ──────────────────────────────────────────────────────────────

/**
 * Cross-lane deep-link payload: which sub-tab to land on. `n` is a monotonically
 * increasing token so repeating the same jump re-fires the lane's effect.
 */
export interface LaneJump<S extends string> {
  sub: S;
  n: number;
}
