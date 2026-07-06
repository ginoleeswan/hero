import {
  connectedIds,
  isEdgeLit,
  isNodeLit,
  nodeDegree,
  sharedWithSubject,
} from '../../src/components/character/socialWebFocus';

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

describe('nodeDegree', () => {
  it('counts incident edges in either direction', () => {
    expect(nodeDegree(edges, 'S')).toBe(2);
    expect(nodeDegree(edges, 'A')).toBe(2);
    expect(nodeDegree(edges, 'C')).toBe(1);
  });
});

describe('sharedWithSubject', () => {
  const e2 = [
    { from: 'S', to: 'A' },
    { from: 'S', to: 'X' },
    { from: 'F', to: 'A' }, // A is shared: adjacent to both S and F
    { from: 'F', to: 'Y' },
  ];
  it('returns nodes adjacent to both subject and focus', () => {
    expect(sharedWithSubject(e2, 'S', 'F')).toEqual(new Set(['A']));
  });
  it('is empty when focus is the subject', () => {
    expect(sharedWithSubject(e2, 'S', 'S')).toEqual(new Set());
  });
});
