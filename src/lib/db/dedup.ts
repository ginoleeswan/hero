// Catalogue de-duplication: surface same-name heroes that include an unlinked
// row (the realistic duplicate case) and merge confirmed duplicates into one.
import { supabase } from '../supabase';

export interface DupHero {
  heroId: string;
  name: string;
  publisher: string | null;
  comicvineId: string | null;
  superheroApiId: string | null;
  issueCount: number | null;
  imageUrl: string | null;
  comicvineStatus: string | null;
  wikidataQid: string | null;
}

export interface DupGroup {
  name: string;
  heroes: DupHero[];
}

interface DupRow {
  name: string;
  hero_id: string;
  publisher: string | null;
  comicvine_id: string | null;
  superhero_api_id: string | null;
  issue_count: number | null;
  image_url: string | null;
  comicvine_status: string | null;
  wikidata_qid: string | null;
}

/** Candidate duplicate groups (same normalised name, ≥1 unlinked row), grouped. */
export async function listDuplicateGroups(limit = 60): Promise<DupGroup[]> {
  const { data, error } = await supabase.rpc('find_duplicate_heroes', { p_limit: limit });
  if (error || !data) return [];
  const byName = new Map<string, DupHero[]>();
  for (const r of data as DupRow[]) {
    const key = r.name.toLowerCase().trim();
    const arr = byName.get(key) ?? [];
    arr.push({
      heroId: r.hero_id,
      name: r.name,
      publisher: r.publisher,
      comicvineId: r.comicvine_id,
      superheroApiId: r.superhero_api_id,
      issueCount: r.issue_count,
      imageUrl: r.image_url,
      comicvineStatus: r.comicvine_status,
      wikidataQid: r.wikidata_qid,
    });
    byName.set(key, arr);
  }
  return [...byName.values()]
    .filter((heroes) => heroes.length > 1)
    .map((heroes) => ({ name: heroes[0].name, heroes }));
}

/** Merge one hero (loser) into another (winner): repoints data + deletes loser. */
export async function mergeHeroes(loserId: string, winnerId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_merge_heroes', {
    p_loser: loserId,
    p_winner: winnerId,
  });
  if (error) throw error;
}
