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
  nodes: { id: string; isSubject: boolean; radius?: number }[],
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

  separate(nodes, pos);
  return pos;
}

/**
 * Push overlapping nodes apart until none collide.
 *
 * The main sim's repulsion is a point force — it has no idea how big anything is
 * drawn. Once node size varies with fame (34→64px) that gap shows: big heads in
 * the crowded centre sit on top of each other, and overlapping cut-out heads read
 * as one smudged blob rather than as separate characters.
 *
 * Callers pass each node's drawn radius in the same normalized units as the
 * positions. Nodes with no radius are treated as points, so existing callers keep
 * their old behaviour exactly.
 */
function separate(
  nodes: { id: string; isSubject: boolean; radius?: number }[],
  pos: Map<string, { x: number; y: number }>,
): void {
  const sized = nodes.filter((n) => (n.radius ?? 0) > 0);
  if (sized.length < 2) return;

  // Pull everything in first so the spreading has somewhere to go — otherwise
  // separation just pushes the outermost nodes off the canvas.
  for (const p of pos.values()) {
    p.x *= 0.82;
    p.y *= 0.82;
  }

  const PAD = 0.012; // breathing room between silhouettes
  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 0; i < sized.length; i++) {
      for (let j = i + 1; j < sized.length; j++) {
        const a = pos.get(sized[i].id)!;
        const b = pos.get(sized[j].id)!;
        const min = (sized[i].radius ?? 0) + (sized[j].radius ?? 0) + PAD;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        // Exactly coincident nodes have no direction to separate along; nudge
        // them apart deterministically so the loop can get a grip.
        if (d < 1e-6) {
          dx = hash01(sized[i].id + sized[j].id) - 0.5;
          dy = hash01(sized[j].id + sized[i].id) - 0.5;
          d = Math.hypot(dx, dy) || 1e-6;
        }
        const push = (min - d) / 2;
        const ux = (dx / d) * push;
        const uy = (dy / d) * push;
        // The subject is pinned at the centre, so its partner absorbs the whole
        // correction rather than dragging the anchor off origin.
        if (sized[i].isSubject) {
          b.x += ux * 2;
          b.y += uy * 2;
        } else if (sized[j].isSubject) {
          a.x -= ux * 2;
          a.y -= uy * 2;
        } else {
          a.x -= ux;
          a.y -= uy;
          b.x += ux;
          b.y += uy;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Anything shoved past the canvas edge comes back in. Radii are small relative
  // to the field, so this reintroduces at most a slight touch, never the blob.
  for (const n of sized) {
    const p = pos.get(n.id)!;
    const m = Math.hypot(p.x, p.y);
    if (m > 1) {
      p.x /= m;
      p.y /= m;
    }
  }
}
