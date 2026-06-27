import { supabase } from '../../supabase';
import type {
  Hero,
  HeroPowerResult,
  RelatedHeroCard,
  RelationKind,
  FearedVillain,
  HeroRelationship,
  RelationshipTone,
  Rivalry,
  PublisherCounts,
} from './types';

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
    .order('fame_score', { ascending: false, nullsFirst: false })
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
