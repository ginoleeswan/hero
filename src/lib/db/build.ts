import { supabase } from '../supabase';

export type BuildStage =
  | 'comicvine'
  | 'resolve'
  | 'appearances'
  | 'review'
  | 'unresolved'
  | 'failed'
  | 'done';
export const ACTIONABLE: BuildStage[] = ['comicvine', 'resolve', 'appearances'];

export interface BuildHero {
  id: string;
  name: string;
  image: string | null;
  stage: BuildStage;
  publisher: string | null;
  // Wikidata match candidates — only meaningful at the 'review' stage, where the
  // Build board lets you pick the right one inline.
  candidates: { qid: string; score: number }[];
}

interface HeroRow {
  id: string;
  name: string;
  publisher: string | null;
  image_md_url: string | null;
  image_url: string | null;
  portrait_url: string | null;
  comicvine_status: string | null;
  wikidata_status: string;
  wikidata_enriched_at: string | null;
  wikidata_candidates: { qid: string; score: number }[] | null;
}

export function stageOf(h: {
  comicvine_status: string | null;
  wikidata_status: string;
  wikidata_enriched_at: string | null;
}): BuildStage {
  if (h.comicvine_status === 'failed') return 'failed';
  if (h.comicvine_status !== 'done') return 'comicvine';
  if (h.wikidata_status === 'pending') return 'resolve';
  if (h.wikidata_status === 'ambiguous') return 'review';
  if (h.wikidata_status === 'unresolved') return 'unresolved';
  if (!h.wikidata_enriched_at) return 'appearances';
  return 'done';
}

/** Current build state of the working set, derived from the hero status columns. */
export async function getBuildHeroes(ids: string[]): Promise<BuildHero[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('heroes')
    .select(
      'id, name, publisher, image_md_url, image_url, portrait_url, comicvine_status, wikidata_status, wikidata_enriched_at, wikidata_candidates',
    )
    .in('id', ids);
  if (error || !data) return [];
  return (data as HeroRow[]).map((h) => ({
    id: h.id,
    name: h.name,
    image: h.portrait_url ?? h.image_md_url ?? h.image_url,
    stage: stageOf(h),
    publisher: h.publisher,
    candidates: h.wikidata_candidates ?? [],
  }));
}

async function invoke(fn: string, body: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
}

// One step for one hero. Each awaits the drain's completion for that hero.
export const stepComicvine = (id: string, name: string) =>
  invoke('get-comicvine-hero', { heroId: id, heroName: name });
export const stepResolve = (id: string) =>
  invoke('resolve-wikidata-batch', { heroId: id, triggeredBy: 'build' });
export const stepEnrich = (id: string) =>
  invoke('enrich-wikidata-batch', { heroId: id, triggeredBy: 'build' });

/** The next heroes that still need a build step, highest-priority first (capped).
 *  Powers the global "Build next N" button (the Add panel builds your added set).
 *  Backed by the get_pending_build_ids RPC, which applies the same actionable-stage
 *  logic as stageOf/ACTIONABLE in one indexed query — so it always fills the batch.
 *  (The old client-side approach scanned only the top heroes by issue_count, which
 *  are mostly already enriched, so it returned far fewer than asked — e.g. 1 of 25.) */
export async function getPendingBuildIds(limit = 25): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_pending_build_ids', { p_limit: limit });
  if (error || !data) return [];
  return data as string[];
}

/** ComicVine API units used in the last hour (its ~200/hr cap is the gate). */
export async function comicvineUsageLastHour(): Promise<number> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase
    .from('api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('api', 'comicvine')
    .gte('created_at', since);
  return count ?? 0;
}
