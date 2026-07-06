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

/** Number of edges incident to a node. */
export function nodeDegree(edges: { from: string; to: string }[], nodeId: string): number {
  let n = 0;
  for (const e of edges) if (e.from === nodeId || e.to === nodeId) n++;
  return n;
}

/** Nodes adjacent to BOTH the subject and the focus (the "who they both know"),
 *  excluding the subject and focus themselves. */
export function sharedWithSubject(
  edges: { from: string; to: string }[],
  subjectId: string,
  focusId: string,
): Set<string> {
  if (focusId === subjectId) return new Set();
  const nb = (id: string) => {
    const s = new Set<string>();
    for (const e of edges) {
      if (e.from === id) s.add(e.to);
      if (e.to === id) s.add(e.from);
    }
    return s;
  };
  const subj = nb(subjectId);
  const foc = nb(focusId);
  const out = new Set<string>();
  for (const id of foc) if (subj.has(id) && id !== subjectId && id !== focusId) out.add(id);
  return out;
}
