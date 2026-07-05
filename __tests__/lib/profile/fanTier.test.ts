import { fanScore, fanTier, tierProgress } from '../../../src/lib/profile/fanTier';

describe('fanScore', () => {
  it('weights badges 3x and sums the rest', () => {
    expect(fanScore({ saves: 1, votes: 8, contributions: 38, badges: 1 })).toBe(50);
    expect(fanScore({ saves: 0, votes: 0, contributions: 0, badges: 0 })).toBe(0);
  });
});

describe('fanTier', () => {
  it('a brand-new user is a Newcomer', () => {
    expect(fanTier({ saves: 0, votes: 0, contributions: 0, badges: 0 }).name).toBe('Newcomer');
  });

  it('crosses into Fan at 10 and Collector at 40', () => {
    expect(fanTier({ saves: 10, votes: 0, contributions: 0, badges: 0 }).name).toBe('Fan');
    expect(fanTier({ saves: 9, votes: 0, contributions: 0, badges: 0 }).name).toBe('Newcomer');
    expect(fanTier({ saves: 0, votes: 0, contributions: 40, badges: 0 }).name).toBe('Collector');
  });

  it('a prolific contributor lands at Collector', () => {
    const tier = fanTier({ saves: 1, votes: 8, contributions: 38, badges: 1 });
    expect(tier.name).toBe('Collector');
    expect(tier.score).toBe(50);
  });

  it('caps at Legend for very high activity', () => {
    expect(fanTier({ saves: 100, votes: 100, contributions: 100, badges: 10 }).name).toBe('Legend');
  });
});

describe('tierProgress', () => {
  it('points to the next tier with remaining count', () => {
    // score 50 → Collector (floor 40), next Curator (100)
    const p = tierProgress({ saves: 1, votes: 8, contributions: 38, badges: 1 });
    expect(p.next).toBe('Curator');
    expect(p.remaining).toBe(50);
    expect(p.pct).toBeCloseTo(10 / 60, 5);
  });

  it('is maxed at Legend', () => {
    const p = tierProgress({ saves: 100, votes: 100, contributions: 100, badges: 10 });
    expect(p.next).toBeNull();
    expect(p.remaining).toBe(0);
  });
});
