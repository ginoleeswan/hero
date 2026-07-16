import { supabase } from '../supabase';

// Data-quality invariant checks (command center → Catalog → Hygiene → Integrity
// panel). Wraps the admin-guarded admin_data_quality() RPC, which codifies the
// corruption classes found by hand in the 2026-07-16 famous-roster audit —
// stale done rows (the Hulk/Thor signature), cross-franchise collision drift
// (issue #65's smell test), famous-row gaps, and same-name+same-publisher dups.

export interface DataQualitySample {
  id: string;
  name: string;
  fame_score: number | null;
}

export interface DataQualityCheck {
  key: string;
  label: string;
  count: number;
  sample: DataQualitySample[];
}

export interface DataQualityReport {
  generatedAt: string;
  checks: DataQualityCheck[];
}

type ReportJson =
  | ({ authorized: true; generatedAt: string; checks: DataQualityCheck[] } | { authorized: false })
  | null;

/**
 * Fetch the integrity report. Returns null for non-admins or on error so the
 * panel can render a locked/empty state.
 */
export async function fetchDataQuality(): Promise<DataQualityReport | null> {
  const { data, error } = await supabase.rpc('admin_data_quality');
  if (error) {
    console.warn('[fetchDataQuality] error:', error.message);
    return null;
  }
  const json = data as unknown as ReportJson;
  if (!json || json.authorized !== true) return null;
  return { generatedAt: json.generatedAt, checks: json.checks };
}
