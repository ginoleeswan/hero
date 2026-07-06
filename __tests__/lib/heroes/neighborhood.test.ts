import { subjectKind } from '../../../src/lib/db/heroes/neighborhood';

const edges = [
  { from: 'A', to: 'B', kind: 'enemy' as const },
  { from: 'C', to: 'A', kind: 'ally' as const },
  { from: 'B', to: 'C', kind: 'teammate' as const },
];

describe('subjectKind', () => {
  it('finds the kind of an edge incident to the subject, either direction', () => {
    expect(subjectKind(edges, 'A', 'B')).toBe('enemy');
    expect(subjectKind(edges, 'A', 'C')).toBe('ally');
  });
  it('returns null when the node has no direct edge to the subject', () => {
    // the subject itself has no self-edge
    expect(subjectKind(edges, 'A', 'A')).toBeNull();
  });
});
