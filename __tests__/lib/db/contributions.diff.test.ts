import {
  parsePgArrayLiteral,
  splitListInput,
  diffListValues,
  fieldTypeOf,
  fieldLabelOf,
} from '../../../src/lib/db/contributions';

describe('parsePgArrayLiteral', () => {
  it('parses a plain array literal', () => {
    expect(parsePgArrayLiteral('{Flight,Healing}')).toEqual(['Flight', 'Healing']);
  });

  it('unquotes elements with whitespace or special chars', () => {
    expect(parsePgArrayLiteral('{Telepathy,"Time travel",Healing}')).toEqual([
      'Telepathy',
      'Time travel',
      'Healing',
    ]);
  });

  it('unescapes embedded quotes and backslashes', () => {
    expect(parsePgArrayLiteral('{"say \\"hi\\""}')).toEqual(['say "hi"']);
  });

  it('drops NULL and empty, handles empty array', () => {
    expect(parsePgArrayLiteral('{}')).toEqual([]);
    expect(parsePgArrayLiteral('{A,NULL,B}')).toEqual(['A', 'B']);
  });

  it('falls back to line/comma split when not a literal', () => {
    expect(parsePgArrayLiteral('Flight\nHealing')).toEqual(['Flight', 'Healing']);
    expect(parsePgArrayLiteral(null)).toEqual([]);
  });
});

describe('splitListInput', () => {
  it('splits on newlines and commas, trims, drops blanks', () => {
    expect(splitListInput('Flight\nSuper strength, Healing\n\n')).toEqual([
      'Flight',
      'Super strength',
      'Healing',
    ]);
  });
  it('handles empty', () => {
    expect(splitListInput('')).toEqual([]);
    expect(splitListInput(null)).toEqual([]);
  });
});

describe('diffListValues', () => {
  it('computes added/removed against the stored array literal', () => {
    const d = diffListValues('{Flight,"Super strength"}', 'Flight\nHealing\nTelepathy');
    expect(d.added).toEqual(['Healing', 'Telepathy']);
    expect(d.removed).toEqual(['Super strength']);
    expect(d.next).toEqual(['Flight', 'Healing', 'Telepathy']);
  });

  it('is case-insensitive for membership', () => {
    const d = diffListValues('{flight}', 'Flight');
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  it('treats an empty old value as all-added', () => {
    const d = diffListValues(null, 'Flight\nHealing');
    expect(d.added).toEqual(['Flight', 'Healing']);
    expect(d.removed).toEqual([]);
  });
});

describe('fieldTypeOf / fieldLabelOf', () => {
  it('classifies known fields and labels them', () => {
    expect(fieldTypeOf('powers')).toBe('list');
    expect(fieldTypeOf('aliases')).toBe('list');
    expect(fieldTypeOf('intelligence')).toBe('stat');
    expect(fieldTypeOf('place_of_birth')).toBe('text');
    expect(fieldLabelOf('place_of_birth')).toBe('Place of birth');
    expect(fieldLabelOf('group_affiliation')).toBe('Affiliations');
  });

  it('returns null/echo for unknown fields', () => {
    expect(fieldTypeOf('not_a_field')).toBeNull();
    expect(fieldTypeOf(null)).toBeNull();
    expect(fieldLabelOf('mystery')).toBe('mystery');
  });
});
