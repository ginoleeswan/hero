import { subjectBlurb, subjectKind } from '../../../src/lib/db/heroes/neighborhood';

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

// A pair the RPC declined carries no blurb on its edge, and the focus card
// renders `blurb ?? summary`. So this must be null, not undefined — otherwise a
// declined pair would show an empty line instead of the templated fallback.
describe('subjectBlurb', () => {
  const withBlurb = [
    { from: 'A', to: 'B', kind: 'enemy' as const, blurb: 'A and B have history.' },
    { from: 'C', to: 'A', kind: 'ally' as const },
  ];

  it('returns the note on a subject-incident edge, either direction', () => {
    expect(subjectBlurb(withBlurb, 'A', 'B')).toBe('A and B have history.');
  });

  it('returns null for an edge the author declined', () => {
    expect(subjectBlurb(withBlurb, 'A', 'C')).toBeNull();
  });

  it('returns null when the two are not directly connected', () => {
    expect(subjectBlurb(withBlurb, 'B', 'C')).toBeNull();
  });

  it('returns null for the subject itself', () => {
    expect(subjectBlurb(withBlurb, 'A', 'A')).toBeNull();
  });
});
