import { supabase } from '../../supabase';

export interface NeighborNode {
  id: string;
  name: string;
  /** Flat icon avatar, preferred at node size. Famous heroes only — often null. */
  avatar_url: string | null;
  portrait_url: string | null;
  image_md_url: string | null;
  image_url: string | null;
  alignment: string | null;
  publisher: string | null;
  fame_score: number | null;
  /** Rosters this character belongs to — powers the "why" on the focus card. */
  teams: string[] | null;
  /** Drives the card's per-character accent via deriveCharacterTheme. */
  portrait_blurhash: string | null;
  intelligence: number | null;
  strength: number | null;
  speed: number | null;
  durability: number | null;
  power: number | null;
  combat: number | null;
  powerstats_total: number | null;
  is_subject: boolean;
}
/**
 * Wider than `RelationKind` in ./types on purpose: that one is the set of kinds
 * the hero_relationships TABLE accepts, while the neighbourhood graph also folds
 * in kin from hero_relatives. `family` outranks the rest — where a pair is both
 * kin and something else (Lois Lane is Superman's spouse *and* an ally), the
 * blood tie is the more specific fact and wins the edge.
 */
export type NeighborKind = 'family' | 'enemy' | 'ally' | 'teammate';

export interface NeighborEdge {
  from: string;
  to: string;
  kind: NeighborKind;
}
export interface Neighborhood {
  nodes: NeighborNode[];
  edges: NeighborEdge[];
}

/** A hero's ego network: subject + top-fame neighbours + all edges among them. */
export async function getHeroNeighborhood(heroId: string, limit = 24): Promise<Neighborhood> {
  if (!heroId) return { nodes: [], edges: [] };
  const { data, error } = await supabase.rpc('get_hero_neighborhood', {
    p_hero_id: heroId,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getHeroNeighborhood] error:', error.message);
    return { nodes: [], edges: [] };
  }
  const parsed = (data ?? { nodes: [], edges: [] }) as unknown as Neighborhood;
  return { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] };
}

/** The relationship of `nodeId` to `subjectId`, from the subject-incident edge. */
export function subjectKind(
  edges: NeighborEdge[],
  subjectId: string,
  nodeId: string,
): NeighborEdge['kind'] | null {
  if (nodeId === subjectId) return null;
  const e = edges.find(
    (x) => (x.from === subjectId && x.to === nodeId) || (x.to === subjectId && x.from === nodeId),
  );
  return e ? e.kind : null;
}
