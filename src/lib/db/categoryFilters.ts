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
  tags: string[];
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
  tags: [],
  sort: 'popular',
  search: '',
};

// `slug === null` means a UNIVERSE browse page (publisher/studio/franchise) —
// same filter UI as a category, minus the publisher facet (it's already one
// publisher) and with the default 'popular' sort.
export function defaultSort(slug: CategorySlug | null): SortOption {
  return slug === 'strongest' || slug === 'most-intelligent' ? 'power' : 'popular';
}

export function visibleFacets(slug: CategorySlug | null): FacetKey[] {
  const all: FacetKey[] = ['publisher', 'alignment', 'gender', 'hasStats'];
  return all.filter((f) => {
    if (f === 'publisher')
      return !(
        slug === null ||
        slug === 'marvel' ||
        slug === 'dc' ||
        slug === 'image' ||
        slug === 'dark-horse'
      );
    if (f === 'alignment' && (slug === 'villain' || slug === 'anti-heroes')) return false;
    if (f === 'hasStats' && (slug === 'strongest' || slug === 'most-intelligent')) return false;
    return true;
  });
}

export type FilterParams = Partial<{
  publisher: string;
  alignment: string;
  gender: string;
  stats: string;
  tags: string;
  sort: string;
  q: string;
}>;

export function filtersToParams(slug: CategorySlug | null, f: CategoryFilters): FilterParams {
  const p: FilterParams = {};
  if (f.publisher !== 'all') p.publisher = f.publisher;
  if (f.alignment !== 'any') p.alignment = f.alignment;
  if (f.gender !== 'any') p.gender = f.gender;
  if (f.hasStats) p.stats = '1';
  if (f.tags?.length) p.tags = f.tags.join(',');
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

export function paramsToFilters(slug: CategorySlug | null, p: FilterParams): CategoryFilters {
  return {
    publisher: pick(PUBS, p.publisher, 'all'),
    alignment: pick(ALIGNS, p.alignment, 'any'),
    gender: pick(GENDERS, p.gender, 'any'),
    hasStats: p.stats === '1',
    tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
    sort: pick(SORTS, p.sort, defaultSort(slug)),
    search: p.q ?? '',
  };
}

const LABELS: Record<string, string> = {
  marvel: 'Marvel',
  dc: 'DC',
  other: 'Other',
  good: 'Good',
  bad: 'Bad',
  neutral: 'Neutral',
  male: 'Male',
  female: 'Female',
};

const TAG_LABELS: Record<string, string> = {
  'anti-hero': 'Anti-hero',
  'reformed-villain': 'Reformed villain',
  'legacy-hero': 'Legacy hero',
  vigilante: 'Vigilante',
  mentor: 'Mentor',
  sidekick: 'Sidekick',
  mastermind: 'Mastermind',
  'monster-hunter': 'Monster hunter',
  mutant: 'Mutant',
  mutate: 'Mutate',
  'cosmic-powered': 'Cosmic-powered',
  'tech-based': 'Tech-based',
  'magic-user': 'Magic user',
  'super-soldier': 'Super-soldier',
  alien: 'Alien',
  mythological: 'Mythological',
  'street-level': 'Street-level',
  cosmic: 'Cosmic',
  'reality-warper': 'Reality-warper',
  powerhouse: 'Powerhouse',
  gadgeteer: 'Gadgeteer',
  'tragic-backstory': 'Tragic backstory',
  'morally-grey': 'Morally grey',
  brooding: 'Brooding',
  'comic-relief': 'Comic relief',
  wholesome: 'Wholesome',
  noir: 'Noir',
  'team-leader': 'Team leader',
  'lone-wolf': 'Lone wolf',
  'government-agent': 'Government agent',
  outlaw: 'Outlaw',
  shapeshifter: 'Shapeshifter',
  speedster: 'Speedster',
  telepath: 'Telepath',
  immortal: 'Immortal',
};

export interface ActiveChip {
  key: FacetKey | 'search' | 'tags';
  label: string;
  value?: string;
}

export function activeFilterList(slug: CategorySlug | null, f: CategoryFilters): ActiveChip[] {
  const visible = visibleFacets(slug);
  const chips: ActiveChip[] = [];
  if (visible.includes('publisher') && f.publisher !== 'all')
    chips.push({ key: 'publisher', label: LABELS[f.publisher] });
  if (visible.includes('alignment') && f.alignment !== 'any')
    chips.push({ key: 'alignment', label: LABELS[f.alignment] });
  if (visible.includes('gender') && f.gender !== 'any')
    chips.push({ key: 'gender', label: LABELS[f.gender] });
  if (visible.includes('hasStats') && f.hasStats)
    chips.push({ key: 'hasStats', label: 'Rated only' });
  for (const slug of f.tags ?? []) {
    chips.push({ key: 'tags', label: TAG_LABELS[slug] ?? slug, value: slug });
  }
  return chips;
}
