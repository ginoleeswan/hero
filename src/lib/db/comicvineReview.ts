import { supabase } from '../supabase';

// Data layer for the admin ComicVine review queue (issue #93). Heroes flagged
// `comicvine_status='needs_review'` by the collision gate (see
// supabase/functions/_shared/comicvineMatch.ts) are resolved here: accept a
// live cv-search candidate (or a manual id) → re-queue for enrichment by the
// right id, or mark unmatched. Writes go through admin-gated SECURITY DEFINER
// RPCs (heroes has no client write grant).

export interface ComicvineReviewHero {
  id: string;
  name: string;
  publisher: string | null;
  imageUrl: string | null;
}

/** Heroes awaiting a human ComicVine decision, most-published first. */
export async function listComicvineNeedsReview(limit = 25): Promise<ComicvineReviewHero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, publisher, image_md_url, image_url')
    .eq('comicvine_status', 'needs_review')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return (
    data as {
      id: string;
      name: string;
      publisher: string | null;
      image_md_url: string | null;
      image_url: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    publisher: r.publisher,
    imageUrl: r.image_md_url ?? r.image_url,
  }));
}

/** Total needs_review count (drives the LoadMore + the sub-tab badge). */
export async function countComicvineNeedsReview(): Promise<number> {
  const { count, error } = await supabase
    .from('heroes')
    .select('id', { count: 'exact', head: true })
    .eq('comicvine_status', 'needs_review');
  if (error) return 0;
  return count ?? 0;
}

/**
 * Accept a ComicVine id for a hero (a picked candidate or a manual entry):
 * points the row at it and re-queues it so the drain re-enriches by the right
 * id, overwriting the collision's bad data.
 */
export async function acceptComicvineMatch(heroId: string, comicvineId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_comicvine_match', {
    p_hero_id: heroId,
    p_comicvine_id: comicvineId,
  });
  if (error) throw error;
}

/** Terminal: ComicVine has no correct match for this hero. */
export async function markComicvineUnmatched(heroId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_mark_comicvine_unmatched', { p_hero_id: heroId });
  if (error) throw error;
}
