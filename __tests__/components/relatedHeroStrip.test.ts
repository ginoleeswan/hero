import { monogram } from '../../src/components/RelatedHeroStrip';

describe('monogram', () => {
  it('takes the initials of the first two words', () => {
    expect(monogram('Lex Luthor')).toBe('LL');
    expect(monogram('Doctor Victor Von Doom')).toBe('DV');
  });
  it('single word → first two letters', () => {
    expect(monogram('Darkseid')).toBe('DA');
  });
  it('handles punctuation-heavy names', () => {
    expect(monogram('Two-Face')).toBe('TF');
  });
});
