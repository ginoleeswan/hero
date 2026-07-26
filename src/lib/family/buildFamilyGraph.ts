// src/lib/family/buildFamilyGraph.ts
// Turns enriched FamilyMember rows into a render-ready model: generation tiers
// ordered +2 → -2, each node annotated with where its connector attaches (the
// hero spine, or a specific parent when the kinship resolver supplied one), with
// resolved children clustered next to their parent's column.
import type { ConnTarget, FamilyGraph, FamilyMember, GraphNode, GraphTier } from './types';
import { GRAPH_TIER_LABELS, tierLabel } from './tierLabels';

const NONFAMILY = /girlfriend|boyfriend|fianc|lover|paramour/i;
const COLLAPSE_AFTER = 6;

export function buildFamilyGraph(members: FamilyMember[]): FamilyGraph {
  const present = new Set(members.map((x) => x.id));
  const asides: FamilyMember[] = [];
  const footnotes: FamilyMember[] = [];
  const byTier = new Map<number, FamilyMember[]>();

  for (const x of members) {
    if (x.tier === 9 || x.relation === 'clone') asides.push(x);
    else if (x.relation === 'other' && NONFAMILY.test(x.role)) footnotes.push(x);
    else {
      const list = byTier.get(x.tier) ?? [];
      list.push(x);
      byTier.set(x.tier, list);
    }
  }

  const spouse = (byTier.get(0) ?? []).find((x) => x.relation === 'spouse') ?? null;

  // Order index of each member within its own tier (by source position) — used to
  // cluster a tier's resolved children next to their parent's column.
  const orderInTier = new Map<string, number>();
  for (const [, list] of byTier) {
    [...list].sort((a, b) => a.position - b.position).forEach((x, i) => orderInTier.set(x.id, i));
  }

  const connFor = (x: FamilyMember): ConnTarget =>
    x.treeParentId && present.has(x.treeParentId)
      ? { kind: 'parent', id: x.treeParentId }
      : { kind: 'hero' };

  const sortKey = (x: FamilyMember): [number, number] => {
    if (x.treeParentId && orderInTier.has(x.treeParentId)) {
      return [orderInTier.get(x.treeParentId)!, x.position];
    }
    return [orderInTier.get(x.id) ?? x.position, x.position];
  };

  // Walk whatever generations the data actually holds, deepest ancestor first,
  // rather than a fixed +2..-2 window that silently dropped recorded lineage.
  // Tier 9 is the clone/aside escape hatch and never becomes a row.
  const orderedTiers = [...byTier.keys()].filter((t) => t !== 9).sort((a, b) => b - a);

  const tiers: GraphTier[] = [];
  for (const t of orderedTiers) {
    const list = byTier.get(t);
    if (!list || list.length === 0) continue;
    const nodes: GraphNode[] = [...list]
      .sort((a, b) => {
        const ka = sortKey(a);
        const kb = sortKey(b);
        return ka[0] - kb[0] || ka[1] - kb[1];
      })
      .map((member) => ({ member, connectTo: connFor(member) }));
    tiers.push({
      tier: t,
      label: tierLabel(t, GRAPH_TIER_LABELS),
      nodes,
      // Anything beyond the immediate family starts collapsed: a dynasty runs a
      // dozen generations each way and would otherwise bury the character.
      collapsedByDefault: t >= 2 || t <= -2 || nodes.length > COLLAPSE_AFTER,
    });
  }

  return { tiers, asides, footnotes, spouse };
}
