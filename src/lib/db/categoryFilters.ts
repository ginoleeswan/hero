import type { CategorySlug, SortOption } from './heroes';

export type PublisherOpt = 'all' | 'marvel' | 'dc' | 'other';
export type AlignmentOpt = 'any' | 'good' | 'bad' | 'neutral';
export type GenderOpt = 'any' | 'male' | 'female';
export type FacetKey = 'publisher' | 'alignment' | 'gender' | 'hasStats';

export interface CategoryFilters {
  publisher: PublisherOpt;
  alignment: AlignmentOpt;
  gender: GenderOpt;
  hasStats: boolean;
  sort: SortOption; // 'popular' | 'az' | 'power'
  search: string;
}

export interface FacetCounts {
  total: number;
  publisher: { all: number; marvel: number; dc: number; other: number };
  alignment: { good: number; bad: number; neutral: number };
  gender: { male: number; female: number };
  has_stats: number;
}

export const DEFAULT_FILTERS: CategoryFilters = {
  publisher: 'all',
  alignment: 'any',
  gender: 'any',
  hasStats: false,
  sort: 'popular',
  search: '',
};

export function defaultSort(slug: CategorySlug): SortOption {
  return slug === 'strongest' || slug === 'most-intelligent' ? 'power' : 'popular';
}

export function visibleFacets(slug: CategorySlug): FacetKey[] {
  const all: FacetKey[] = ['publisher', 'alignment', 'gender', 'hasStats'];
  return all.filter((f) => {
    if (f === 'alignment' && (slug === 'villain' || slug === 'anti-heroes')) return false;
    if (f === 'publisher' && (slug === 'marvel' || slug === 'dc')) return false;
    if (f === 'hasStats' && (slug === 'strongest' || slug === 'most-intelligent')) return false;
    return true;
  });
}

export type FilterParams = Partial<{
  publisher: string; alignment: string; gender: string; stats: string; sort: string; q: string;
}>;

export function filtersToParams(slug: CategorySlug, f: CategoryFilters): FilterParams {
  const p: FilterParams = {};
  if (f.publisher !== 'all') p.publisher = f.publisher;
  if (f.alignment !== 'any') p.alignment = f.alignment;
  if (f.gender !== 'any') p.gender = f.gender;
  if (f.hasStats) p.stats = '1';
  if (f.sort !== defaultSort(slug)) p.sort = f.sort;
  if (f.search.trim()) p.q = f.search.trim();
  return p;
}

const PUBS: PublisherOpt[] = ['all', 'marvel', 'dc', 'other'];
const ALIGNS: AlignmentOpt[] = ['any', 'good', 'bad', 'neutral'];
const GENDERS: GenderOpt[] = ['any', 'male', 'female'];
const SORTS: SortOption[] = ['popular', 'az', 'power'];

function pick<T extends string>(allowed: T[], v: string | undefined, fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function paramsToFilters(slug: CategorySlug, p: FilterParams): CategoryFilters {
  return {
    publisher: pick(PUBS, p.publisher, 'all'),
    alignment: pick(ALIGNS, p.alignment, 'any'),
    gender: pick(GENDERS, p.gender, 'any'),
    hasStats: p.stats === '1',
    sort: pick(SORTS, p.sort, defaultSort(slug)),
    search: p.q ?? '',
  };
}

const LABELS: Record<string, string> = {
  marvel: 'Marvel', dc: 'DC', other: 'Other',
  good: 'Good', bad: 'Bad', neutral: 'Neutral',
  male: 'Male', female: 'Female',
};

export interface ActiveChip { key: FacetKey | 'search'; label: string; }

export function activeFilterList(slug: CategorySlug, f: CategoryFilters): ActiveChip[] {
  const visible = visibleFacets(slug);
  const chips: ActiveChip[] = [];
  if (visible.includes('publisher') && f.publisher !== 'all') chips.push({ key: 'publisher', label: LABELS[f.publisher] });
  if (visible.includes('alignment') && f.alignment !== 'any') chips.push({ key: 'alignment', label: LABELS[f.alignment] });
  if (visible.includes('gender') && f.gender !== 'any') chips.push({ key: 'gender', label: LABELS[f.gender] });
  if (visible.includes('hasStats') && f.hasStats) chips.push({ key: 'hasStats', label: 'Rated only' });
  return chips;
}
