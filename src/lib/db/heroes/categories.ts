import { supabase } from '../../supabase';
import { type CategoryFilters, type FacetCounts } from '../categoryFilters';
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
  'most-iconic': 'The most recognizable characters across comics and screen',
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
        supabase
          .from('heroes')
          .select('*')
          .eq('category', 'popular')
          .order('fame_score', { ascending: false, nullsFirst: false }),
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
          .order('fame_score', { ascending: false, nullsFirst: false }),
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
  'id, name, image_url, image_md_url, portrait_url, portrait_blurhash, publisher, issue_count';

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
    .select(selectCols, withCount ? { count: 'estimated' } : undefined);

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
  else q = q.order('fame_score', { ascending: false, nullsFirst: false });
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
  const {
    page,
    pageSize = 48,
    withCount = true,
    alignment,
    gender,
    hasStats,
    tags,
    search,
    sort,
  } = options;
  const tagList = tags ?? [];
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const selectCols = tagList.length
    ? `${CATEGORY_LIST_COLUMNS}, hero_tags!inner(tag)`
    : CATEGORY_LIST_COLUMNS;

  let q: any = supabase
    .from('heroes')
    .select(selectCols, withCount ? { count: 'estimated' } : undefined)
    .ilike('publisher', `%${term}%`);

  q = applyListFacets(q, { alignment, gender, hasStats, tagList, search, sort });

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  return { heroes: (data ?? []) as Hero[], total: count ?? 0 };
}

/**
 * Infinite, faceted list for a FRANCHISE browse page — franchise sibling of
 * getUniversePage. Franchise is a clean tag (exact value), so it matches with
 * `.eq()` rather than the publisher ILIKE. `term` is the franchise display name.
 */
export async function getFranchisePage(
  term: string,
  options: { page: number; pageSize?: number; withCount?: boolean } & CategoryFilters,
): Promise<{ heroes: Hero[]; total: number }> {
  const {
    page,
    pageSize = 48,
    withCount = true,
    alignment,
    gender,
    hasStats,
    tags,
    search,
    sort,
  } = options;
  const tagList = tags ?? [];
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const selectCols = tagList.length
    ? `${CATEGORY_LIST_COLUMNS}, hero_tags!inner(tag)`
    : CATEGORY_LIST_COLUMNS;

  let q: any = supabase
    .from('heroes')
    .select(selectCols, withCount ? { count: 'estimated' } : undefined)
    .eq('franchise', term);

  q = applyListFacets(q, { alignment, gender, hasStats, tagList, search, sort });

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  return { heroes: (data ?? []) as Hero[], total: count ?? 0 };
}

/** One portrait in the universe-banner montage: the bits the header actually needs. */
export interface MontageHero {
  id: string;
  name: string;
  image_url: string | null;
  image_md_url: string | null;
  portrait_url: string | null;
  portrait_blurhash: string | null;
}

// Session cache so re-visiting a universe paints the montage instantly (no second
// round-trip). Keyed on the ILIKE term.
const montageCache = new Map<string, MontageHero[]>();

/**
 * Top heroes of a universe for the header montage — a tiny, filter-independent
 * query (a handful of columns, ordered by fame) that runs the moment the slug is
 * known, so the banner portraits start loading without waiting on the full,
 * filterable 48-row grid page. Includes `portrait_blurhash` so each tile can show
 * an instant blurred placeholder. Cached per term for the session.
 */
export async function getUniverseMontage(term: string, limit = 24): Promise<MontageHero[]> {
  const cached = montageCache.get(term);
  if (cached) return cached;
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, image_url, image_md_url, portrait_url, portrait_blurhash')
    .ilike('publisher', `%${term}%`)
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MontageHero[];
  montageCache.set(term, rows);
  return rows;
}

// Franchise montage cache, keyed on the exact franchise value.
const franchiseMontageCache = new Map<string, MontageHero[]>();

/** Franchise sibling of getUniverseMontage — top heroes of a franchise for the
 *  header montage, matched exactly on `heroes.franchise`. Cached per franchise. */
export async function getFranchiseMontage(term: string, limit = 24): Promise<MontageHero[]> {
  const cached = franchiseMontageCache.get(term);
  if (cached) return cached;
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, image_url, image_md_url, portrait_url, portrait_blurhash')
    .eq('franchise', term)
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as MontageHero[];
  franchiseMontageCache.set(term, rows);
  return rows;
}

// Session cache so re-visiting a category paints the montage instantly.
const categoryMontageCache = new Map<CategorySlug, MontageHero[]>();

/**
 * Top heroes of a category for the editorial header montage — the category
 * counterpart to getUniverseMontage. Reuses getCategoryPage (so every slug's
 * predicate comes for free) with NO facet filters and fame ordering, so the
 * montage is the category's most recognizable faces, stable regardless of the
 * grid's current filters. Includes `portrait_blurhash` for an instant LQIP.
 * Cached per slug for the session.
 */
export async function getCategoryMontage(slug: CategorySlug, limit = 24): Promise<MontageHero[]> {
  const cached = categoryMontageCache.get(slug);
  if (cached) return cached;
  const { heroes } = await getCategoryPage(slug, {
    page: 0,
    pageSize: limit,
    withCount: false,
    publisher: 'all',
    alignment: 'any',
    gender: 'any',
    hasStats: false,
    tags: [],
    search: '',
    sort: 'popular',
  });
  const rows: MontageHero[] = heroes.map((h) => ({
    id: String(h.id),
    name: h.name,
    image_url: h.image_url,
    image_md_url: h.image_md_url,
    portrait_url: h.portrait_url,
    portrait_blurhash: h.portrait_blurhash,
  }));
  categoryMontageCache.set(slug, rows);
  return rows;
}

/**
 * Paged heroes for a single TEAM browse page — the team equivalent of
 * getUniversePage. A team is "heroes whose `teams[]` array contains the team
 * name", so this filters `.contains('teams', [name])` then shares applyListFacets
 * so team pages get the same sort/search/filter behaviour as universe pages
 * (minus the publisher facet — a team is already one publisher).
 */
export async function getTeamPage(
  teamName: string,
  options: { page: number; pageSize?: number; withCount?: boolean } & CategoryFilters,
): Promise<{ heroes: Hero[]; total: number }> {
  const {
    page,
    pageSize = 48,
    withCount = true,
    alignment,
    gender,
    hasStats,
    tags,
    search,
    sort,
  } = options;
  const tagList = tags ?? [];
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const selectCols = tagList.length
    ? `${CATEGORY_LIST_COLUMNS}, hero_tags!inner(tag)`
    : CATEGORY_LIST_COLUMNS;

  let q: any = supabase
    .from('heroes')
    .select(selectCols, withCount ? { count: 'estimated' } : undefined)
    .contains('teams', [teamName]);

  q = applyListFacets(q, { alignment, gender, hasStats, tagList, search, sort });

  const { data, error, count } = await q.range(from, to);
  if (error) throw new Error(error.message);
  return { heroes: (data ?? []) as Hero[], total: count ?? 0 };
}

/** One candidate row from the get_browse_covers RPC (top heroes per slug, by fame). */
export interface BrowseCoverCandidate {
  slug: string;
  pos: number;
  id: string;
  name: string;
  image_url: string | null;
  image_md_url: string | null;
  portrait_url: string | null;
}

// How deep into each fame-ranked category the rotation can reach.
const POOL_SIZE = 40;
// Rank-decay exponent: weight for a candidate at 1-based fame rank `pos` is
// pos^(-WEIGHT_ALPHA). Higher = stronger bias toward the most famous.
const WEIGHT_ALPHA = 1.0;

type Rng = () => number; // returns a float in [0, 1)

// Pick one candidate proportional to pos^(-WEIGHT_ALPHA). Because the pool is
// already ordered by fame, rank-decay encodes "more popular → more likely"
// without reading raw fame_score (robust to fame ties/zeros in the top N).
function weightedPick(candidates: BrowseCoverCandidate[], rng: Rng): BrowseCoverCandidate {
  const weights = candidates.map((c) => Math.pow(c.pos, -WEIGHT_ALPHA));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r < 0) return candidates[i];
  }
  return candidates[candidates.length - 1]; // float-rounding guard
}

/**
 * Assign one DISTINCT cover candidate per slug, walking slugs in order. Within a
 * slug, pick a fame-weighted-random candidate from those not yet used; an earlier
 * pod claims a shared hero so a later one falls through to its next candidate
 * (otherwise the same most-popular hero tops multiple tiles). Falls back to the
 * first candidate if every candidate for a slug is already used, so the tile still
 * gets art rather than the solid-colour fallback. Pure; `rng` is injectable for tests.
 */
export function pickDistinctCovers(
  bySlug: Map<string, BrowseCoverCandidate[]>,
  slugs: CategorySlug[],
  rng: Rng = Math.random,
): Record<string, BrowseCover> {
  const used = new Set<string>();
  const out: Record<string, BrowseCover> = {};
  for (const slug of slugs) {
    const candidates = bySlug.get(slug) ?? [];
    const available = candidates.filter((c) => !used.has(c.id));
    const pick = available.length > 0 ? weightedPick(available, rng) : candidates[0];
    if (!pick) continue;
    used.add(pick.id);
    out[slug] = {
      name: pick.name,
      image_url: pick.image_url,
      image_md_url: pick.image_md_url,
      portrait_url: pick.portrait_url,
    };
  }
  return out;
}

/**
 * One representative hero per browse category, for the image-backed category tiles
 * on the home screen and mobile-web search. A single `get_browse_covers` RPC returns
 * the top `POOL_SIZE` heroes by fame for every slug at once; `pickDistinctCovers`
 * then chooses a distinct, fame-weighted-random hero per pod so the grid varies each
 * session instead of always showing the single most-famous face. Missing/empty
 * categories simply don't get a cover (the tile falls back to a solid colour).
 */
export async function getBrowseCovers(slugs: CategorySlug[]): Promise<Record<string, BrowseCover>> {
  const { data, error } = await supabase.rpc('get_browse_covers', {
    p_slugs: slugs,
    p_per_slug: POOL_SIZE,
  });
  if (error) {
    // Throw, don't degrade — a connection-pool 500 during the explore fan-out
    // would otherwise cache an artless tile grid as "success" for the whole
    // staleTime. React Query (and useBrowseCovers' catch) handle the failure;
    // the retry lands after the burst.
    console.warn('[getBrowseCovers] error:', error.message);
    throw error;
  }
  return assignBrowseCovers((data ?? []) as BrowseCoverCandidate[], slugs);
}

/** Flat get_browse_covers rows → one distinct cover per slug. Rows must arrive
 *  pos-ascending within each slug (the RPC's fame order). Shared with the
 *  explore-bundle path. */
export function assignBrowseCovers(
  rows: BrowseCoverCandidate[],
  slugs: CategorySlug[],
): Record<string, BrowseCover> {
  const bySlug = new Map<string, BrowseCoverCandidate[]>();
  for (const row of rows) {
    const list = bySlug.get(row.slug) ?? [];
    list.push(row);
    bySlug.set(row.slug, list);
  }
  return pickDistinctCovers(bySlug, slugs);
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
