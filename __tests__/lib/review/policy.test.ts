import {
  DEFAULT_REVIEW_PREFS,
  recordAsk,
  REVIEW_ARENA_COUNT,
  REVIEW_GRACE_MS,
  REVIEW_MAX_PER_YEAR,
  REVIEW_MIN_GAP_MS,
  REVIEW_STREAK,
  shouldRequestReview,
  triggerEarned,
  type ReviewPrefs,
} from '../../../src/lib/review/policy';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
/** Long past the grace period, so only the rule under test can fail. */
const OLD_INSTALL: ReviewPrefs = { askedAt: [], firstSeenAt: NOW - 400 * DAY };

function ask(over: Partial<Parameters<typeof shouldRequestReview>[0]> = {}) {
  return shouldRequestReview({
    trigger: 'daily_streak',
    prefs: OLD_INSTALL,
    streak: REVIEW_STREAK,
    arenaFinished: 0,
    blocked: false,
    now: NOW,
    ...over,
  });
}

describe('triggerEarned', () => {
  it('needs a real streak, not a first win', () => {
    expect(triggerEarned({ trigger: 'daily_streak', streak: 1, arenaFinished: 0 })).toBe(false);
    expect(
      triggerEarned({ trigger: 'daily_streak', streak: REVIEW_STREAK, arenaFinished: 0 }),
    ).toBe(true);
  });

  it('needs several finished battles, not the first', () => {
    expect(triggerEarned({ trigger: 'arena_finished', streak: 0, arenaFinished: 1 })).toBe(false);
    expect(
      triggerEarned({ trigger: 'arena_finished', streak: 0, arenaFinished: REVIEW_ARENA_COUNT }),
    ).toBe(true);
  });

  // The notification pre-prompt fires at a streak of 1. If the review ask could
  // fire there too, the reader would get two modals on one screen.
  it('cannot fire at the streak the notification prompt uses', () => {
    expect(REVIEW_STREAK).toBeGreaterThan(1);
  });
});

describe('shouldRequestReview', () => {
  it('asks at an earned moment on a settled install', () => {
    expect(ask()).toBe(true);
  });

  it('respects the caller veto', () => {
    expect(ask({ blocked: true })).toBe(false);
  });

  it('says no while the trigger is unearned', () => {
    expect(ask({ streak: REVIEW_STREAK - 1 })).toBe(false);
  });

  it('says no inside the first week', () => {
    expect(ask({ prefs: { askedAt: [], firstSeenAt: NOW - (REVIEW_GRACE_MS - 1) } })).toBe(false);
    expect(ask({ prefs: { askedAt: [], firstSeenAt: NOW - REVIEW_GRACE_MS } })).toBe(true);
  });

  // An unstamped install is one that has never been opened before now, not one
  // old enough to have lost its stamp.
  it('treats an unknown first-seen as brand new', () => {
    expect(ask({ prefs: DEFAULT_REVIEW_PREFS })).toBe(false);
  });

  it('will not ask twice inside a season', () => {
    const recent = { ...OLD_INSTALL, askedAt: [NOW - (REVIEW_MIN_GAP_MS - 1)] };
    expect(ask({ prefs: recent })).toBe(false);
    const seasonAgo = { ...OLD_INSTALL, askedAt: [NOW - REVIEW_MIN_GAP_MS] };
    expect(ask({ prefs: seasonAgo })).toBe(true);
  });

  // Under the OS's own cap of three, so our ask is never the one iOS discards.
  it('caps the asks per rolling year', () => {
    const spent = {
      ...OLD_INSTALL,
      askedAt: [NOW - 300 * DAY, NOW - 150 * DAY],
    };
    expect(REVIEW_MAX_PER_YEAR).toBe(2);
    expect(ask({ prefs: spent })).toBe(false);
  });

  it('lets asks age out of the year window', () => {
    const aged = { ...OLD_INSTALL, askedAt: [NOW - 400 * DAY, NOW - 366 * DAY] };
    expect(ask({ prefs: aged })).toBe(true);
  });
});

describe('recordAsk', () => {
  it('appends the ask and drops entries older than a year', () => {
    const prefs: ReviewPrefs = {
      askedAt: [NOW - 400 * DAY, NOW - 200 * DAY],
      firstSeenAt: NOW - 400 * DAY,
    };
    expect(recordAsk(prefs, NOW).askedAt).toEqual([NOW - 200 * DAY, NOW]);
  });

  it('leaves firstSeenAt alone', () => {
    expect(recordAsk(OLD_INSTALL, NOW).firstSeenAt).toBe(OLD_INSTALL.firstSeenAt);
  });
});
