// src/lib/family/generations.ts
// Placing every member of a house on a single generational ladder.
//
// Nothing in the data says what generation anybody belongs to — edges only say
// what two people are to *each other* — so it is derived: seed one person at
// zero and walk outward, adding the distance each relation carries. Pure and
// I/O-free, like kinshipPath. Breadth-first, so where a dynasty that married
// its cousins offers two routes the shorter one wins.

/** One recorded relation, in the direction it was recorded. */
export interface GenerationEdge {
  hero_id: string;
  related_hero_id: string;
  /** `related_hero_id` is `hero_id`'s ___ */
  relation: string;
  /** "10× great-grandfather" — where the generation count actually lives. */
  role: string | null;
}

/**
 * How many generations up a forebear stands, read off the label. `ancestor`
 * carries no count in the relation word, so the role is the only place the
 * distance exists. Unparseable counts as one — understating, never inventing.
 */
export function roleDepth(role: string | null): number {
  const r = (role ?? '').toLowerCase();
  // "10× great-grandfather" — n greats past grandparent, so n + 2.
  const multiple = /(\d+)\s*[×x]\s*great[- ]grand/.exec(r);
  if (multiple) return parseInt(multiple[1], 10) + 2;
  // "great-great-grandmother" written out.
  const greats = r.match(/great[- ]/g);
  if (greats && /grand/.test(r)) return greats.length + 2;
  if (/grand/.test(r)) return 2;
  return 1;
}

/**
 * Generational offset of `related_hero_id` from `hero_id`. Positive is younger.
 * Null means the relation says nothing about generation, so the edge is not
 * walked — an in-law can sit anywhere on the ladder.
 */
export function offsetOf(relation: string, role: string | null): number | null {
  switch (relation) {
    case 'parent':
    case 'aunt_uncle':
      return -1;
    case 'grandparent':
      return -2;
    case 'ancestor':
      return -roleDepth(role);
    case 'child':
    case 'niece_nephew':
      return 1;
    case 'grandchild':
      return 2;
    case 'descendant':
      return roleDepth(role);
    case 'sibling':
    case 'spouse':
    case 'cousin':
      return 0;
    default:
      return null;
  }
}

export interface GenerationBand<M> {
  /** Depth from the oldest recorded generation: 0 is the top of the ladder. */
  depth: number;
  members: M[];
}

export interface Generations<M> {
  bands: GenerationBand<M>[];
  /** Of the house, but no chain reaches them — better said than invented. */
  unplaced: M[];
}

/**
 * @param members in the order they should appear within a band
 * @param edges   every recorded relation in the house, either direction
 */
export function assignGenerations<M extends { id: string }>(
  members: M[],
  edges: GenerationEdge[],
): Generations<M> {
  if (members.length === 0) return { bands: [], unplaced: [] };

  const known = new Set(members.map((m) => m.id));
  // Undirected: each edge is walkable from both ends, inverted on the way back.
  const adjacency = new Map<string, { to: string; offset: number }[]>();
  const push = (from: string, to: string, offset: number) => {
    const list = adjacency.get(from);
    if (list) list.push({ to, offset });
    else adjacency.set(from, [{ to, offset }]);
  };
  for (const e of edges) {
    if (!known.has(e.hero_id) || !known.has(e.related_hero_id)) continue;
    if (e.hero_id === e.related_hero_id) continue;
    const offset = offsetOf(e.relation, e.role);
    if (offset === null) continue;
    push(e.hero_id, e.related_hero_id, offset);
    push(e.related_hero_id, e.hero_id, -offset);
  }

  // The most famous member, whose edges the catalogue is likeliest to have right.
  const generation = new Map<string, number>([[members[0].id, 0]]);
  let frontier = [members[0].id];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      const at = generation.get(id)!;
      for (const step of adjacency.get(id) ?? []) {
        if (generation.has(step.to)) continue;
        generation.set(step.to, at + step.offset);
        next.push(step.to);
      }
    }
    frontier = next;
  }

  const placed = members.filter((m) => generation.has(m.id));
  const unplaced = members.filter((m) => !generation.has(m.id));
  if (placed.length === 0) return { bands: [], unplaced };

  // Rebase so the oldest rung is 0 — the seed's zero is an accident of fame.
  const oldest = Math.min(...placed.map((m) => generation.get(m.id)!));
  const byDepth = new Map<number, M[]>();
  for (const m of placed) {
    const depth = generation.get(m.id)! - oldest;
    const band = byDepth.get(depth);
    if (band) band.push(m);
    else byDepth.set(depth, [m]);
  }

  const bands = [...byDepth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([depth, bandMembers]) => ({ depth, members: bandMembers }));

  return { bands, unplaced };
}
