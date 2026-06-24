import { supabase } from '../../supabase';
import { DEFAULT_FILTERS, type CategoryFilters, type FacetCounts } from '../categoryFilters';
import type {
  Hero,
  CategorySlug,
  FirstAppearanceCover,
  EraHero,
  EraBucket,
  BrowseCover,
} from './types';

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

// Category slugs that resolve to a hero_tags media tag rather than a base
// publisher/alignment predicate. Keyed by slug → tag vocabulary slug.
export const CATEGORY_MEDIA_TAG: Partial<Record<CategorySlug, string>> = {
  anime: 'anime',
  'video-games': 'video-game',
  horror: 'horror-icon',
};

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  popular: 'Popular',
  villain: 'Villains',
  xmen: 'X-Men',
  'anti-heroes': 'Anti-Heroes',
  marvel: 'Marvel Universe',
  dc: 'DC Universe',
  image: 'Image Comics',
  'dark-horse': 'Dark Horse',
  strongest: 'Strongest Heroes',
  'most-intelligent': 'Most Intelligent',
  'most-iconic': 'Most Iconic',
  'franchise-icons': 'Beyond the Comics',
  anime: 'Anime Legends',
  'video-games': 'Video Game Heroes',
  horror: 'Horror Icons',
};

export const CATEGORY_DESCRIPTIONS: Record<CategorySlug, string> = {
  popular: 'The most beloved heroes across all of comics',
  villain: 'The forces of darkness across Marvel, DC, and beyond',
  xmen: "Charles Xavier's School for Gifted Youngsters",
  'anti-heroes': 'Characters who walk the line between good and evil',
  marvel: 'From the pages of Marvel Comics',
  dc: 'Heroes and villains of the DC Universe',
  image: 'Creator-owned heroes from Image Comics',
  'dark-horse': 'Heroes and villains from Dark Horse Comics',
  strongest: 'Ranked by raw physical power',
  'most-intelligent': 'The greatest minds in all of comics',
  'most-iconic': 'Ranked by total comic book appearances',
  'franchise-icons': 'Icons from famous shows, movies, games, and anime',
  anime: 'Heroes and villains from the biggest anime and manga',
  'video-games': 'Legends straight out of video-game history',
  horror: 'The slashers and monsters of horror cinema',
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
    case 'image':
      return fetchAllPages(() =>
        supabase.from('heroes').select('*').ilike('publisher', '%image%').order('name'),
      );
    case 'dark-horse':
      return fetchAllPages(() =>
        supabase.from('heroes').select('*').ilike('publisher', '%dark horse%').order('name'),
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
    case 'franchise-icons':
      return fetchAllPages(() =>
        supabase
          .from('heroes')
          .select('*')
          .not('franchise', 'is', null)
          .order('issue_count', { ascending: false, nullsFirst: false }),
      );
    case 'anime':
    case 'video-games':
    case 'horror': {
      const tag = CATEGORY_MEDIA_TAG[slug]!;
      return fetchAllPages(
        () =>
          supabase
            .from('heroes')
            .select('*, hero_tags!inner(tag)')
            .eq('hero_tags.tag', tag)
            .order('issue_count', { ascending: false, nullsFirst: false }) as unknown as ReturnType<
            Parameters<typeof fetchAllPages>[0]
          >,
      );
    }
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
    tags,
    search,
  } = options;
  // Media-themed category slugs (anime / video-games / horror) resolve to a
  // hero_tags tag; fold it into the tag list so the same inner-join path applies.
  const implicitTag = CATEGORY_MEDIA_TAG[slug];
  const tagList = [...(implicitTag ? [implicitTag] : []), ...(tags ?? [])];
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // Inner-join hero_tags only when filtering by tag, so the base query is unchanged.
  const selectCols = tagList.length
    ? `${CATEGORY_LIST_COLUMNS}, hero_tags!inner(tag)`
    : CATEGORY_LIST_COLUMNS;

  let q: any = supabase
    .from('heroes')
    .select(selectCols, withCount ? { count: 'exact' } : undefined);

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
    case 'image':
      q = q.ilike('publisher', '%image%');
      break;
    case 'dark-horse':
      q = q.ilike('publisher', '%dark horse%');
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
    case 'franchise-icons':
      q = q.not('franchise', 'is', null);
      break;
    // anime / video-games / horror: the implicit media tag (folded into tagList
    // above) is the filter — no base publisher/alignment predicate.
  }

  // Publisher facet (category pages only — meaningless inside a single universe)
  if (publisher === 'marvel') q = q.ilike('publisher', '%marvel%');
  else if (publisher === 'dc') q = q.ilike('publisher', '%dc%');
  else if (publisher === 'other')
    q = q.not('publisher', 'ilike', '%marvel%').not('publisher', 'ilike', '%dc%');

  q = applyListFacets(q, { alignment, gender, hasStats, tagList, search, sort });

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  return { heroes: (data ?? []) as Hero[], total: count ?? 0 };
}

// Shared facet/search/sort application for both category and universe browse
// lists, so the two paths can't drift. Publisher facet is intentionally NOT
// here — it's category-only (a universe page is already one publisher).
function applyListFacets(
  q: any,
  opts: {
    alignment: CategoryFilters['alignment'];
    gender: CategoryFilters['gender'];
    hasStats: boolean;
    tagList: string[];
    search: string;
    sort: CategoryFilters['sort'];
  },
): any {
  const { alignment, gender, hasStats, tagList, search, sort } = opts;
  if (alignment === 'good') q = q.eq('alignment', 'good');
  else if (alignment === 'bad') q = q.eq('alignment', 'bad');
  else if (alignment === 'neutral') q = q.ilike('alignment', '%neutral%');

  if (gender === 'male') q = q.ilike('gender', 'male');
  else if (gender === 'female') q = q.ilike('gender', 'female');

  if (hasStats) q = q.gte('powerstats_total', 1);

  for (const tag of tagList) q = q.eq('hero_tags.tag', tag);

  if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,full_name.ilike.%${search.trim()}%`);

  if (sort === 'az') q = q.order('name');
  else if (sort === 'power')
    q = q.order('powerstats_total', { ascending: false, nullsFirst: false });
  else q = q.order('issue_count', { ascending: false, nullsFirst: false });
  return q;
}

/**
 * Paged heroes for a single UNIVERSE (publisher/studio/franchise) browse page —
 * the universe equivalent of getCategoryPage. `term` is the ILIKE match for the
 * `publisher` column (a registry brand's query, or a raw universe name). Shares
 * applyListFacets so universe pages get the same sort/search/filter behaviour as
 * category pages, minus the publisher facet.
 */
export async function getUniversePage(
  term: string,
  options: { page: number; pageSize?: number; withCount?: boolean } & CategoryFilters,
): Promise<{ heroes: Hero[]; total: number }> {
  const { page, pageSize = 48, withCount = true, alignment, gender, hasStats, tags, search, sort } =
    options;
  const tagList = tags ?? [];
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const selectCols = tagList.length
    ? `${CATEGORY_LIST_COLUMNS}, hero_tags!inner(tag)`
    : CATEGORY_LIST_COLUMNS;

  let q: any = supabase
    .from('heroes')
    .select(selectCols, withCount ? { count: 'exact' } : undefined)
    .ilike('publisher', `%${term}%`);

  q = applyListFacets(q, { alignment, gender, hasStats, tagList, search, sort });

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  return { heroes: (data ?? []) as Hero[], total: count ?? 0 };
}

/**
 * One representative (most-popular) hero per browse category, for the image-backed
 * category tiles on the home screen. Fires a light single-row query per slug in
 * parallel; missing/empty categories simply don't get a cover (the tile falls
 * back to a solid colour).
 */
export async function getBrowseCovers(slugs: CategorySlug[]): Promise<Record<string, BrowseCover>> {
  // Fetch several candidates per category in parallel, then greedily assign a
  // *distinct* representative hero to each pod in slug order. The same
  // most-popular hero otherwise tops multiple categories (Batman leads DC,
  // Strongest and Smartest), repeating the identical portrait across tiles and
  // making the browse grid look broken.
  const candidateLists = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const { heroes } = await getCategoryPage(slug, {
          ...DEFAULT_FILTERS,
          page: 0,
          pageSize: 6,
          withCount: false,
          sort: 'popular',
        });
        return [slug, heroes] as const;
      } catch {
        return [slug, [] as Hero[]] as const;
      }
    }),
  );
  const used = new Set<string>();
  const out: Record<string, BrowseCover> = {};
  for (const [slug, heroes] of candidateLists) {
    const pick = heroes.find((h) => !used.has(String(h.id))) ?? heroes[0];
    if (!pick) continue;
    used.add(String(pick.id));
    out[slug] = {
      name: pick.name,
      image_url: pick.image_url,
      image_md_url: pick.image_md_url,
      portrait_url: pick.portrait_url,
    };
  }
  return out;
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
