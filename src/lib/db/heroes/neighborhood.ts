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
  /**
   * For `family` edges only: what `to` is to `from` — parent, cousin, spouse.
   * Subject-incident family edges are always stored subject-first, so on those
   * this reads as the neighbour's role in the subject's life.
   */
  relation?: string | null;
  /**
   * A hand-written note on what this pair's relationship actually is. Present
   * only on subject-incident edges, and only for the pairs that have been
   * curated — see hero_relationship_blurbs.
   */
  blurb?: string | null;
}

/** Kin roles as they're written in hero_relatives, in reader's English. */
const RELATION_LABEL: Record<string, string> = {
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  spouse: 'Spouse',
  cousin: 'Cousin',
  grandparent: 'Grandparent',
  grandchild: 'Grandchild',
  aunt_uncle: 'Aunt or uncle',
  niece_nephew: 'Niece or nephew',
  in_law: 'In-law',
  ancestor: 'Ancestor',
  descendant: 'Descendant',
  clone: 'Clone',
  // 'other' has no useful English of its own; the generic word is the honest
  // answer rather than inventing a closeness the row doesn't claim.
  other: 'Family',
};

export function relationLabel(relation: string | null | undefined): string | null {
  if (!relation) return null;
  return RELATION_LABEL[relation] ?? null;
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
  // Throw rather than returning an empty graph. The social-web explorer IS this
  // data, so a swallowed failure rendered an empty universe — the character has
  // no connections, said the outage. The character page's portal preview reads
  // the same function but already bails on missing data, so it degrades to
  // hidden either way, and now gets a retry for free.
  if (error) throw new Error(`[getHeroNeighborhood] ${error.message}`);
  const parsed = (data ?? { nodes: [], edges: [] }) as unknown as Neighborhood;
  return { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] };
}

/** The subject-incident edge for a node, if there is one. */
function subjectEdge(
  edges: NeighborEdge[],
  subjectId: string,
  nodeId: string,
): NeighborEdge | undefined {
  if (nodeId === subjectId) return undefined;
  return edges.find(
    (x) => (x.from === subjectId && x.to === nodeId) || (x.to === subjectId && x.from === nodeId),
  );
}

/** The relationship of `nodeId` to `subjectId`, from the subject-incident edge. */
export function subjectKind(
  edges: NeighborEdge[],
  subjectId: string,
  nodeId: string,
): NeighborEdge['kind'] | null {
  return subjectEdge(edges, subjectId, nodeId)?.kind ?? null;
}

/** The curated note for this pair, if one has been written. */
export function subjectBlurb(
  edges: NeighborEdge[],
  subjectId: string,
  nodeId: string,
): string | null {
  return subjectEdge(edges, subjectId, nodeId)?.blurb ?? null;
}

/**
 * What `nodeId` IS to `subjectId` in words — "Cousin", "Spouse" — or null when
 * the tie isn't kin, or is kin the data won't name.
 *
 * Only trusted when the edge is stored subject-first, which is how the RPC
 * orients subject-incident family edges. Read from the far end the same row
 * would name the subject's role instead, which would be backwards.
 */
export function subjectRelation(
  edges: NeighborEdge[],
  subjectId: string,
  nodeId: string,
): string | null {
  const e = subjectEdge(edges, subjectId, nodeId);
  if (!e || e.kind !== 'family' || e.from !== subjectId) return null;
  return relationLabel(e.relation);
}
