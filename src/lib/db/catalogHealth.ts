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
