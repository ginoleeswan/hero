import { compareStats } from '../../src/lib/compare';

const statsA = { intelligence: '88', strength: '55', speed: '67', durability: '75', power: '74', combat: '85' };
const statsB = { intelligence: '56', strength: '26', speed: '27', durability: '44', power: '35', combat: '76' };

describe('compareStats', () => {
  it('returns a result with 6 stat rows', () => {
    const result = compareStats('Spider-Man', statsA, 'Batman', statsB);
    expect(result.stats).toHaveLength(6);
  });

  it('correctly identifies the winner per stat', () => {
    const result = compareStats('Spider-Man', statsA, 'Batman', statsB);
    expect(result.stats[0].winner).toBe('A'); // intelligence 88 vs 56
    expect(result.stats[5].winner).toBe('A'); // combat 85 vs 76
  });

  it('correctly counts wins', () => {
    const result = compareStats('Spider-Man', statsA, 'Batman', statsB);
    expect(result.winsA).toBe(6);
    expect(result.winsB).toBe(0);
  });

  it('builds a verdict string using the winner name', () => {
    const result = compareStats('Spider-Man', statsA, 'Batman', statsB);
    expect(result.verdict).toContain('Spider-Man');
  });

  it('returns an even verdict on equal stats', () => {
    const equal = { intelligence: '50', strength: '50', speed: '50', durability: '50', power: '50', combat: '50' };
    const result = compareStats('A', equal, 'B', equal);
    expect(result.verdict).toBe('These two are evenly matched');
  });

  it('treats missing/null stats as 0', () => {
    const empty = {};
    const result = compareStats('A', empty as Record<string, string>, 'B', statsA);
    expect(result.winsB).toBe(6);
  });
});
