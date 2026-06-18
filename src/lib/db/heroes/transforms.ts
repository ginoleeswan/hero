import { supabase } from '../../supabase';
import type { CharacterData, MovieAppearance, StatsSource } from '../../../types';
import { rowToMember, type FamilyRow } from '../../family/rowToMember';
import type { FamilyMember } from '../../family/types';
import type { Hero } from './types';

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
        (hero.first_issue_data as unknown as import('../../../types').FirstIssue | null) ?? null,
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
      ? (hero.first_issue_data as unknown as import('../../../types').FirstIssue)
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
        'related:related_hero_id ( id, portrait_url, image_md_url, image_url, power, alignment )',
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
