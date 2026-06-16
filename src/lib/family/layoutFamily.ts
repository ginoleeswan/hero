// src/lib/family/layoutFamily.ts
// Pure layout: FamilyGraph → absolute node positions + typed edges, using
// d3-hierarchy. Ancestors grow up, descendants grow down (two d3 trees stitched
// at the hero), the hero's generation is a horizontal band. (x,y) are node CENTERS.
import { hierarchy, tree } from 'd3-hierarchy';
import type { FamilyGraph, FamilyMember } from './types';

export const HERO_ID = '__hero__';

const NODE_W = 158;
const NODE_H = 50;
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

const TIER_LABELS: Record<number, string> = {
  2: 'Grandparents',
  1: 'Parents · aunts',
  0: 'Hero · siblings',
  [-1]: 'Children',
  [-2]: 'Grandchildren',
};

export function layoutFamily(graph: FamilyGraph): FamilyLayout {
  const all: FamilyMember[] = graph.tiers.flatMap((t) => t.nodes.map((n) => n.member));
  const parentIn = (id: string | null, set: FamilyMember[]) =>
    id && set.some((s) => s.id === id) ? id : null;

  const tier1 = all.filter((mm) => mm.tier === 1);
  const tier2 = all.filter((mm) => mm.tier === 2);
  const tierM1 = all.filter((mm) => mm.tier === -1);
  const tierM2 = all.filter((mm) => mm.tier === -2);
  const band = all.filter((mm) => mm.tier === 0);

  const ancSpec: Spec = {
    id: HERO_ID,
    member: null,
    children: tier1.map((p) => ({
      id: p.id,
      member: p,
      children: tier2
        .filter((g) => parentIn(g.treeParentId, tier1) === p.id)
        .map((g) => ({ id: g.id, member: g, children: [] })),
    })),
  };
  for (const g of tier2.filter((g) => parentIn(g.treeParentId, tier1) === null)) {
    ancSpec.children.push({ id: g.id, member: g, children: [] });
  }

  const descSpec: Spec = {
    id: HERO_ID,
    member: null,
    children: tierM1.map((c) => ({
      id: c.id,
      member: c,
      children: tierM2
        .filter((g) => parentIn(g.treeParentId, tierM1) === c.id)
        .map((g) => ({ id: g.id, member: g, children: [] })),
    })),
  };
  for (const g of tierM2.filter((g) => parentIn(g.treeParentId, tierM1) === null)) {
    descSpec.children.push({ id: g.id, member: g, children: [] });
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
    .map(([tier, y]) => ({ tier, label: TIER_LABELS[tier] ?? '', y }));

  return { nodes, edges, rows, bounds: { width: maxX + PAD, height: maxY + PAD } };
}
