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
