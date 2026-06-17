import { ordinal, rewardLine } from '../../../src/lib/contribute/reward';

describe('ordinal', () => {
  it('suffixes 1/2/3 correctly', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
  });

  it('handles the 11–13 exceptions', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
  });

  it('handles larger numbers by last digit', () => {
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(42)).toBe('42nd');
    expect(ordinal(113)).toBe('113th');
  });
});

describe('rewardLine', () => {
  it('welcomes the first contribution', () => {
    expect(rewardLine(1)).toMatch(/first contribution/i);
    expect(rewardLine(0)).toMatch(/first contribution/i);
  });

  it('celebrates the running tally afterward', () => {
    expect(rewardLine(3)).toContain('3rd');
  });
});
