import type { NeighborEdge } from '../db/heroes/neighborhood';

export type OrbitKind = NeighborEdge['kind'];

/** Rings ordered inside → out: the closer the bond, the tighter the orbit. */
const BAND_ORDER: OrbitKind[] = ['teammate', 'ally', 'enemy'];

export interface OrbitBand {
  kind: OrbitKind;
  /** Ring radius in the same normalized [-1,1] space as the positions. */
  r: number;
  count: number;
}

export interface OrbitalLayout {
  positions: Map<string, { x: number; y: number }>;
  bands: OrbitBand[];
}

/** Deterministic 0–1 hash — keeps a character's system identical across visits. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Lay a hero's neighbourhood out as a solar system instead of a force graph.
 *
 * The subject sits at the centre and every other character orbits in the band for
 * its relationship: teammates closest, then allies, then enemies. The point is
 * that **the orbit encodes the relationship**, so the subject's edges become
 * redundant — which is what kills the hairball outright rather than hiding it.
 * A force layout of this data draws ~250 lines for 25 nodes; this draws none,
 * and still says more, because band membership is readable at a glance where a
 * tangle of coloured lines is not.
 *
 * It also degrades well: a character with three relatives gets a legible little
 * system rather than a lopsided blob, since ring radii compress to whichever
 * bands are actually populated.
 *
 * Positions come back normalized to roughly [-1,1] with the subject at the
 * origin, matching layoutNeighborhood so it drops into the same renderer.
 */
export function layoutOrbital(
  nodes: { id: string; isSubject: boolean; kind: OrbitKind | null; fame: number }[],
  subjectId: string,
): OrbitalLayout {
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(subjectId, { x: 0, y: 0 });

  // Group into bands; anything without a direct tie rides the outermost ring.
  const grouped = new Map<OrbitKind, typeof nodes>();
  for (const n of nodes) {
    if (n.isSubject) continue;
    const kind = n.kind ?? 'enemy';
    const list = grouped.get(kind) ?? [];
    list.push(n);
    grouped.set(kind, list);
  }

  const present = BAND_ORDER.filter((k) => (grouped.get(k)?.length ?? 0) > 0);
  const bands: OrbitBand[] = [];

  // Spread whatever bands exist across the full canvas rather than leaving a
  // hole where an empty band would have been.
  const INNER = 0.42;
  const OUTER = 1;
  const SOLO = 0.72;
  present.forEach((kind, bandIndex) => {
    const members = grouped.get(kind)!;
    // A lone band sits on a comfortable mid ring rather than being pushed to
    // either extreme — an all-enemies character shouldn't get a hollow centre.
    const r =
      present.length === 1
        ? SOLO
        : INNER + (OUTER - INNER) * (bandIndex / (present.length - 1));
    bands.push({ kind, r, count: members.length });

    // Brightest first, then walk alternately clockwise/anticlockwise from the
    // start angle, so the most recognisable faces land furthest apart instead of
    // bunching in one arc.
    const sorted = [...members].sort((a, b) => b.fame - a.fame);
    const n = sorted.length;
    const start = hash01(subjectId + kind) * Math.PI * 2;
    const step = (Math.PI * 2) / n;

    sorted.forEach((node, i) => {
      const slot = i % 2 === 0 ? i / 2 : n - Math.ceil(i / 2);
      const angle = start + slot * step;
      // A crowded ring splits into two staggered lanes so neighbours can't touch.
      const lane = n > 7 ? (i % 2 === 0 ? 0.055 : -0.055) : 0;
      positions.set(node.id, {
        x: Math.cos(angle) * (r + lane),
        y: Math.sin(angle) * (r + lane),
      });
    });
  });

  return { positions, bands };
}
