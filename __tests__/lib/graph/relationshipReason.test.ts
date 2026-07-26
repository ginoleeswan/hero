import { describeRelationship } from '../../../src/lib/graph/relationshipReason';

const JL = ['Justice League of America', 'House of El', 'Kryptonians'];

describe('describeRelationship', () => {
  it('names the rosters two teammates actually share', () => {
    const r = describeRelationship('teammate', 'Supergirl', JL, ['House of El', 'Daily Planet'], 3);
    expect(r.sharedTeams).toEqual(['House of El']);
    expect(r.summary).toBe('Served alongside Supergirl in House of El.');
  });

  it('lists two rosters and counts the rest', () => {
    const r = describeRelationship('teammate', 'Supergirl', JL, JL, 0);
    expect(r.summary).toBe(
      'Served alongside Supergirl in Justice League of America and House of El and 1 more.',
    );
  });

  // Shared history makes an enmity more interesting, not less — say so.
  it('frames a shared roster as tension when the tie is enmity', () => {
    const r = describeRelationship('enemy', 'Supergirl', JL, ['House of El'], 2);
    expect(r.summary).toBe('Opposed to Supergirl, despite both serving in House of El.');
  });

  it('falls back to mutual connections when no roster is shared', () => {
    const r = describeRelationship('ally', 'Batman', ['Justice League'], ['Teen Titans'], 4);
    expect(r.sharedTeams).toEqual([]);
    expect(r.summary).toBe('An ally of Batman, with 4 mutual connections in common.');
  });

  it('singularises a lone mutual connection', () => {
    const r = describeRelationship('enemy', 'Batman', null, null, 1);
    expect(r.summary).toBe('An enemy of Batman, with 1 mutual connection in common.');
  });

  // Better to say nothing than to invent a reason the data can't support.
  it('stays silent when there is nothing honest to say', () => {
    expect(describeRelationship('enemy', 'Batman', null, null, 0).summary).toBeNull();
    expect(describeRelationship(null, 'Batman', [], [], 0).summary).toBeNull();
  });

  // Kin outrank the roster: a relative who also served on a team is described
  // as family FIRST, not as a generic teammate, which is what the old copy did
  // for every non-enemy kind.
  it('leads with kinship for family, and keeps the roster as supporting detail', () => {
    const r = describeRelationship('family', 'Superman', ['Justice League'], ['Justice League'], 3);
    expect(r.summary).toBe('Family to Superman, and served alongside them in Justice League.');
  });

  it('describes family with no shared roster via mutuals', () => {
    const r = describeRelationship('family', 'Superman', null, null, 2);
    expect(r.summary).toBe('Family to Superman, with 2 mutual connections in common.');
  });

  // The pill already reads "Family", so an unsupported sentence adds nothing.
  it('stays silent for family when there is no roster and no mutual', () => {
    expect(describeRelationship('family', 'Superman', null, null, 0).summary).toBeNull();
  });

  // A named kin role is the one tie the data states outright rather than infers
  // from a shared roster, so it leads — and it's worth saying even bare.
  it('names the kin role above everything else it could say', () => {
    expect(describeRelationship('family', 'Superman', null, null, 0, 'Cousin').summary).toBe(
      "Superman's cousin.",
    );
    expect(describeRelationship('family', 'Superman', null, null, 3, 'Spouse').summary).toBe(
      "Superman's spouse, with 3 mutual connections in common.",
    );
    expect(
      describeRelationship(
        'family',
        'Superman',
        ['Justice League'],
        ['Justice League'],
        0,
        'Parent',
      ).summary,
    ).toBe("Superman's parent, and served alongside them in Justice League.");
  });

  // Only kin carry a role; a stray value must not rewrite an enemy's sentence.
  it('ignores a relation on a non-family tie', () => {
    expect(describeRelationship('enemy', 'Batman', null, null, 2, 'Cousin').summary).toBe(
      'An enemy of Batman, with 2 mutual connections in common.',
    );
  });

  it('tolerates missing and empty team arrays', () => {
    expect(describeRelationship('teammate', 'X', null, ['A'], 0).sharedTeams).toEqual([]);
    expect(describeRelationship('teammate', 'X', ['A'], null, 0).sharedTeams).toEqual([]);
  });
});
