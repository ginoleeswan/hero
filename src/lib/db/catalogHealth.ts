import { supabase } from '../supabase';

// ── Aggregate coverage (one round trip via the catalog_health() RPC) ──────────

export interface PublisherCoverage {
  publisher: string;
  total: number;
  portrait: number;
  stats: number;
  summary: number;
}

export interface CatalogHealth {
  /** Renderable heroes (enriched_at set) — the denominator for coverage. */
  total: number;
  metrics: {
    portrait: number;
    image: number;
    stats: number;
    summary: number;
    firstIssue: number;
  };
  /** comicvine_status → count, across ALL rows (incl. un-enriched). */
  cvStatus: Record<string, number>;
  byPublisher: PublisherCoverage[];
}

export async function getCatalogHealth(): Promise<CatalogHealth> {
  const { data, error } = await supabase.rpc('catalog_health');
  if (error) throw error;
  const d = (data ?? {}) as Partial<CatalogHealth>;
  return {
    total: d.total ?? 0,
    metrics: {
      portrait: d.metrics?.portrait ?? 0,
      image: d.metrics?.image ?? 0,
      stats: d.metrics?.stats ?? 0,
      summary: d.metrics?.summary ?? 0,
      firstIssue: d.metrics?.firstIssue ?? 0,
    },
    cvStatus: d.cvStatus ?? {},
    byPublisher: d.byPublisher ?? [],
  };
}

// ── Gap worklists: renderable heroes missing a given field, popular first ─────

export type CoverageMetric = 'portrait' | 'summary' | 'firstIssue';

const METRIC_COLUMN: Record<CoverageMetric, string> = {
  portrait: 'portrait_url',
  summary: 'summary',
  firstIssue: 'first_issue_id',
};

export interface GapHero {
  id: string;
  name: string;
  publisher: string | null;
  image_url: string | null;
  issue_count: number | null;
}

export interface GapPage {
  heroes: GapHero[];
  total: number;
}

export const GAP_PAGE_SIZE = 12;

/** Heroes that are renderable (enriched_at set) but missing `metric`, ordered by
 *  popularity so the most-visible gaps surface first. Paginated; `total` is the
 *  full gap count for the metric (+ optional publisher facet). */
export async function getCoverageGaps(
  metric: CoverageMetric,
  opts: { publisher?: string | null; page?: number } = {},
): Promise<GapPage> {
  const col = METRIC_COLUMN[metric];
  const page = opts.page ?? 0;
  const from = page * GAP_PAGE_SIZE;

  let q = supabase
    .from('heroes')
    .select('id, name, publisher, image_url, issue_count', { count: 'exact' })
    .not('enriched_at', 'is', null)
    .is(col, null)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .range(from, from + GAP_PAGE_SIZE - 1);

  if (opts.publisher) q = q.eq('publisher', opts.publisher);

  const { data, error, count } = await q;
  if (error) throw error;
  return { heroes: (data ?? []) as GapHero[], total: count ?? 0 };
}

// ── Monitoring: enrichment runs + cron status ─────────────────────────────────

export interface EnrichmentRun {
  id: number;
  run_type: string;
  triggered_by: string;
  status: string;
  started_at: string | null;
  cancel_requested: boolean;
  processed: number;
  done: number;
  failed: number;
  retry: number;
  remaining: number | null;
  duration_ms: number | null;
  created_at: string;
}

export async function getRecentRuns(limit = 8): Promise<EnrichmentRun[]> {
  const { data, error } = await supabase
    .from('enrichment_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EnrichmentRun[];
}

export interface RunHistoryPage {
  /** Most-recent `limit` runs, newest first. */
  runs: EnrichmentRun[];
  /** Lifetime run count (for "showing N of TOTAL" + load-more). */
  total: number;
}

/** Paginated run history with the lifetime count, for the run-history dashboard. */
export async function getRunHistory(limit = 30): Promise<RunHistoryPage> {
  const { data, error, count } = await supabase
    .from('enrichment_runs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, Math.max(0, limit - 1));
  if (error) throw error;
  return { runs: (data ?? []) as EnrichmentRun[], total: count ?? 0 };
}

export interface CronJob {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  last_status: string | null;
}

export async function getCronStatus(): Promise<CronJob[]> {
  const { data, error } = await supabase.rpc('admin_cron_status');
  if (error) throw error;
  return (data ?? []) as unknown as CronJob[];
}

/** ComicVine API units consumed in the last hour (rate-limit gauge, ~200/hr). */
export async function getComicvineUsageLastHour(): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('api_usage')
    .select('units')
    .eq('api', 'comicvine')
    .gte('created_at', since);
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + ((r as { units: number }).units ?? 0), 0);
}

// ── Actions (admin-guarded RPCs) ──────────────────────────────────────────────

export async function runDrain(limit = 25): Promise<void> {
  const { error } = await supabase.rpc('admin_run_drain', { p_limit: limit });
  if (error) throw error;
}

export async function retryFailed(): Promise<number> {
  const { data, error } = await supabase.rpc('admin_retry_failed');
  if (error) throw error;
  return (data as number | null) ?? 0;
}

export async function setDrainCron(enabled: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('admin_set_drain_cron', { p_enabled: enabled });
  if (error) throw error;
  return (data as string | null) ?? '';
}

export async function stopRun(runId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_stop_run', { p_run_id: runId });
  if (error) throw error;
  return !!data;
}

// ── Single-hero console: search any hero, re-fetch one on demand ──────────────

export interface AdminHeroResult {
  id: string;
  name: string;
  publisher: string | null;
  comicvine_status: string | null;
  enriched_at: string | null;
  portrait_url: string | null;
  image_url: string | null;
}

export async function searchHeroesAdmin(q: string): Promise<AdminHeroResult[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, publisher, comicvine_status, enriched_at, portrait_url, image_url')
    .ilike('name', `%${term}%`)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []) as AdminHeroResult[];
}

export async function reenrichHero(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reenrich_hero', { p_id: id });
  if (error) throw error;
}

export interface AmbiguousHero {
  id: string;
  name: string;
  publisher: string | null;
  imageUrl: string | null;
  candidates: { qid: string; score: number }[];
}

/** Heroes the Wikidata resolver flagged as ambiguous, marquee-first. */
export async function getAmbiguousHeroes(limit = 25): Promise<AmbiguousHero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, publisher, image_md_url, wikidata_candidates')
    .eq('wikidata_status', 'ambiguous')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Array<{
    id: string; name: string; publisher: string | null; image_md_url: string | null;
    wikidata_candidates: { qid: string; score: number }[] | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    publisher: r.publisher,
    imageUrl: r.image_md_url,
    candidates: r.wikidata_candidates ?? [],
  }));
}

/** Set a hero's Wikidata QID by hand (flips status to 'resolved'). */
export async function resolveHeroQid(heroId: string, qid: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_hero_qid', { p_hero_id: heroId, p_qid: qid });
  if (error) throw error;
}

/** Queue a Wikidata hero->QID resolve batch (mirrors runDrain for ComicVine). */
export async function runWikidataResolve(limit = 10): Promise<void> {
  const { error } = await supabase.rpc('admin_run_wikidata_resolve', { p_limit: limit });
  if (error) throw error;
}

/** Queue a Wikidata enrich batch (appearance edges + performers for resolved heroes). */
export async function runWikidataEnrich(limit = 10): Promise<void> {
  const { error } = await supabase.rpc('admin_run_wikidata_enrich', { p_limit: limit });
  if (error) throw error;
}

export interface EnrichmentProgress {
  heroesTotal: number;
  comicvineDone: number;
  resolved: number;
  ambiguous: number;
  unresolved: number;
  enriched: number; // resolved heroes whose appearances/people have been pulled
  filmTitles: number;
  tvTitles: number;
  gameTitles: number;
}

async function awaitCount(qb: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count } = await qb;
  return count ?? 0;
}

/** One snapshot of every enrichment pipeline's progress, for the Enrichment hub. */
export async function getEnrichmentProgress(): Promise<EnrichmentProgress> {
  const heroCount = () => supabase.from('heroes').select('*', { count: 'exact', head: true });
  const titleCount = () => supabase.from('titles').select('*', { count: 'exact', head: true });
  const [
    heroesTotal, comicvineDone, resolved, ambiguous, unresolved, enriched,
    filmTitles, tvTitles, gameTitles,
  ] = await Promise.all([
    awaitCount(heroCount()),
    awaitCount(heroCount().eq('comicvine_status', 'done')),
    awaitCount(heroCount().eq('wikidata_status', 'resolved')),
    awaitCount(heroCount().eq('wikidata_status', 'ambiguous')),
    awaitCount(heroCount().eq('wikidata_status', 'unresolved')),
    awaitCount(heroCount().eq('wikidata_status', 'resolved').not('wikidata_enriched_at', 'is', null)),
    awaitCount(titleCount().eq('media_type', 'film')),
    awaitCount(titleCount().eq('media_type', 'tv')),
    awaitCount(titleCount().eq('media_type', 'game')),
  ]);
  return { heroesTotal, comicvineDone, resolved, ambiguous, unresolved, enriched, filmTitles, tvTitles, gameTitles };
}

export type ComicvineStatus = 'ok' | 'limited' | 'error';
export async function pingComicvine(): Promise<ComicvineStatus> {
  const { data, error } = await supabase.functions.invoke<{ status?: string }>('comicvine-ping');
  if (error) return 'error';
  const s = data?.status;
  return s === 'ok' || s === 'limited' ? s : 'error';
}

export async function snapshotNow(): Promise<void> {
  const { error } = await supabase.rpc('admin_snapshot_now');
  if (error) throw error;
}

// ── Gemini / GCP spend (BigQuery billing export via the gemini-spend edge fn) ──

export interface GeminiSpend {
  available: boolean;
  reason?: string;
  currency?: string;
  total28?: number;
  monthToDate?: number;
  days?: { day: string; cost: number }[];
  byService?: { service: string; cost: number }[];
}

export async function getGeminiSpend(): Promise<GeminiSpend> {
  const { data, error } = await supabase.functions.invoke<GeminiSpend>('gemini-spend');
  if (error) return { available: false, reason: error.message };
  return data ?? { available: false, reason: 'no response' };
}

// ── Charts: history + distributions ───────────────────────────────────────────

export interface HealthSnapshot {
  captured_at: string;
  total: number;
  portrait: number;
  image: number;
  stats: number;
  summary: number;
  first_issue: number;
}

export async function getHealthSnapshots(limit = 60): Promise<HealthSnapshot[]> {
  const { data, error } = await supabase
    .from('catalog_health_snapshots')
    .select('captured_at, total, portrait, image, stats, summary, first_issue')
    .order('captured_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as HealthSnapshot[];
}

export interface Distributions {
  alignment: { good: number; bad: number; neutral: number; unknown: number };
  power_hist: { label: string; n: number }[];
}

export async function getCatalogDistributions(): Promise<Distributions> {
  const { data, error } = await supabase.rpc('catalog_distributions');
  if (error) throw error;
  const d = (data ?? {}) as Partial<Distributions>;
  return {
    alignment: d.alignment ?? { good: 0, bad: 0, neutral: 0, unknown: 0 },
    power_hist: d.power_hist ?? [],
  };
}
