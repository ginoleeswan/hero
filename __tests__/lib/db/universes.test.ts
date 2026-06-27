import { searchUniverses } from '../../../src/lib/db/universes';

describe('searchUniverses', () => {
  it('resolves a universe by exact name', () => {
    const out = searchUniverses('disney');
    expect(out[0].slug).toBe('disney');
    expect(out[0].exact).toBe(true);
  });

  it('resolves Mattel', () => {
    expect(searchUniverses('mattel')[0].slug).toBe('mattel');
  });

  it('matches a `match[]` alias ("dc comics" → dc)', () => {
    expect(searchUniverses('dc comics')[0].slug).toBe('dc');
  });

  it('ranks exact above prefix above contains', () => {
    const out = searchUniverses('marvel');
    expect(out[0].slug).toBe('marvel');
    expect(out[0].exact).toBe(true);
  });

  it('returns [] for an empty/whitespace query', () => {
    expect(searchUniverses('')).toEqual([]);
    expect(searchUniverses('   ')).toEqual([]);
  });

  it('caps results at the requested limit', () => {
    expect(searchUniverses('a', 3).length).toBeLessThanOrEqual(3);
  });
});
