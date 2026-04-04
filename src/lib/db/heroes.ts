import { supabase } from '../supabase';
import type { Tables } from '../../types/database.generated';
import type { CharacterData } from '../../types';

export type Hero = Tables<'heroes'>;
export type HeroCategory = 'popular' | 'villain' | 'xmen';
export type PublisherFilter = 'All' | 'Marvel' | 'DC' | 'Other';
export type HeroSearchResult = Pick<Hero, 'id' | 'name' | 'publisher' | 'image_md_url' | 'image_url'>;

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

export async function getHeroById(id: string): Promise<Hero | null> {
  const { data } = await supabase
    .from('heroes')
    .select('*')
    .eq('id', id)
    .single();
  return data ?? null;
}

export async function searchHeroes(
  query: string,
  publisher: PublisherFilter,
): Promise<HeroSearchResult[]> {
  let q = supabase
    .from('heroes')
    .select('id, name, publisher, image_md_url, image_url')
    .order('name')
    .limit(100);

  if (query.trim()) q = q.ilike('name', `%${query}%`) as typeof q;

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
        url: hero.image_url ?? '',
      },
    },
    details: {
      summary: hero.summary ?? null,
      publisher: hero.publisher ?? null,
      firstIssueId: null,
    },
    firstIssue: hero.first_issue_image_url
      ? { id: '', imageUrl: hero.first_issue_image_url }
      : null,
  };
}
