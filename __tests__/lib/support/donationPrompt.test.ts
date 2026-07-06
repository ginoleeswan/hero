import {
  shouldPrompt,
  detectMilestone,
  DEFAULT_STATE,
  type DonationPromptState,
} from '../../../src/lib/support/donationPrompt';

const DAY = 86_400_000;
const base: DonationPromptState = {
  lastShownAt: null,
  lastDismissedAt: null,
  lastConvertedAt: null,
  lastSeenTier: 'Fan',
  seenBadgeIds: ['day-one'],
};

describe('shouldPrompt', () => {
  const now = 1_000 * DAY;
  it('allows when never shown or acted on', () => {
    expect(shouldPrompt(base, now)).toBe(true);
  });
  it('blocks within 30 days of last show', () => {
    expect(shouldPrompt({ ...base, lastShownAt: now - 20 * DAY }, now)).toBe(false);
    expect(shouldPrompt({ ...base, lastShownAt: now - 31 * DAY }, now)).toBe(true);
  });
  it('blocks for 90 days after a dismiss', () => {
    expect(shouldPrompt({ ...base, lastDismissedAt: now - 60 * DAY }, now)).toBe(false);
    expect(shouldPrompt({ ...base, lastDismissedAt: now - 91 * DAY }, now)).toBe(true);
  });
  it('blocks for 90 days after a convert', () => {
    expect(shouldPrompt({ ...base, lastConvertedAt: now - 60 * DAY }, now)).toBe(false);
  });
});

describe('detectMilestone', () => {
  it('seeds silently on first run (null tier)', () => {
    expect(
      detectMilestone(
        { lastSeenTier: null, seenBadgeIds: [] },
        { tier: 'Collector', earnedBadgeIds: ['day-one'] },
      ),
    ).toBeNull();
  });
  it('fires tier on a level-up', () => {
    expect(
      detectMilestone(
        { lastSeenTier: 'Fan', seenBadgeIds: ['day-one'] },
        { tier: 'Collector', earnedBadgeIds: ['day-one'] },
      ),
    ).toBe('tier');
  });
  it('does not fire on a tier drop or same tier', () => {
    expect(
      detectMilestone(
        { lastSeenTier: 'Curator', seenBadgeIds: ['day-one'] },
        { tier: 'Collector', earnedBadgeIds: ['day-one'] },
      ),
    ).toBeNull();
  });
  it('fires badge on a new earned badge', () => {
    expect(
      detectMilestone(
        { lastSeenTier: 'Fan', seenBadgeIds: ['day-one'] },
        { tier: 'Fan', earnedBadgeIds: ['day-one', 'veteran'] },
      ),
    ).toBe('badge');
  });
  it('returns null when nothing changed', () => {
    expect(
      detectMilestone(
        { lastSeenTier: 'Fan', seenBadgeIds: ['day-one'] },
        { tier: 'Fan', earnedBadgeIds: ['day-one'] },
      ),
    ).toBeNull();
  });
});

it('DEFAULT_STATE has null timestamps and empty seen sets', () => {
  expect(DEFAULT_STATE).toEqual({
    lastShownAt: null,
    lastDismissedAt: null,
    lastConvertedAt: null,
    lastSeenTier: null,
    seenBadgeIds: [],
  });
});
