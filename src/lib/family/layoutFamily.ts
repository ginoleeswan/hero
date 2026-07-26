// src/lib/family/layoutFamily.ts
// Pure layout: FamilyGraph → absolute node positions + typed edges, using
// d3-hierarchy. Ancestors grow up, descendants grow down (two d3 trees stitched
// at the hero), the hero's generation is a horizontal band. (x,y) are node CENTERS.
import { hierarchy, tree } from 'd3-hierarchy';
import type { FamilyGraph, FamilyMember } from './types';
import { LAYOUT_TIER_LABELS, tierLabel } from './tierLabels';

export const HERO_ID = '__hero__';

// Nodes are portrait cameos rather than list rows: narrow and tall. Narrowness
// is what keeps a wide generation together — at 158 a set of siblings was flung
// to opposite ends of the canvas with a connector running the full width.
const NODE_W = 104;
const GAP_X = 20;
// A roundel plus two lines of name is ~108 tall; the rest is the gap the
// connectors run through.
export const ROW_H = 150;
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
  /**
   * Overrides the start point, used to hang a line of descent from the midpoint
   * between two parents rather than from either one of them.
   */
  fromX?: number;
  fromY?: number;
}

/**
 * A relation that lies on the subject's own bloodline, as opposed to a
 * collateral branch (aunts, cousins, in-laws). The chart weights the two
 * differently — a direct forebear should not read the same as an adopted uncle.
 */
export function isLineal(relation: string): boolean {
  return (
    relation === 'parent' ||
    relation === 'child' ||
    relation === 'grandparent' ||
    relation === 'grandchild' ||
    relation === 'ancestor' ||
    relation === 'descendant'
  );
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

/** Sort every level of a spec tree by the source order of its members. */
function orderByPosition(spec: Spec): void {
  spec.children.sort((a, b) => (a.member?.position ?? 0) - (b.member?.position ?? 0));
  for (const child of spec.children) orderByPosition(child);
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
  // Appending orphans put them at whichever end of the row d3 reached last,
  // stranding a grandparent at the far edge with a connector running the width
  // of the canvas to their own child. Source order keeps kin adjacent.
  orderByPosition(ancSpec);

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
  orderByPosition(descSpec);

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

  // ── Couples ───────────────────────────────────────────────────────────────
  // The atomic unit of a family tree is not a person, it is a couple: two
  // parents with one line of descent running from between them. Drawn per-person
  // instead, a pair of parents produced two parallel lines to the same child and
  // nothing at all said they were married.
  //
  // Co-parenthood is already in the data without being named: two lineal
  // forebears hanging off the same node ARE that node's parents. Restricted to
  // the ancestor half — two lineal nodes below a shared parent are siblings, not
  // spouses, and coupling those would marry a hero's own children to each other.
  const byFrom = new Map<string, LayoutEdge[]>();
  for (const e of edges) {
    if (e.kind !== 'bloodline') continue;
    const list = byFrom.get(e.fromId) ?? [];
    list.push(e);
    byFrom.set(e.fromId, list);
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const coupled: LayoutEdge[] = [];
  const dropped = new Set<LayoutEdge>();

  for (const [fromId, group] of byFrom) {
    const anchor = nodeById.get(fromId);
    if (!anchor) continue;
    const lineal = group.filter((e) => {
      const n = nodeById.get(e.toId);
      return n?.member && isLineal(n.member.relation) && n.y < anchor.y;
    });
    if (lineal.length !== 2) continue;

    const a = nodeById.get(lineal[0].toId)!;
    const b = nodeById.get(lineal[1].toId)!;
    if (Math.abs(a.y - b.y) > 1) continue;

    lineal.forEach((e) => dropped.add(e));
    coupled.push({ fromId: a.id, toId: b.id, kind: 'marriage' });
    coupled.push({
      fromId: a.id,
      toId: fromId,
      kind: 'bloodline',
      fromX: (a.x + b.x) / 2,
      fromY: (a.y + b.y) / 2,
    });
  }
  const finalEdges = edges.filter((e) => !dropped.has(e)).concat(coupled);

  const tierY = new Map<number, number>();
  const heroNode = nodes.find((n) => n.isHero)!;
  tierY.set(0, heroNode.y);
  for (const n of nodes) if (n.member) tierY.set(n.member.tier, n.y);
  const rows = [...tierY.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([tier, y]) => ({ tier, label: tierLabel(tier, LAYOUT_TIER_LABELS), y }));

  return { nodes, edges: finalEdges, rows, bounds: { width: maxX + PAD, height: maxY + PAD } };
}
