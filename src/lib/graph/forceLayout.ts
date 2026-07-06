/** Deterministic 0–1 hash of a string id → seeds initial placement. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Tiny deterministic force sim: node repulsion + link springs + centering,
 * subject pinned at origin. Fixed iteration count, seeded by id hash so a
 * character's web is stable across visits. Normalized to roughly [-1,1].
 */
export function layoutNeighborhood(
  nodes: { id: string; isSubject: boolean }[],
  edges: { from: string; to: string }[],
  opts?: { iterations?: number },
): Map<string, { x: number; y: number }> {
  const iterations = opts?.iterations ?? 300;
  const pos = new Map<string, { x: number; y: number }>();
  const N = nodes.length;
  nodes.forEach((n) => {
    if (n.isSubject) {
      pos.set(n.id, { x: 0, y: 0 });
    } else {
      // deterministic ring-ish seed
      const a = hash01(n.id) * Math.PI * 2;
      const r = 0.4 + 0.4 * hash01(n.id + 'r');
      pos.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  });

  const REPULSE = 0.02;
  const SPRING = 0.02;
  const REST = 0.5;
  const CENTER = 0.005;

  for (let it = 0; it < iterations; it++) {
    const force = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    // repulsion
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const a = pos.get(nodes[i].id)!;
        const b = pos.get(nodes[j].id)!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy || 0.0001;
        const f = REPULSE / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        force.get(nodes[i].id)!.x += fx;
        force.get(nodes[i].id)!.y += fy;
        force.get(nodes[j].id)!.x -= fx;
        force.get(nodes[j].id)!.y -= fy;
      }
    // springs
    for (const e of edges) {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      const f = SPRING * (d - REST);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      force.get(e.from)!.x += fx;
      force.get(e.from)!.y += fy;
      force.get(e.to)!.x -= fx;
      force.get(e.to)!.y -= fy;
    }
    // integrate (subject pinned)
    for (const n of nodes) {
      if (n.isSubject) continue;
      const p = pos.get(n.id)!;
      const f = force.get(n.id)!;
      p.x += f.x - p.x * CENTER;
      p.y += f.y - p.y * CENTER;
    }
  }

  // normalize into [-1,1] keeping subject at origin
  let max = 0.0001;
  for (const p of pos.values()) max = Math.max(max, Math.abs(p.x), Math.abs(p.y));
  const scale = max > 1 ? 1 / max : 1;
  for (const p of pos.values()) {
    p.x *= scale;
    p.y *= scale;
  }
  return pos;
}
