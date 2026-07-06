import { supabase } from '../../supabase';

export interface NeighborNode {
  id: string;
  name: string;
  portrait_url: string | null;
  image_md_url: string | null;
  image_url: string | null;
  alignment: string | null;
  publisher: string | null;
  fame_score: number | null;
  is_subject: boolean;
}
export interface NeighborEdge {
  from: string;
  to: string;
  kind: 'enemy' | 'ally' | 'teammate';
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
