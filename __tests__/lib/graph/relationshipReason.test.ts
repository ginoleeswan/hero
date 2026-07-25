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

  it('tolerates missing and empty team arrays', () => {
    expect(describeRelationship('teammate', 'X', null, ['A'], 0).sharedTeams).toEqual([]);
    expect(describeRelationship('teammate', 'X', ['A'], null, 0).sharedTeams).toEqual([]);
  });
});
