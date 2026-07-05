import { buildProfileStats } from '../../../src/lib/profile/stats';

describe('buildProfileStats', () => {
  it('returns empty for a brand-new user with all zeros (loaded)', () => {
    const stats = buildProfileStats({
      savedCount: 0,
      favouritesLoading: false,
      battle: null,
      badgesEarned: 0,
    });
    expect(stats).toEqual([]);
  });

  it('shows a loading Saved tile while favourites load, even at 0', () => {
    const stats = buildProfileStats({
      savedCount: 0,
      favouritesLoading: true,
      battle: null,
      badgesEarned: 0,
    });
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ key: 'saved', loading: true });
  });

  it('includes saved + badges when present, in fixed order', () => {
    const stats = buildProfileStats({
      savedCount: 12,
      favouritesLoading: false,
      battle: null,
      badgesEarned: 7,
    });
    expect(stats.map((s) => s.key)).toEqual(['saved', 'badges']);
    expect(stats[0]).toMatchObject({ key: 'saved', value: '12', loading: undefined });
    expect(stats[1]).toMatchObject({ key: 'badges', value: '7' });
  });

  it('expands battle into battles/streak/crowd, dropping zero components', () => {
    const stats = buildProfileStats({
      savedCount: 3,
      favouritesLoading: false,
      battle: { total: 34, agreePct: 83, streak: 0 },
      badgesEarned: 0,
    });
    expect(stats.map((s) => s.key)).toEqual(['saved', 'battles', 'crowd']);
    const crowd = stats.find((s) => s.key === 'crowd');
    expect(crowd?.value).toBe('83%');
  });

  it('full house keeps the fixed order saved,battles,streak,crowd,badges', () => {
    const stats = buildProfileStats({
      savedCount: 12,
      favouritesLoading: false,
      battle: { total: 34, agreePct: 83, streak: 5 },
      badgesEarned: 7,
    });
    expect(stats.map((s) => s.key)).toEqual(['saved', 'battles', 'streak', 'crowd', 'badges']);
  });
});
