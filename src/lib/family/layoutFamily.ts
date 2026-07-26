// src/lib/family/layoutFamily.ts
// Pure layout: FamilyGraph → absolute node positions + typed edges, using
// d3-hierarchy. Ancestors grow up, descendants grow down (two d3 trees stitched
// at the hero), the hero's generation is a horizontal band. (x,y) are node CENTERS.
import { hierarchy, tree } from 'd3-hierarchy';
import type { FamilyGraph, FamilyMember } from './types';
import { LAYOUT_TIER_LABELS, tierLabel } from './tierLabels';

export const HERO_ID = '__hero__';

const NODE_W = 158;
const GAP_X = 26;
const ROW_H = 120;
const PAD = NODE_W / 2 + 16;

export interface PositionedNode {
  id: string;
  member: FamilyMember | null;
  x: number;
  y: number;
  isHero: boolean;
}
export type EdgeKind = 'bloodline' | 'marriage' | 'sibling';
export interface LayoutEdge {
  fromId: string;
  toId: string;
  kind: EdgeKind;
}
export interface FamilyLayout {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
  rows: { tier: number; label: string; y: number }[];
  bounds: { width: number; height: number };
}

interface Spec {
  id: string;
  member: FamilyMember | null;
  children: Spec[];
}

export function layoutFamily(graph: FamilyGraph): FamilyLayout {
  const all: FamilyMember[] = graph.tiers.flatMap((t) => t.nodes.map((n) => n.member));
  const parentIn = (id: string | null, set: FamilyMember[]) =>
    id && set.some((s) => s.id === id) ? id : null;

  const band = all.filter((mm) => mm.tier === 0);

  // Ancestors nest to whatever depth the data records, not a fixed two rows.
  // tier 9 is the clone/aside escape hatch, so it is excluded from the walk.
  const ancestors = all.filter((mm) => mm.tier > 0 && mm.tier !== 9);
  const atTier = (t: number) => ancestors.filter((mm) => mm.tier === t);
  const maxAncTier = ancestors.length ? Math.max(...ancestors.map((mm) => mm.tier)) : 0;

  // Each generation hangs off the specific forebear it descends through
  // (tree_parent_id), so the line reads as a lineage instead of a flat row.
  const ancChildren = (parentId: string, tier: number): Spec[] =>
    tier > maxAncTier
      ? []
      : atTier(tier)
          .filter((g) => g.treeParentId === parentId)
          .map((g) => ({ id: g.id, member: g, children: ancChildren(g.id, tier + 1) }));

  const ancSpec: Spec = {
    id: HERO_ID,
    member: null,
    children: atTier(1).map((p) => ({
      id: p.id,
      member: p,
      children: ancChildren(p.id, 2),
    })),
  };
  // Anyone whose forebear is missing from the set would otherwise vanish with
  // the branch it was meant to hang from; attach those to the hero directly.
  for (let t = 2; t <= maxAncTier; t++) {
    const above = atTier(t - 1);
    for (const g of atTier(t).filter((gg) => parentIn(gg.treeParentId, above) === null)) {
      ancSpec.children.push({ id: g.id, member: g, children: ancChildren(g.id, t + 1) });
    }
  }

  // Descendants mirror the ancestor walk: a recorded line runs as deep downward
  // as it does upward, and Aegon the Conqueror's reaches thirteen generations.
  const descendants = all.filter((mm) => mm.tier < 0 && mm.tier !== 9);
  const atDepth = (d: number) => descendants.filter((mm) => mm.tier === -d);
  const maxDescDepth = descendants.length ? Math.max(...descendants.map((mm) => -mm.tier)) : 0;

  const descChildren = (parentId: string, depth: number): Spec[] =>
    depth > maxDescDepth
      ? []
      : atDepth(depth)
          .filter((g) => g.treeParentId === parentId)
          .map((g) => ({ id: g.id, member: g, children: descChildren(g.id, depth + 1) }));

  const descSpec: Spec = {
    id: HERO_ID,
    member: null,
    children: atDepth(1).map((c) => ({
      id: c.id,
      member: c,
      children: descChildren(c.id, 2),
    })),
  };
  for (let d = 2; d <= maxDescDepth; d++) {
    const above = atDepth(d - 1);
    for (const g of atDepth(d).filter((gg) => parentIn(gg.treeParentId, above) === null)) {
      descSpec.children.push({ id: g.id, member: g, children: descChildren(g.id, d + 1) });
    }
  }

  const lay = tree<Spec>().nodeSize([NODE_W + GAP_X, ROW_H]);
  const ancRoot = lay(hierarchy(ancSpec));
  const descRoot = lay(hierarchy(descSpec));
  const ancHeroX = ancRoot.x;
  const descHeroX = descRoot.x;

  const nodes: PositionedNode[] = [{ id: HERO_ID, member: null, x: 0, y: 0, isHero: true }];
  const edges: LayoutEdge[] = [];

  ancRoot.each((d) => {
    if (d.data.id === HERO_ID) return;
    const tier = d.data.member?.tier ?? 1;
    nodes.push({
      id: d.data.id,
      member: d.data.member,
      x: d.x - ancHeroX,
      y: -tier * ROW_H,
      isHero: false,
    });
    edges.push({
      fromId: d.parent ? d.parent.data.id : HERO_ID,
      toId: d.data.id,
      kind: 'bloodline',
    });
  });
  descRoot.each((d) => {
    if (d.data.id === HERO_ID) return;
    const tier = d.data.member?.tier ?? -1;
    nodes.push({
      id: d.data.id,
      member: d.data.member,
      x: d.x - descHeroX,
      y: -tier * ROW_H,
      isHero: false,
    });
    edges.push({
      fromId: d.parent ? d.parent.data.id : HERO_ID,
      toId: d.data.id,
      kind: 'bloodline',
    });
  });

  // Hero generation: siblings to the left, spouse(s) then cousins/others to the
  // right. Chain each node to its inner neighbour (not back to the hero) so the
  // dashed same-generation links never run over the gold marriage tie.
  const siblings = band.filter((mm) => mm.relation === 'sibling');
  const spouses = band.filter((mm) => mm.relation === 'spouse');
  const otherBand = band.filter((mm) => mm.relation !== 'sibling' && mm.relation !== 'spouse');
  const right = [...spouses, ...otherBand];
  siblings.forEach((mm, i) => {
    nodes.push({ id: mm.id, member: mm, x: -(NODE_W + GAP_X) * (i + 1), y: 0, isHero: false });
    edges.push({ fromId: i === 0 ? HERO_ID : siblings[i - 1].id, toId: mm.id, kind: 'sibling' });
  });
  right.forEach((mm, i) => {
    nodes.push({ id: mm.id, member: mm, x: (NODE_W + GAP_X) * (i + 1), y: 0, isHero: false });
    edges.push({
      fromId: i === 0 ? HERO_ID : right[i - 1].id,
      toId: mm.id,
      kind: mm.relation === 'spouse' ? 'marriage' : 'sibling',
    });
  });

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  for (const n of nodes) {
    n.x = n.x - minX + PAD;
    n.y = n.y - minY + PAD;
  }
  const maxX = Math.max(...nodes.map((n) => n.x));
  const maxY = Math.max(...nodes.map((n) => n.y));

  const tierY = new Map<number, number>();
  const heroNode = nodes.find((n) => n.isHero)!;
  tierY.set(0, heroNode.y);
  for (const n of nodes) if (n.member) tierY.set(n.member.tier, n.y);
  const rows = [...tierY.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([tier, y]) => ({ tier, label: tierLabel(tier, LAYOUT_TIER_LABELS), y }));

  return { nodes, edges, rows, bounds: { width: maxX + PAD, height: maxY + PAD } };
}
