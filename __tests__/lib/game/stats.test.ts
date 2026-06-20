import {
  EMPTY_STATS,
  recordStats,
  winPct,
  beatPercent,
  type DailyDistribution,
} from '../../../src/lib/game/stats';

describe('recordStats', () => {
  it('tallies a win into the distribution and is idempotent per day', () => {
    const a = recordStats(EMPTY_STATS, '2026-06-19', true, 2, 4);
    expect(a.played).toBe(1);
    expect(a.wins).toBe(1);
    expect(a.dist[2]).toBe(1);
    // re-recording the same day is a no-op
    expect(recordStats(a, '2026-06-19', true, 2, 4)).toBe(a);
  });

  it('counts a loss as played-but-not-won', () => {
    const a = recordStats(EMPTY_STATS, '2026-06-19', false, 4, 4);
    const b = recordStats(a, '2026-06-20', true, 1, 4);
    expect(b.played).toBe(2);
    expect(b.wins).toBe(1);
    expect(b.dist[1]).toBe(1);
    expect(winPct(b)).toBe(50);
  });
});

describe('beatPercent', () => {
  const dist: DailyDistribution = {
    total: 10,
    wins: 7,
    losses: 3,
    dist: [
      { g: 1, c: 1 },
      { g: 2, c: 2 },
      { g: 3, c: 4 },
    ],
  };
  it('counts losers + slower winners as beaten', () => {
    // won in 2: beat the 3 losers + the 4 who took 3 guesses = 7/10
    expect(beatPercent(dist, true, 2)).toBe(70);
  });
  it('is null on a loss or with too few players', () => {
    expect(beatPercent(dist, false, 4)).toBeNull();
    expect(beatPercent({ total: 1, wins: 1, losses: 0, dist: [] }, true, 1)).toBeNull();
    expect(beatPercent(null, true, 2)).toBeNull();
  });
});
