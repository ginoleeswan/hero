import { layoutNeighborhood } from '../../../src/lib/graph/forceLayout';

const nodes = [
  { id: 'S', isSubject: true },
  { id: 'A', isSubject: false },
  { id: 'B', isSubject: false },
  { id: 'C', isSubject: false },
];
const edges = [
  { from: 'S', to: 'A' },
  { from: 'S', to: 'B' },
  { from: 'S', to: 'C' },
  { from: 'A', to: 'B' },
];

describe('layoutNeighborhood', () => {
  it('pins the subject at the center', () => {
    const pos = layoutNeighborhood(nodes, edges);
    expect(pos.get('S')).toEqual({ x: 0, y: 0 });
  });
  it('is deterministic — same input yields identical positions', () => {
    const a = layoutNeighborhood(nodes, edges);
    const b = layoutNeighborhood(nodes, edges);
    for (const id of ['S', 'A', 'B', 'C']) expect(b.get(id)).toEqual(a.get(id));
  });
  it('keeps all nodes within bounds', () => {
    const pos = layoutNeighborhood(nodes, edges);
    for (const p of pos.values()) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1.2);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1.2);
    }
  });
  it('separates non-subject nodes (no two closer than a min distance)', () => {
    const pos = layoutNeighborhood(nodes, edges);
    const ids = ['A', 'B', 'C'];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.15);
      }
  });
});

describe('layoutNeighborhood — size-aware separation', () => {
  const build = (count: number, radius: number) => {
    const nodes = [
      { id: 's', isSubject: true, radius },
      ...Array.from({ length: count }, (_, i) => ({
        id: `n${i}`,
        isSubject: false,
        radius,
      })),
    ];
    // A dense neighbourhood: everyone tied to the subject, which is what pulls
    // them all into the middle and made big heads overlap.
    const edges = nodes.slice(1).map((n) => ({ from: 's', to: n.id }));
    return { nodes, edges, positions: layoutNeighborhood(nodes, edges) };
  };

  it('leaves no two drawn nodes overlapping', () => {
    const { nodes, positions } = build(20, 0.07);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id)!;
        const b = positions.get(nodes[j].id)!;
        const gap = Math.hypot(b.x - a.x, b.y - a.y);
        expect(gap).toBeGreaterThanOrEqual(
          (nodes[i].radius ?? 0) + (nodes[j].radius ?? 0) - 1e-6,
        );
      }
    }
  });

  it('keeps the subject pinned at the origin while separating', () => {
    const { positions } = build(16, 0.08);
    expect(positions.get('s')).toEqual({ x: 0, y: 0 });
  });

  it('still fits inside the canvas after separating', () => {
    const { positions } = build(20, 0.07);
    for (const p of positions.values()) {
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1.0001);
    }
  });

  it('stays deterministic with radii applied', () => {
    const a = [...build(12, 0.06).positions.entries()];
    const b = [...build(12, 0.06).positions.entries()];
    expect(a).toEqual(b);
  });
});
