import { computeBadges, earnedCount, type BadgeInput } from '../../../src/lib/profile/badges';

const NOW = new Date('2026-06-17T00:00:00Z').getTime();

const base: BadgeInput = {
  accountCreatedAt: null,
  favourites: 0,
  votes: 0,
  streak: 0,
  topPublisher: null,
};

const find = (input: Partial<BadgeInput>, id: string, now = NOW) =>
  computeBadges({ ...base, ...input }, now).find((b) => b.id === id)!;

describe('computeBadges', () => {
  it('earns Day One whenever the account exists', () => {
    expect(find({ accountCreatedAt: '2026-06-01T00:00:00Z' }, 'day-one').earned).toBe(true);
    expect(find({ accountCreatedAt: null }, 'day-one').earned).toBe(false);
  });

  it('earns Supporter only from the stored flag (and defaults locked)', () => {
    expect(find({ isSupporter: true }, 'supporter').earned).toBe(true);
    expect(find({ isSupporter: false }, 'supporter').earned).toBe(false);
    expect(find({}, 'supporter').earned).toBe(false); // omitted → locked
  });

  it('earns Veteran only after 180 days of tenure', () => {
    expect(find({ accountCreatedAt: '2026-06-01T00:00:00Z' }, 'veteran').earned).toBe(false);
    expect(find({ accountCreatedAt: '2025-01-01T00:00:00Z' }, 'veteran').earned).toBe(true);
  });

  it('earns Curator at 10 favourites and Archivist at 50', () => {
    expect(find({ favourites: 9 }, 'curator').earned).toBe(false);
    expect(find({ favourites: 10 }, 'curator').earned).toBe(true);
    expect(find({ favourites: 49 }, 'archivist').earned).toBe(false);
    expect(find({ favourites: 50 }, 'archivist').earned).toBe(true);
  });

  it('earns Oracle at 10 votes and On Fire at a 3-day streak', () => {
    expect(find({ votes: 10 }, 'oracle').earned).toBe(true);
    expect(find({ streak: 3 }, 'on-fire').earned).toBe(true);
    expect(find({ streak: 2 }, 'on-fire').earned).toBe(false);
  });

  it('labels the loyalty badge by top publisher and needs 5 favourites', () => {
    expect(find({ topPublisher: 'Marvel', favourites: 5 }, 'loyalist').label).toBe(
      'Marvel Loyalist',
    );
    expect(find({ topPublisher: 'DC', favourites: 5 }, 'loyalist').label).toBe('DC Devotee');
    expect(find({ topPublisher: 'Image', favourites: 5 }, 'loyalist').label).toBe('Image Fan');
    expect(find({ topPublisher: 'Marvel', favourites: 4 }, 'loyalist').earned).toBe(false);
  });

  it('exposes progress on locked count-based badges', () => {
    expect(find({ favourites: 4 }, 'curator').progress).toEqual({ current: 4, target: 10 });
  });

  it('sorts earned badges ahead of locked ones', () => {
    const badges = computeBadges(
      { ...base, accountCreatedAt: '2026-06-01T00:00:00Z', favourites: 12 },
      NOW,
    );
    const firstLocked = badges.findIndex((b) => !b.earned);
    const lastEarned = badges.map((b) => b.earned).lastIndexOf(true);
    expect(lastEarned).toBeLessThan(firstLocked);
  });
});

describe('earnedCount', () => {
  it('counts only earned badges', () => {
    const badges = computeBadges(
      { ...base, accountCreatedAt: '2026-06-01T00:00:00Z', favourites: 10, votes: 10 },
      NOW,
    );
    // day-one, curator, oracle earned; veteran/archivist/on-fire/loyalist not.
    expect(earnedCount(badges)).toBe(3);
  });
});
