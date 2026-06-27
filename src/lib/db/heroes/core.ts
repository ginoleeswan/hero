import { supabase } from '../../supabase';
import type { Hero, HeroSearchResult, PublisherFilter, AlignmentFilter } from './types';

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, '');

/** Re-rank Supabase results by relevance: prefix > contains > full_name > alias */
export function rankResults(list: HeroSearchResult[], query: string): HeroSearchResult[] {
  if (!query.trim()) return list;
  const q = query.trim().toLowerCase();
  const qn = norm(q);
  return list
    .map((h) => {
      const nl = h.name.toLowerCase();
      const nn = norm(h.name);
      const fl = (h.full_name ?? '').toLowerCase();
      const an = (h.aliases ?? []).map(norm);
      let score: number;
      if (nl === q) score = 0;
      else if (nl.startsWith(q)) score = 1;
      else if (nn.startsWith(qn)) score = 2;
      else if (nl.includes(q)) score = 3;
      else if (nn.includes(qn)) score = 4;
      else if (fl.startsWith(q)) score = 5;
      else if (fl.includes(q)) score = 6;
      else if (an.some((a) => a.startsWith(qn))) score = 7;
      else score = 8;
      return { h, score };
    })
    .sort((a, b) => a.score - b.score)
    .map((s) => s.h);
}

export async function getHeroByComicvineId(cvId: string): Promise<Hero | null> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .eq('comicvine_id', cvId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.warn('[getHeroByComicvineId] Supabase error:', error.message);
  }
  return data ?? null;
}

export async function getHeroById(id: string): Promise<Hero | null> {
  const { data, error } = await supabase.from('heroes').select('*').eq('id', id).single();
  // PGRST116 = "no rows found" — hero not yet enriched, caller falls back to API.
  // Log any other error so DB outages are observable.
  if (error && error.code !== 'PGRST116') {
    console.warn('[getHeroById] Supabase error:', error.message);
  }
  return data ?? null;
}

/**
 * Resolve specific heroes by ID, preserving the requested order. Use this when
 * the heroes must come back regardless of popularity — e.g. curated rivals,
 * many of whom have a null `issue_count` and fall outside a ranked slice.
 */
export async function getHeroesByIds(ids: string[]): Promise<HeroSearchResult[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('heroes')
    .select(
      'id, name, publisher, alignment, image_md_url, image_url, portrait_url, full_name, aliases',
    )
    .in('id', ids);

  if (error) {
    console.warn('[getHeroesByIds] error:', error.message);
    return [];
  }
  const rank = new Map(ids.map((id, i) => [id, i]));
  return ((data ?? []) as HeroSearchResult[]).sort(
    (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0),
  );
}

/**
 * Pure publisher filter for already-fetched idle heroes (the server applies the
 * same predicate for live searches; this mirrors it client-side for the idle
 * grid so the scope bar can re-filter without a round-trip).
 */
export function filterHeroesByPublisher<T extends { publisher?: string | null }>(
  heroes: T[],
  filter: PublisherFilter,
): T[] {
  if (filter === 'All') return heroes;
  return heroes.filter((h) => {
    const pub = (h.publisher ?? '').toLowerCase();
    if (filter === 'Marvel') return pub.includes('marvel');
    if (filter === 'DC') return pub.includes('dc');
    return !pub.includes('marvel') && !pub.includes('dc');
  });
}

const ALIGNMENT_VALUE: Record<Exclude<AlignmentFilter, 'All'>, string> = {
  Heroes: 'good',
  Villains: 'bad',
  Anti: 'neutral',
};

/** Pure alignment filter (good/bad/neutral) for already-fetched heroes. */
export function filterHeroesByAlignment<T extends { alignment?: string | null }>(
  heroes: T[],
  filter: AlignmentFilter,
): T[] {
  if (filter === 'All') return heroes;
  const target = ALIGNMENT_VALUE[filter];
  return heroes.filter((h) => (h.alignment ?? '').toLowerCase() === target);
}

/**
 * Search / browse via the search_heroes RPC: empty query → top heroes for the
 * publisher (junk publishers excluded); a real query → alias-aware, typo-tolerant
 * ranked search. Single-page convenience wrapper (used by web + suggestions).
 */
export async function searchHeroes(
  query: string,
  publisher: PublisherFilter,
  limit = 100,
): Promise<HeroSearchResult[]> {
  const { data, error } = await supabase.rpc('search_heroes', {
    search_query: query.trim(),
    publisher_filter: publisher,
    alignment_filter: 'All',
    result_limit: limit,
    result_offset: 0,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as HeroSearchResult[];
}

/**
 * Paginated search/browse for the Search tab's infinite list. Alignment is
 * applied server-side so every page stays correctly filled.
 */
export async function searchHeroesPage(
  query: string,
  publisher: PublisherFilter,
  alignment: AlignmentFilter,
  page: number,
  pageSize: number,
): Promise<HeroSearchResult[]> {
  const { data, error } = await supabase.rpc('search_heroes', {
    search_query: query.trim(),
    publisher_filter: publisher,
    alignment_filter: alignment === 'All' ? 'All' : ALIGNMENT_VALUE[alignment],
    result_limit: pageSize,
    result_offset: page * pageSize,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as HeroSearchResult[];
}

export async function getSearchIdleHeroes(limit = 30): Promise<HeroSearchResult[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(
      'id, name, publisher, alignment, image_md_url, image_url, portrait_url, full_name, aliases',
    )
    // Also drop cartoon-mascot publishers: their characters are fame-100 (Mickey,
    // Bugs, Donald) but off-brand as "Trending" on a superhero app, so they'd
    // otherwise lead. Fame, not issue_count, surfaces the icons (Batman, Spider-Man…).
    .not(
      'publisher',
      'in',
      '("Non-Fictional","In the Public Domain","Company-Licensed","Disney","Looney Tunes","Hanna-Barbera","Cartoon Network","Nickelodeon")',
    )
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as HeroSearchResult[];
}

export async function getHeroCount(): Promise<number> {
  const { count, error } = await supabase
    .from('heroes')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}
