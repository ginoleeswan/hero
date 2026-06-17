import {
  isBlankValue,
  missingFields,
  presentFields,
} from '../../../src/lib/contribute/missingFields';

describe('isBlankValue', () => {
  it('treats null/undefined/empty and DB sentinels as blank', () => {
    expect(isBlankValue(null)).toBe(true);
    expect(isBlankValue(undefined)).toBe(true);
    expect(isBlankValue('')).toBe(true);
    expect(isBlankValue('   ')).toBe(true);
    expect(isBlankValue('-')).toBe(true);
    expect(isBlankValue('null')).toBe(true);
  });

  it('treats real values as present', () => {
    expect(isBlankValue('Krypton')).toBe(false);
    expect(isBlankValue('0')).toBe(false);
  });
});

describe('missingFields / presentFields', () => {
  it('splits editable fields by presence', () => {
    const values = {
      origin: 'Born on Krypton',
      occupation: '',
      base: null,
      place_of_birth: 'Krypton',
      first_appearance: '-',
      full_name: 'Kal-El',
    };
    const missing = missingFields(values).map((f) => f.field);
    const present = presentFields(values).map((f) => f.field);
    expect(missing.sort()).toEqual(['base', 'first_appearance', 'occupation']);
    expect(present.sort()).toEqual(['full_name', 'origin', 'place_of_birth']);
  });

  it('reports every editable field missing for an empty hero', () => {
    expect(missingFields({}).length).toBe(6);
    expect(presentFields({}).length).toBe(0);
  });
});
