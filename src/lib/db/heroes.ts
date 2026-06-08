import { supabase } from '../supabase';
import type { Tables } from '../../types/database.generated';
import type { CharacterData, MovieAppearance, StatsSource } from '../../types';
import type { CategoryFilters, FacetCounts } from './categoryFilters';

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
const HOME_SPOT = 'id, name, image_url, portrait_url, publisher, summary';

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

export async function getSpotlightHeroes(limit = 10): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select(HOME_SPOT)
    .not('portrait_url', 'is', null)
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Hero[];
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

export async function getHeroesByPublisher(
  publisher: 'marvel' | 'dc',
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
    .select(HOME_ROW)
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
 */
export async function getHeroesByNames(names: string[]): Promise<RelatedHeroCard[]> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, image_url, image_md_url, portrait_url, publisher, alignment')
    .in('name', unique)
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
