import { getRivals } from '../../src/constants/rivals';

describe('getRivals', () => {
  it('returns known rivals for Batman (id 70)', () => {
    const rivals = getRivals('70');
    expect(rivals.length).toBeGreaterThan(0);
    expect(rivals).not.toContain('70'); // never returns self
  });

  it('returns empty array for unknown hero', () => {
    expect(getRivals('999999')).toEqual([]);
  });
});
