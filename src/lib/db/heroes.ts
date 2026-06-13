import { supabase } from '../supabase';
import type { Tables } from '../../types/database.generated';
import type { CharacterData, MovieAppearance, StatsSource } from '../../types';
import type { CategoryFilters, FacetCounts } from './categoryFilters';
import { rowToMember, type FamilyRow } from '../family/rowToMember';
import type { FamilyMember } from '../family/types';

export type Hero = Tables<'heroes'>;
export type HeroCategory = 'popular' | 'villain' | 'xmen';
export type PublisherFilter = 'All' | 'Marvel' | 'DC' | 'Other';

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
export type HeroSearchResult = Pick<
  Hero,
  | 'id'
  | 'name'
  | 'publisher'
  | 'alignment'
  | 'image_md_url'
  | 'image_url'
  | 'portrait_url'
  | 'full_name'
  | 'aliases'
>;

export interface HeroesByCategory {
  popular: Hero[];
  villain: Hero[];
  xmen: Hero[];
}

export async function getHeroesByCategory(): Promise<HeroesByCategory> {
  const { data, error } = await supabase.from('heroes').select('*').order('name');

  if (error) throw error;

  return {
    popular: data.filter((h) => h.category === 'popular'),
    villain: data.filter((h) => h.category === 'villain'),
    xmen: data.filter((h) => h.category === 'xmen'),
  };
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

export type AlignmentFilter = 'All' | 'Heroes' | 'Villains' | 'Anti';

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
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")')
    .order('issue_count', { ascending: false, nullsFirst: false })
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

// Minimal column sets for home page queries — cards only need image + name.
// Spotlight panel also shows publisher and summary.
const HOME_ROW = 'id, name, image_url, portrait_url';
const HOME_SPOT =
  'id, name, image_url, portrait_url, publisher, summary, full_name, alignment, first_appearance, intelligence, strength, speed, durability, power, combat';

export async function getPopularHeroes(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_SPOT)
    .eq('category', 'popular')
    .order('name')
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getXMen(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .or('group_affiliation.ilike.%x-men%,group_affiliation.ilike.%xmen%')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getAntiHeroes(limit = 20): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .ilike('alignment', '%neutral%')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getVillains(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .eq('alignment', 'bad')
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getIconicHeroes(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_SPOT)
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

// Spotlight billboard rules: a portrait is mandatory (it fills a half-screen
// stage — a square image_url cropped to that height looks broken), and the hero
// must be enriched (summary present) so the detail screen they tap into is full.
// We mix mostly marquee names (≥2 movies) with ~1-in-5 lesser-known "discovery"
// heroes, sampling fresh from each tier on every load so the lineup rotates.
const SPOT_PUBLISHER_EXCLUDE = '("Non-Fictional","In the Public Domain","Company-Licensed")';
const SPOT_FAMOUS_POOL = 20; // deep enough to vary, shallow enough to stay A-list
const SPOT_DISCOVERY_POOL = 50;
const SPOT_MIN_POWERSTATS = 200; // floor that filters out civilian sidekicks

function sampleN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export async function getSpotlightHeroes(limit = 5): Promise<Hero[]> {
  const discoveryCount = Math.max(1, Math.round(limit * 0.2));
  const famousCount = Math.max(0, limit - discoveryCount);

  // The powerstats floor keeps the billboard to actual heroes/villains: it drops
  // famous-by-association civilians (Alfred, Lois Lane, Jimmy Olsen, Goofy…) who
  // inherit their franchise's film count, while still keeping low-stat but real
  // heroes like Hawkeye and Ant-Man.
  const famousQuery = supabase
    .from('heroes')
    .select(HOME_SPOT)
    .not('portrait_url', 'is', null)
    .not('summary', 'is', null)
    .gte('movie_count', 2)
    .gte('powerstats_total', SPOT_MIN_POWERSTATS)
    .not('publisher', 'in', SPOT_PUBLISHER_EXCLUDE)
    .order('movie_count', { ascending: false, nullsFirst: false })
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(SPOT_FAMOUS_POOL);

  // Lesser-known but not obscure: no/few films, yet a real publication history.
  const discoveryQuery = supabase
    .from('heroes')
    .select(HOME_SPOT)
    .not('portrait_url', 'is', null)
    .not('summary', 'is', null)
    .or('movie_count.is.null,movie_count.lt.2')
    .gte('issue_count', 200)
    .gte('powerstats_total', SPOT_MIN_POWERSTATS)
    .not('publisher', 'in', SPOT_PUBLISHER_EXCLUDE)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(SPOT_DISCOVERY_POOL);

  const [famousRes, discoveryRes] = await Promise.all([famousQuery, discoveryQuery]);
  if (famousRes.error) throw new Error(famousRes.error.message);
  if (discoveryRes.error) throw new Error(discoveryRes.error.message);

  const famous = sampleN((famousRes.data ?? []) as unknown as Hero[], famousCount);
  const discovery = sampleN((discoveryRes.data ?? []) as unknown as Hero[], discoveryCount);

  // Shuffle the merged set so the discovery hero isn't pinned to the last slot.
  return sampleN([...famous, ...discovery], limit);
}

export async function getNewlyAddedCV(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .like('id', 'cv-%')
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

// ── First-appearance covers (gallery wall) ────────────────────────────────────

export interface FirstAppearanceCover {
  id: string;
  name: string;
  first_appearance: string | null;
  first_issue_image_url: string | null;
}

export async function getFirstAppearanceCovers(limit = 14): Promise<FirstAppearanceCover[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, first_appearance, first_issue_image_url')
    .not('first_issue_image_url', 'is', null)
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit * 2);
  if (error) {
    console.warn('[getFirstAppearanceCovers] error:', error.message);
    return [];
  }
  // Drop blank/placeholder covers and cap at the requested count.
  return ((data ?? []) as FirstAppearanceCover[])
    .filter(
      (c) =>
        !!c.first_issue_image_url &&
        c.first_issue_image_url.startsWith('http') &&
        !c.first_issue_image_url.includes('blank'),
    )
    .slice(0, limit);
}

// ── Era timeline (heroes bucketed by comic age) ───────────────────────────────

export interface EraHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  year: number;
}

export interface EraBucket {
  era: string;
  heroes: EraHero[];
}

// Fixed display order of the comic ages.
const ERA_ORDER = ['Golden Age', 'Silver Age', 'Bronze Age', 'Modern Age'];

export async function getEraTimeline(perEra = 7): Promise<EraBucket[]> {
  const { data, error } = await supabase.rpc('get_era_timeline', { per_era: perEra });
  if (error) {
    console.warn('[getEraTimeline] error:', error.message);
    return [];
  }
  const rows = (data ?? []) as {
    era: string;
    hero_id: string;
    name: string;
    image_url: string | null;
    portrait_url: string | null;
    year: number;
  }[];
  const byEra = new Map<string, EraHero[]>();
  for (const r of rows) {
    const list = byEra.get(r.era) ?? [];
    list.push({
      id: r.hero_id,
      name: r.name,
      image_url: r.image_url,
      portrait_url: r.portrait_url,
      year: r.year,
    });
    byEra.set(r.era, list);
  }
  return ERA_ORDER.filter((era) => byEra.has(era)).map((era) => ({
    era,
    heroes: byEra.get(era)!,
  }));
}

export async function getHeroesByPublisher(
  publisher: string,
  limit = 25,
): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_ROW)
    .ilike('publisher', `%${publisher}%`)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export async function getHeroesByStatRanking(
  stat: 'strength' | 'intelligence',
  limit = 20,
): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(`${HOME_ROW}, intelligence, strength, speed`)
    .not(stat, 'is', null)
    .order(stat, { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
}

export type CategorySlug =
  | 'popular'
  | 'villain'
  | 'xmen'
  | 'anti-heroes'
  | 'marvel'
  | 'dc'
  | 'strongest'
  | 'most-intelligent'
  | 'most-iconic';

export type SortOption = 'popular' | 'az' | 'power';
export type CategoryPublisher = 'all' | 'marvel' | 'dc';

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  popular: 'Popular',
  villain: 'Villains',
  xmen: 'X-Men',
  'anti-heroes': 'Anti-Heroes',
  marvel: 'Marvel Universe',
  dc: 'DC Universe',
  strongest: 'Strongest Heroes',
  'most-intelligent': 'Most Intelligent',
  'most-iconic': 'Most Iconic',
};

export const CATEGORY_DESCRIPTIONS: Record<CategorySlug, string> = {
  popular: 'The most beloved heroes across all of comics',
  villain: 'The forces of darkness across Marvel, DC, and beyond',
  xmen: "Charles Xavier's School for Gifted Youngsters",
  'anti-heroes': 'Characters who walk the line between good and evil',
  marvel: 'From the pages of Marvel Comics',
  dc: 'Heroes and villains of the DC Universe',
  strongest: 'Ranked by raw physical power',
  'most-intelligent': 'The greatest minds in all of comics',
  'most-iconic': 'Ranked by total comic book appearances',
};

/** Fetches all rows from a query that may exceed Supabase's 1000-row default cap. */
async function fetchAllPages(
  buildQuery: () => {
    range(
      from: number,
      to: number,
    ): PromiseLike<{ data: Hero[] | null; error: { message: string } | null }>;
  },
): Promise<Hero[]> {
  const PAGE = 1000;
  const all: Hero[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function getAllHeroesBySlug(slug: CategorySlug): Promise<Hero[]> {
  switch (slug) {
    case 'popular':
      return fetchAllPages(() =>
        supabase.from('heroes').select('*').eq('category', 'popular').order('name'),
      );
    case 'villain':
      return fetchAllPages(() =>
        supabase
          .from('heroes')
          .select('*')
          .eq('alignment', 'bad')
          .not('publisher', 'in', '("Non-Fictional","In the Public Domain")')
          .order('name'),
      );
    case 'xmen':
      return fetchAllPages(() =>
        supabase
          .from('heroes')
          .select('*')
          .or('group_affiliation.ilike.%x-men%,group_affiliation.ilike.%xmen%')
          .order('name'),
      );
    case 'anti-heroes':
      return fetchAllPages(() =>
        supabase.from('heroes').select('*').ilike('alignment', '%neutral%').order('name'),
      );
    case 'marvel':
      return fetchAllPages(() =>
        supabase.from('heroes').select('*').ilike('publisher', '%marvel%').order('name'),
      );
    case 'dc':
      return fetchAllPages(() =>
        supabase.from('heroes').select('*').ilike('publisher', '%dc%').order('name'),
      );
    case 'strongest':
      return fetchAllPages(() =>
        supabase
          .from('heroes')
          .select('*')
          .not('strength', 'is', null)
          .order('strength', { ascending: false }),
      );
    case 'most-intelligent':
      return fetchAllPages(() =>
        supabase
          .from('heroes')
          .select('*')
          .not('intelligence', 'is', null)
          .order('intelligence', { ascending: false }),
      );
    case 'most-iconic':
      return fetchAllPages(() =>
        supabase
          .from('heroes')
          .select('*')
          .not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")')
          .order('issue_count', { ascending: false, nullsFirst: false }),
      );
  }
}

// Columns the category grid + featured banner actually render (native and web).
// Excludes heavy text/JSON columns (summary, description, movies, enemies,
// friends, creators, first_issue_data, powers...) which the list never shows.
const CATEGORY_LIST_COLUMNS =
  'id, name, image_url, image_md_url, portrait_url, publisher, issue_count';

export async function getCategoryPage(
  slug: CategorySlug,
  options: { page: number; pageSize?: number; withCount?: boolean } & CategoryFilters,
): Promise<{ heroes: Hero[]; total: number }> {
  const {
    page,
    pageSize = 48,
    withCount = true,
    sort,
    publisher,
    alignment,
    gender,
    hasStats,
    search,
  } = options;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('heroes')
    .select(CATEGORY_LIST_COLUMNS, withCount ? { count: 'exact' } : undefined);

  switch (slug) {
    case 'popular':
      q = q.eq('category', 'popular');
      break;
    case 'villain':
      q = q
        .eq('alignment', 'bad')
        .not('publisher', 'in', '("Non-Fictional","In the Public Domain")');
      break;
    case 'xmen':
      q = q.or('group_affiliation.ilike.%x-men%,group_affiliation.ilike.%xmen%');
      break;
    case 'anti-heroes':
      q = q.ilike('alignment', '%neutral%');
      break;
    case 'marvel':
      q = q.ilike('publisher', '%marvel%');
      break;
    case 'dc':
      q = q.ilike('publisher', '%dc%');
      break;
    case 'strongest':
      q = q.not('strength', 'is', null);
      break;
    case 'most-intelligent':
      q = q.not('intelligence', 'is', null);
      break;
    case 'most-iconic':
      q = q.not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")');
      break;
  }

  // Publisher facet
  if (publisher === 'marvel') q = q.ilike('publisher', '%marvel%');
  else if (publisher === 'dc') q = q.ilike('publisher', '%dc%');
  else if (publisher === 'other')
    q = q.not('publisher', 'ilike', '%marvel%').not('publisher', 'ilike', '%dc%');

  // Alignment facet
  if (alignment === 'good') q = q.eq('alignment', 'good');
  else if (alignment === 'bad') q = q.eq('alignment', 'bad');
  else if (alignment === 'neutral') q = q.ilike('alignment', '%neutral%');

  // Gender facet
  if (gender === 'male') q = q.ilike('gender', 'male');
  else if (gender === 'female') q = q.ilike('gender', 'female');

  // Has-powerstats facet
  if (hasStats) q = q.gte('powerstats_total', 1);

  // Search
  if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,full_name.ilike.%${search.trim()}%`);

  // Sort
  if (sort === 'az') q = q.order('name');
  else if (sort === 'power')
    q = q.order('powerstats_total', { ascending: false, nullsFirst: false });
  else q = q.order('issue_count', { ascending: false, nullsFirst: false });

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  return { heroes: (data ?? []) as Hero[], total: count ?? 0 };
}

export async function getCategoryFacetCounts(
  slug: CategorySlug,
  f: CategoryFilters,
): Promise<FacetCounts> {
  const { data, error } = await supabase.rpc('category_facet_counts', {
    p_slug: slug,
    p_publisher: f.publisher,
    p_alignment: f.alignment,
    p_gender: f.gender,
    p_has_stats: f.hasStats,
    p_search: f.search.trim(),
  });
  if (error) throw new Error(error.message);
  return data as unknown as FacetCounts;
}

export type HeroPowerResult = Pick<
  Hero,
  'id' | 'name' | 'publisher' | 'image_url' | 'portrait_url'
>;

export type RelatedHeroCard = Pick<
  Hero,
  'id' | 'name' | 'image_url' | 'image_md_url' | 'portrait_url' | 'publisher' | 'alignment'
>;

/**
 * Resolve a batch of character names (e.g. ComicVine enemy/ally names) to hero
 * rows so they can render as navigable cards. Exact name match in a single
 * query — names with no matching row simply don't come back, and the caller
 * falls those back to plain text chips so no information is lost.
 *
 * Ordered by popularity (issue_count) because the source lists arrive
 * alphabetically: without this the UI would lead with obscure "A" characters
 * instead of the recognisable foes/allies people expect to see first.
 */
/** A hero-to-hero association grouping. Extend in lockstep with the DB `kind`s. */
export type RelationKind = 'enemy' | 'ally' | 'teammate';

/**
 * Resolved related heroes for a grouping, straight from the normalized
 * `hero_relationships` graph (built once upstream by rebuild_hero_relationships).
 * Ranked by the related hero's popularity; `sameUniverse` keeps the subject's own
 * publisher (plus any curated cross-publisher edges). One call serves enemies,
 * allies, teammates — and any future grouping — with no client-side resolution.
 */
export async function getRelatedHeroes(
  heroId: string,
  kind: RelationKind,
  opts?: { limit?: number; sameUniverse?: boolean },
): Promise<RelatedHeroCard[]> {
  if (!heroId) return [];
  const { data, error } = await supabase.rpc('get_related_heroes', {
    p_hero_id: heroId,
    p_kind: kind,
    p_limit: opts?.limit ?? 60,
    p_same_universe: opts?.sameUniverse ?? false,
  });
  if (error) {
    console.warn('[getRelatedHeroes] error:', error.message);
    return [];
  }
  return (data ?? []) as RelatedHeroCard[];
}

export interface FearedVillain {
  id: string;
  name: string;
  image_url: string | null;
  image_md_url: string | null;
  portrait_url: string | null;
  publisher: string | null;
  alignment: string | null;
  fearedBy: number;
}

/** Reverse-lookup leaderboard — villains ranked by how many heroes count them as
 *  an enemy (enemy in-degree). The explore "Most Feared" / Hall of Infamy row. */
export async function getMostFeared(limit = 12): Promise<FearedVillain[]> {
  const { data, error } = await supabase.rpc('get_most_feared', { p_limit: limit });
  if (error) {
    console.warn('[getMostFeared] error:', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    image_url: r.image_url,
    image_md_url: r.image_md_url,
    portrait_url: r.portrait_url,
    publisher: r.publisher,
    alignment: r.alignment,
    fearedBy: r.feared_by,
  }));
}

/** Family members (relatives) that have their own character page — the picker's
 *  "Bloodline" row. Ranked by popularity; empty when the hero has no linked kin. */
export async function getFamilyOpponents(heroId: string, limit = 24): Promise<RelatedHeroCard[]> {
  if (!heroId) return [];
  const { data, error } = await supabase.rpc('get_family_opponents', {
    p_hero_id: heroId,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getFamilyOpponents] error:', error.message);
    return [];
  }
  return (data ?? []) as RelatedHeroCard[];
}

export interface HeroRelationship {
  isEnemy: boolean;
  isAlly: boolean;
  isTeammate: boolean;
  isCurated: boolean;
  crossUniverse: boolean;
  familyRelation: string | null;
}

/** The relationship between two specific heroes, across both graphs (associations
 *  + family). Null when they have no recorded connection. */
export async function getRelationship(a: string, b: string): Promise<HeroRelationship | null> {
  if (!a || !b) return null;
  const { data, error } = await supabase.rpc('get_relationship', { p_a: a, p_b: b });
  if (error) {
    console.warn('[getRelationship] error:', error.message);
    return null;
  }
  const row = data?.[0];
  if (!row) return null;
  return {
    isEnemy: row.is_enemy,
    isAlly: row.is_ally,
    isTeammate: row.is_teammate,
    isCurated: row.is_curated,
    crossUniverse: row.cross_universe,
    familyRelation: row.family_relation ?? null,
  };
}

export type RelationshipTone = 'rivalry' | 'family' | 'team' | 'ally' | 'dream';

/** A punchy headline for a matchup's relationship — most dramatic relation wins.
 *  Null when the two heroes have no recorded connection. */
export function relationshipBadge(
  r: HeroRelationship | null | undefined,
): { label: string; tone: RelationshipTone } | null {
  if (!r) return null;
  const fam = r.familyRelation;
  if (fam === 'clone') return { label: 'Clone Clash', tone: 'family' };
  if (fam === 'sibling') return { label: 'Sibling Rivalry', tone: 'family' };
  if (fam === 'spouse') return { label: "Lovers' Quarrel", tone: 'family' };
  if (fam) return { label: 'Family Feud', tone: 'family' };
  if (r.isEnemy && r.crossUniverse) return { label: 'Dream Match', tone: 'dream' };
  if (r.isCurated) return { label: 'Classic Rivalry', tone: 'rivalry' };
  if (r.isEnemy) return { label: 'Sworn Enemies', tone: 'rivalry' };
  if (r.isTeammate) return { label: 'Teammates', tone: 'team' };
  if (r.isAlly) return { label: 'Allies', tone: 'ally' };
  return null;
}

export interface Rivalry {
  a: { id: string; name: string; image_url: string | null; portrait_url: string | null };
  b: { id: string; name: string; image_url: string | null; portrait_url: string | null };
  crossUniverse: boolean;
}

/** Iconic rivalries (curated marquee matchups), ranked by combined popularity —
 *  the explore "Greatest Rivalries" carousel + the rivalries page. */
export async function getTopRivalries(limit = 12): Promise<Rivalry[]> {
  const { data, error } = await supabase.rpc('get_top_rivalries', { p_limit: limit });
  if (error) {
    console.warn('[getTopRivalries] error:', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    a: { id: r.a_id, name: r.a_name, image_url: r.a_image_url, portrait_url: r.a_portrait_url },
    b: { id: r.b_id, name: r.b_name, image_url: r.b_image_url, portrait_url: r.b_portrait_url },
    crossUniverse: r.cross_universe,
  }));
}

export async function getHeroesByNames(names: string[]): Promise<RelatedHeroCard[]> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, image_url, image_md_url, portrait_url, publisher, alignment')
    .in('name', unique)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) {
    console.warn('[getHeroesByNames] error:', error.message);
    return [];
  }
  return (data ?? []) as RelatedHeroCard[];
}

export async function getHeroesByPowerRange(
  min: number,
  max: number,
  excludeId: string,
  limit = 8,
): Promise<HeroPowerResult[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, publisher, image_url, portrait_url')
    .gte('powerstats_total', min)
    .lte('powerstats_total', max)
    .neq('id', excludeId)
    .order('powerstats_total')
    .limit(limit);

  if (error) {
    console.warn('[getHeroesByPowerRange] error:', error.message);
    return [];
  }
  return (data ?? []) as HeroPowerResult[];
}

/**
 * Percentile rank of a hero's total powerstats among all ranked heroes.
 * Returns e.g. 87 → "Stronger than 87% of heroes". Heroes with no stats
 * (powerstats_total null/0) are excluded from both numerator and denominator,
 * so the figure reflects only characters that actually have a power profile.
 */
export async function getPowerPercentile(total: number): Promise<number | null> {
  if (!total || total <= 0) return null;
  const ranked = supabase
    .from('heroes')
    .select('*', { count: 'exact', head: true })
    .gt('powerstats_total', 0);
  const below = supabase
    .from('heroes')
    .select('*', { count: 'exact', head: true })
    .gt('powerstats_total', 0)
    .lt('powerstats_total', total);
  const [rankedRes, belowRes] = await Promise.all([ranked, below]);
  if (rankedRes.error || belowRes.error || !rankedRes.count) return null;
  return Math.round(((belowRes.count ?? 0) / rankedRes.count) * 100);
}

// ── Stat leaderboard query ────────────────────────────────────────────────────

export async function getTopHeroByStat(
  stat: 'strength' | 'intelligence' | 'speed',
): Promise<Pick<Hero, 'id' | 'name' | 'strength' | 'intelligence' | 'speed'> | null> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id,name,strength,intelligence,speed')
    .not(stat, 'is', null)
    .order(stat, { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data ?? null;
}

// ── Publisher breakdown counts ────────────────────────────────────────────────

export interface PublisherCounts {
  marvel: number;
  dc: number;
  other: number;
}

export async function getPublisherCounts(): Promise<PublisherCounts> {
  const [marvelRes, dcRes, totalRes] = await Promise.all([
    supabase
      .from('heroes')
      .select('*', { count: 'exact', head: true })
      .ilike('publisher', '%marvel%'),
    supabase.from('heroes').select('*', { count: 'exact', head: true }).ilike('publisher', '%dc%'),
    supabase.from('heroes').select('*', { count: 'exact', head: true }),
  ]);
  const marvel = marvelRes.count ?? 0;
  const dc = dcRes.count ?? 0;
  const total = totalRes.count ?? 0;
  return { marvel, dc, other: total - marvel - dc };
}

export function heroRowToCharacterData(hero: Hero): CharacterData {
  const stat = (v: number | null) => String(v ?? 0);
  return {
    stats: {
      id: hero.id,
      name: hero.name,
      powerstats: {
        intelligence: stat(hero.intelligence),
        strength: stat(hero.strength),
        speed: stat(hero.speed),
        durability: stat(hero.durability),
        power: stat(hero.power),
        combat: stat(hero.combat),
      },
      biography: {
        'full-name': hero.full_name ?? '',
        'alter-egos': hero.alter_egos ?? '',
        aliases: hero.aliases ?? [],
        'place-of-birth': hero.place_of_birth ?? '',
        'first-appearance': hero.first_appearance ?? '',
        publisher: hero.publisher ?? '',
        alignment: hero.alignment ?? '',
      },
      appearance: {
        gender: hero.gender ?? '',
        race: hero.race ?? '',
        height: [hero.height_imperial ?? '', hero.height_metric ?? ''],
        weight: [hero.weight_imperial ?? '', hero.weight_metric ?? ''],
        'eye-color': hero.eye_color ?? '',
        'hair-color': hero.hair_color ?? '',
      },
      work: {
        occupation: hero.occupation ?? '',
        base: hero.base ?? '',
      },
      connections: {
        'group-affiliation': hero.group_affiliation ?? '',
        relatives: hero.relatives ?? '',
      },
      image: {
        url: hero.portrait_url ?? hero.image_url ?? '',
        portraitUrl: hero.portrait_url ?? null,
      },
    },
    details: {
      summary: hero.summary ?? null,
      publisher: hero.publisher ?? null,
      firstIssueId: hero.first_issue_id ?? null,
      firstIssueData:
        (hero.first_issue_data as unknown as import('../../types').FirstIssue | null) ?? null,
      powers: hero.powers ?? null,
      description: hero.description ?? null,
      origin: hero.origin ?? null,
      issueCount: hero.issue_count ?? null,
      creators: hero.creators ?? null,
      enemies: hero.enemies ?? null,
      friends: hero.friends ?? null,
      movies: hero.movies ? (hero.movies as unknown as MovieAppearance[]) : null,
      movieCount: hero.movie_count ?? null,
      teams: hero.teams ?? null,
    },
    firstIssue: hero.first_issue_data
      ? (hero.first_issue_data as unknown as import('../../types').FirstIssue)
      : hero.first_issue_image_url
        ? {
            id: hero.first_issue_id ?? '',
            imageUrl: hero.first_issue_image_url,
            name: null,
            coverDate: null,
            storeDate: null,
            issueNumber: null,
            deck: null,
            seriesName: null,
            personCredits: null,
            debutCharacters: null,
          }
        : null,
    statsSource: (hero.stats_source as StatsSource) ?? null,
  };
}

/**
 * Family members for a hero, ordered top generation → bottom, then source order.
 * Linked relatives (those with their own page) come back enriched with the
 * related hero's portrait, power, and alignment via the FK embed.
 */
export async function getHeroFamily(heroId: string): Promise<FamilyMember[]> {
  if (!heroId) return [];
  const { data, error } = await supabase
    .from('hero_relatives')
    .select(
      'id, name, alias, role, relation, tier, modifiers, status, position, ' +
        'tree_parent_id, branch_side, ' +
        'related:related_hero_id ( id, image_md_url, image_url, power, alignment )',
    )
    .eq('hero_id', heroId)
    .order('tier', { ascending: false })
    .order('position', { ascending: true });

  if (error) {
    console.warn('[getHeroFamily] error:', error.message);
    return [];
  }
  return (data ?? []).map((row) => rowToMember(row as unknown as FamilyRow));
}
