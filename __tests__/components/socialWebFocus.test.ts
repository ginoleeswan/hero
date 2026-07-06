import { connectedIds, isEdgeLit, isNodeLit } from '../../src/components/character/socialWebFocus';

const edges = [
  { from: 'S', to: 'A' },
  { from: 'S', to: 'B' },
  { from: 'A', to: 'C' },
];

describe('socialWebFocus', () => {
  it('connectedIds returns the node plus its direct neighbours', () => {
    expect(connectedIds(edges, 'S')).toEqual(new Set(['S', 'A', 'B']));
    expect(connectedIds(edges, 'A')).toEqual(new Set(['A', 'S', 'C']));
  });
  it('isEdgeLit: all lit with no focus; only incident lit with focus', () => {
    expect(isEdgeLit(edges[0], null)).toBe(true);
    expect(isEdgeLit({ from: 'S', to: 'A' }, 'S')).toBe(true);
    expect(isEdgeLit({ from: 'A', to: 'C' }, 'S')).toBe(false);
  });
  it('isNodeLit: all lit with no focus; only connected lit with focus', () => {
    const conn = connectedIds(edges, 'S');
    expect(isNodeLit('C', null, conn)).toBe(true);
    expect(isNodeLit('A', 'S', conn)).toBe(true);
    expect(isNodeLit('C', 'S', conn)).toBe(false);
  });
});
