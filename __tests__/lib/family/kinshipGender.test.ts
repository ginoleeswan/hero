import { headShapeForRole } from '../../../src/lib/family/kinshipGender';

describe('headShapeForRole', () => {
  it.each(['mother', 'sister', 'aunt', 'wife', 'niece', 'daughter', 'grandmother'])(
    'reads %s as feminine',
    (role) => expect(headShapeForRole(role)).toBe('feminine'),
  );

  it.each(['father', 'brother', 'uncle', 'husband', 'nephew', 'son', 'grandfather'])(
    'reads %s as masculine',
    (role) => expect(headShapeForRole(role)).toBe('masculine'),
  );

  it('handles the qualifiers the source data actually uses', () => {
    expect(headShapeForRole('mother, deceased')).toBe('feminine');
    expect(headShapeForRole('adoptive father')).toBe('masculine');
    expect(headShapeForRole('ex-wife')).toBe('feminine');
    expect(headShapeForRole('half-brother')).toBe('masculine');
    expect(headShapeForRole('mother-in-law')).toBe('feminine');
  });

  // The trap: "maternal" describes WHICH SIDE of the family, not the person. A
  // maternal grandfather is a man, so the prefix must never be a gender signal.
  it('does not treat maternal/paternal as a gender signal', () => {
    expect(headShapeForRole('maternal grandfather')).toBe('masculine');
    expect(headShapeForRole('paternal grandmother')).toBe('feminine');
    expect(headShapeForRole('maternal ancestor')).toBe('neutral');
  });

  it('does not let a substring leak across words', () => {
    // "grandmother" contains "mother"; it must resolve as one word, not two.
    expect(headShapeForRole('grandmother')).toBe('feminine');
    expect(headShapeForRole('grandson')).toBe('masculine');
  });

  // Where the data doesn't say, we don't guess — never from a name.
  it.each(['cousin', 'ancestor', 'clone', 'other', 'deceased', '', null, undefined])(
    'stays neutral for %s',
    (role) => expect(headShapeForRole(role as string | null)).toBe('neutral'),
  );

  it('stays neutral when the text names both', () => {
    expect(headShapeForRole("mother's brother")).toBe('neutral');
  });
});
