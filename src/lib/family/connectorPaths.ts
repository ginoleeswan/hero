// src/lib/family/connectorPaths.ts
// Pure geometry: given each node's measured box (in one coordinate space), the
// hero box, and each node's connection target, produce orthogonal "elbow"
// polylines for the SVG connector overlay. ConnTarget is duplicated here (not
// imported from types) to keep this module free of family-model dependencies.
export interface NodeBox {
  cx: number; // center x in container coords
  top: number; // top edge y
  bottom: number; // bottom edge y
}

export type ConnTarget = { kind: 'hero' } | { kind: 'parent'; id: string };

export interface ConnLink {
  id: string; // the outer node's id (must be in boxes)
  target: ConnTarget; // hero, or a specific parent id (must be in boxes)
}

export interface ConnInput {
  hero: NodeBox;
  boxes: Record<string, NodeBox>;
  links: ConnLink[];
}

export interface Polyline {
  points: [number, number][];
}

/** A 4-point orthogonal elbow between an outer node and the box it attaches to. */
function elbow(node: NodeBox, target: NodeBox): Polyline {
  const nodeAbove = node.bottom <= target.top;
  if (nodeAbove) {
    const midY = (node.bottom + target.top) / 2;
    return {
      points: [
        [node.cx, node.bottom],
        [node.cx, midY],
        [target.cx, midY],
        [target.cx, target.top],
      ],
    };
  }
  const midY = (target.bottom + node.top) / 2;
  return {
    points: [
      [node.cx, node.top],
      [node.cx, midY],
      [target.cx, midY],
      [target.cx, target.bottom],
    ],
  };
}

export function connectorPaths(input: ConnInput): Polyline[] {
  const out: Polyline[] = [];
  for (const link of input.links) {
    const node = input.boxes[link.id];
    if (!node) continue;
    const target = link.target.kind === 'hero' ? input.hero : input.boxes[link.target.id];
    if (!target) continue;
    out.push(elbow(node, target));
  }
  return out;
}
