// src/lib/family/buildFamilyGraph.ts
// Turns enriched FamilyMember rows into a render-ready model: generation tiers
// ordered +2 → -2, each node annotated with where its connector attaches (the
// hero spine, or a specific parent when the kinship resolver supplied one), with
// resolved children clustered next to their parent's column.
import type { ConnTarget, FamilyGraph, FamilyMember, GraphNode, GraphTier } from './types';

const TIER_LABELS: Record<number, string> = {
  2: 'Grandparents · Ancestors',
  1: 'Parents · Aunts & Uncles',
  0: 'Same generation',
  [-1]: 'Children',
  [-2]: 'Grandchildren',
};

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
    [...list]
      .sort((a, b) => a.position - b.position)
      .forEach((x, i) => orderInTier.set(x.id, i));
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

  const tiers: GraphTier[] = [];
  for (const t of [2, 1, 0, -1, -2]) {
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
      label: TIER_LABELS[t],
      nodes,
      collapsedByDefault: t === 2 || nodes.length > COLLAPSE_AFTER,
    });
  }

  return { tiers, asides, footnotes, spouse };
}
