/** A node plus every node directly connected to it by an edge. */
export function connectedIds(edges: { from: string; to: string }[], nodeId: string): Set<string> {
  const s = new Set<string>([nodeId]);
  for (const e of edges) {
    if (e.from === nodeId) s.add(e.to);
    if (e.to === nodeId) s.add(e.from);
  }
  return s;
}

/** With no focus, every edge is lit; with focus, only edges touching it. */
export function isEdgeLit(edge: { from: string; to: string }, focusId: string | null): boolean {
  if (!focusId) return true;
  return edge.from === focusId || edge.to === focusId;
}

/** With no focus, every node is lit; with focus, only the focus + its neighbours. */
export function isNodeLit(nodeId: string, focusId: string | null, connected: Set<string>): boolean {
  if (!focusId) return true;
  return connected.has(nodeId);
}
