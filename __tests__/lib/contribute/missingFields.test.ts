import { isBlankValue } from '../../../src/lib/contribute/missingFields';

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
