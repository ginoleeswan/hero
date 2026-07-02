import { statDisplayValue } from '../../src/components/web/character/PowerStatCell';

describe('statDisplayValue', () => {
  it('starts at 0 and ends exactly at the target', () => {
    expect(statDisplayValue(0, 94)).toBe(0);
    expect(statDisplayValue(1, 94)).toBe(94);
  });
  it('eases out — past halfway progress the value exceeds half the target', () => {
    expect(statDisplayValue(0.5, 100)).toBeGreaterThan(50);
  });
  it('is monotonic and integer-valued', () => {
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = statDisplayValue(Math.min(p, 1), 87);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
