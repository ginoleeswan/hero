// Pure helpers, constants and types shared across the catalog-health dashboard.
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { CatalogHealth, CoverageMetric } from '../../../lib/db/catalogHealth';

export const DRAIN_CRON = 'enrich-comicvine-pending';
export const CV_HOURLY_CAP = 200;

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

export const pct = (have: number, total: number) => (total > 0 ? Math.round((have / total) * 100) : 0);

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
  { key: 'portrait', label: 'AI Portraits', blurb: 'Styled hero art', tint: COLORS.orange, worklist: 'portrait' },
  { key: 'summary', label: 'Summaries', blurb: 'Short bio deck', tint: COLORS.blue, worklist: 'summary' },
  { key: 'firstIssue', label: 'First Issue', blurb: 'Debut + cover', tint: COLORS.gold, worklist: 'firstIssue' },
  { key: 'image', label: 'Source Image', blurb: 'ComicVine art', tint: COLORS.green },
  { key: 'stats', label: 'Powerstats', blurb: 'The six dials', tint: COLORS.green },
];

export const WORKLIST_LABEL: Record<CoverageMetric, string> = {
  portrait: 'AI Portraits',
  summary: 'Summaries',
  firstIssue: 'First Issue',
};

// ── Tabs (shared by the desktop pill row and the mobile bottom bar) ───────────
export type TabKey = 'overview' | 'backfill' | 'operations';
export const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'overview', label: 'Overview', icon: 'stats-chart' },
  { key: 'backfill', label: 'Backfill', icon: 'construct' },
  { key: 'operations', label: 'Operations', icon: 'pulse' },
];

// ── Domains (command-center rail; replaces TABS in Task 6) ─────────────────────
export type DomainKey = 'command' | 'catalog' | 'operations' | 'spend' | 'users' | 'traffic';

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
  { key: 'command', label: 'Command', icon: 'grid' },
  { key: 'catalog', label: 'Catalog', icon: 'albums', badge: 'pending' },
  { key: 'operations', label: 'Operations', icon: 'pulse' },
  { key: 'spend', label: 'Spend', icon: 'cash-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline', placeholder: true },
  { key: 'traffic', label: 'Traffic', icon: 'trending-up-outline', placeholder: true },
];

/** Primary (non-placeholder) domain keys — the mobile bottom-bar set. */
export const primaryDomainKeys = (): DomainKey[] =>
  DOMAINS.filter((d) => !d.placeholder).map((d) => d.key);

// ── Density scale (compact command-center spacing/sizing) ──────────────────────
export const DENSITY = {
  panelPad: 12,
  panelPadNarrow: 12,
  radius: 12,
  gap: 10,
  rowH: 28,
  labelSize: 10,
  hintSize: 11,
} as const;
