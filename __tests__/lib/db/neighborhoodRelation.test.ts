import {
  relationLabel,
  subjectBlurb,
  subjectKind,
  subjectRelation,
  type NeighborEdge,
} from '../../../src/lib/db/heroes/neighborhood';

const SUBJECT = 'superman';

describe('relationLabel', () => {
  it('renders the stored roles in reader English', () => {
    expect(relationLabel('cousin')).toBe('Cousin');
    expect(relationLabel('aunt_uncle')).toBe('Aunt or uncle');
    expect(relationLabel('niece_nephew')).toBe('Niece or nephew');
  });

  // 'other' is a real stored value that says only "related somehow"; inventing
  // a closer word for it would overstate what the row claims.
  it('falls back to the generic word for an unspecific role', () => {
    expect(relationLabel('other')).toBe('Family');
  });

  it('returns null rather than guessing at anything it does not know', () => {
    expect(relationLabel(null)).toBeNull();
    expect(relationLabel(undefined)).toBeNull();
    expect(relationLabel('step_cousin_twice_removed')).toBeNull();
  });
});

describe('subjectRelation', () => {
  const edges: NeighborEdge[] = [
    { from: SUBJECT, to: 'supergirl', kind: 'family', relation: 'cousin' },
    { from: SUBJECT, to: 'lois', kind: 'family', relation: 'spouse' },
    { from: SUBJECT, to: 'lex', kind: 'enemy' },
  ];

  it('names what the neighbour is to the subject', () => {
    expect(subjectRelation(edges, SUBJECT, 'supergirl')).toBe('Cousin');
    expect(subjectRelation(edges, SUBJECT, 'lois')).toBe('Spouse');
  });

  it('has nothing to say about a tie that is not kin', () => {
    expect(subjectRelation(edges, SUBJECT, 'lex')).toBeNull();
    expect(subjectKind(edges, SUBJECT, 'lex')).toBe('enemy');
  });

  // The stored row means "`to` is `relation` to `from`". Read from the far end
  // the same row would name the SUBJECT's role instead — Jor-El's page would
  // claim Superman is his parent — so a backwards edge is declined outright
  // rather than reported with the wrong sense.
  it('refuses a family edge stored in the opposite direction', () => {
    const backwards: NeighborEdge[] = [
      { from: 'jor-el', to: SUBJECT, kind: 'family', relation: 'child' },
    ];
    expect(subjectRelation(backwards, SUBJECT, 'jor-el')).toBeNull();
    // The kind still resolves from either end — only the wording is directional.
    expect(subjectKind(backwards, SUBJECT, 'jor-el')).toBe('family');
  });

  it('reads the curated note from either end of the pair', () => {
    const withBlurb: NeighborEdge[] = [
      { from: SUBJECT, to: 'lex', kind: 'enemy', blurb: 'A written note.' },
      { from: 'lois', to: SUBJECT, kind: 'family', relation: 'spouse', blurb: 'Another note.' },
    ];
    // Unlike `relation`, a note describes the PAIR and so is not directional.
    expect(subjectBlurb(withBlurb, SUBJECT, 'lex')).toBe('A written note.');
    expect(subjectBlurb(withBlurb, SUBJECT, 'lois')).toBe('Another note.');
  });

  it('has no note for an uncurated pair', () => {
    expect(subjectBlurb(edges, SUBJECT, 'supergirl')).toBeNull();
    expect(subjectBlurb(edges, SUBJECT, 'batman')).toBeNull();
  });

  it('is quiet for the subject itself and for strangers', () => {
    expect(subjectRelation(edges, SUBJECT, SUBJECT)).toBeNull();
    expect(subjectRelation(edges, SUBJECT, 'batman')).toBeNull();
  });

  it('tolerates a family edge with no relation recorded', () => {
    const bare: NeighborEdge[] = [{ from: SUBJECT, to: 'kara', kind: 'family' }];
    expect(subjectRelation(bare, SUBJECT, 'kara')).toBeNull();
    expect(subjectKind(bare, SUBJECT, 'kara')).toBe('family');
  });
});
