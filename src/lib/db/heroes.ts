import { supabase } from '../supabase';
import type { Tables } from '../../types/database.generated';
import type { CharacterData, MovieAppearance, StatsSource } from '../../types';

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

export async function searchHeroes(
  query: string,
  publisher: PublisherFilter,
  limit = 100,
): Promise<HeroSearchResult[]> {
  let q = supabase
    .from('heroes')
    .select('id, name, publisher, image_md_url, image_url, portrait_url, full_name, aliases')
    .order('name')
    .limit(limit);

  if (query.trim()) {
    q = q.or(`name.ilike.%${query}%,full_name.ilike.%${query}%`) as typeof q;
  }

  if (publisher === 'Marvel') {
    q = q.ilike('publisher', '%marvel%') as typeof q;
  } else if (publisher === 'DC') {
    q = q.ilike('publisher', '%dc%') as typeof q;
  } else if (publisher === 'Other') {
    q = q.not('publisher', 'ilike', '%marvel%').not('publisher', 'ilike', '%dc%') as typeof q;
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as HeroSearchResult[];
}

export async function getAntiHeroes(limit = 20): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .ilike('alignment', '%neutral%')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getVillains(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .eq('alignment', 'bad')
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getIconicHeroes(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSpotlightHeroes(limit = 10): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .not('portrait_url', 'is', null)
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain","Company-Licensed")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getNewlyAddedCV(limit = 25): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .like('id', 'cv-%')
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain")')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getHeroesByPublisher(
  publisher: 'marvel' | 'dc',
  limit = 25,
): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .ilike('publisher', `%${publisher}%`)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getHeroesByStatRanking(
  stat: 'strength' | 'intelligence',
  limit = 20,
): Promise<Hero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('*')
    .not(stat, 'is', null)
    .order(stat, { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type CategorySlug =
  | 'popular'
  | 'villain'
  | 'xmen'
  | 'anti-heroes'
  | 'marvel'
  | 'dc'
  | 'strongest'
  | 'most-intelligent';

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  popular: 'Popular',
  villain: 'Villains',
  xmen: 'X-Men',
  'anti-heroes': 'Anti-Heroes',
  marvel: 'Marvel Universe',
  dc: 'DC Universe',
  strongest: 'Strongest Heroes',
  'most-intelligent': 'Most Intelligent',
};

export async function getAllHeroesBySlug(slug: CategorySlug): Promise<Hero[]> {
  switch (slug) {
    case 'popular':
    case 'villain':
    case 'xmen': {
      const { data, error } = await supabase
        .from('heroes')
        .select('*')
        .eq('category', slug)
        .order('name');
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    case 'anti-heroes': {
      const { data, error } = await supabase
        .from('heroes')
        .select('*')
        .ilike('alignment', '%neutral%')
        .order('name');
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    case 'marvel': {
      const { data, error } = await supabase
        .from('heroes')
        .select('*')
        .ilike('publisher', '%marvel%')
        .order('name');
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    case 'dc': {
      const { data, error } = await supabase
        .from('heroes')
        .select('*')
        .ilike('publisher', '%dc%')
        .order('name');
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    case 'strongest': {
      const { data, error } = await supabase
        .from('heroes')
        .select('*')
        .not('strength', 'is', null)
        .order('strength', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    case 'most-intelligent': {
      const { data, error } = await supabase
        .from('heroes')
        .select('*')
        .not('intelligence', 'is', null)
        .order('intelligence', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }
  }
}

export type HeroPowerResult = Pick<
  Hero,
  'id' | 'name' | 'publisher' | 'image_url' | 'portrait_url'
>;

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
      },
    },
    details: {
      summary: hero.summary ?? null,
      publisher: hero.publisher ?? null,
      firstIssueId: null,
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
    firstIssue: hero.first_issue_image_url
      ? { id: '', imageUrl: hero.first_issue_image_url, name: null, coverDate: null }
      : null,
    statsSource: (hero.stats_source as StatsSource) ?? null,
  };
}
