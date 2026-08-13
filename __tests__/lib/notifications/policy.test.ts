import {
  DEFAULT_PREFS,
  SOFT_DECLINE_COOLOFF_MS,
  nextStreakReminderAt,
  notificationsActive,
  shouldOfferNotifications,
  streakReminderActive,
  streakReminderBody,
  STREAK_REMINDER_HOUR,
} from '../../../src/lib/notifications/policy';

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0);

describe('shouldOfferNotifications', () => {
  const base = {
    os: 'undetermined' as const,
    prefs: DEFAULT_PREFS,
    justWonFirstDaily: true,
    now: NOW,
  };

  it('offers at the one moment that earns it', () => {
    expect(shouldOfferNotifications(base)).toBe(true);
  });

  it('never offers unprompted — a first win is the whole precondition', () => {
    expect(shouldOfferNotifications({ ...base, justWonFirstDaily: false })).toBe(false);
  });

  // iOS shows the system prompt once per install. Asking again does nothing
  // except make the app look broken.
  it('never re-asks once the OS prompt has been spent', () => {
    expect(shouldOfferNotifications({ ...base, os: 'denied' })).toBe(false);
    expect(shouldOfferNotifications({ ...base, os: 'granted' })).toBe(false);
    expect(
      shouldOfferNotifications({ ...base, prefs: { ...DEFAULT_PREFS, askedAt: NOW - 1000 } }),
    ).toBe(false);
  });

  it('holds off after a soft decline, then allows another ask', () => {
    const declined = { ...DEFAULT_PREFS, softDeclinedAt: NOW - 1000 };
    expect(shouldOfferNotifications({ ...base, prefs: declined })).toBe(false);
    expect(
      shouldOfferNotifications({
        ...base,
        prefs: { ...DEFAULT_PREFS, softDeclinedAt: NOW - SOFT_DECLINE_COOLOFF_MS - 1 },
      }),
    ).toBe(true);
  });
});

describe('notificationsActive', () => {
  // An OS grant is not consent to a particular message — the in-app switch is
  // a separate gate, and turning it off must silence everything.
  it('needs the OS grant AND the app switch', () => {
    const on = { ...DEFAULT_PREFS, enabledAt: NOW };
    expect(notificationsActive('granted', on)).toBe(true);
    expect(notificationsActive('granted', DEFAULT_PREFS)).toBe(false);
    expect(notificationsActive('denied', on)).toBe(false);
  });

  it('gates the streak reminder on its own switch too', () => {
    const on = { ...DEFAULT_PREFS, enabledAt: NOW };
    expect(streakReminderActive('granted', on)).toBe(true);
    expect(streakReminderActive('granted', { ...on, streakReminder: false })).toBe(false);
  });
});

describe('nextStreakReminderAt', () => {
  const morning = new Date(2026, 7, 12, 9, 0, 0);

  it('schedules for this evening, local time', () => {
    const at = nextStreakReminderAt({ now: morning, streak: 4, playedToday: false });
    expect(at?.getHours()).toBe(STREAK_REMINDER_HOUR);
    expect(at?.getDate()).toBe(12);
  });

  it('says nothing when there is nothing to lose or nothing to do', () => {
    expect(nextStreakReminderAt({ now: morning, streak: 0, playedToday: false })).toBeNull();
    expect(nextStreakReminderAt({ now: morning, streak: 4, playedToday: true })).toBeNull();
  });

  // Scheduling tomorrow evening would fire AFTER the streak had already broken
  // at midnight — a notification about a thing that is no longer true.
  it('does not roll to tomorrow once the hour has passed', () => {
    const evening = new Date(2026, 7, 12, 21, 0, 0);
    expect(nextStreakReminderAt({ now: evening, streak: 4, playedToday: false })).toBeNull();
  });
});

describe('streakReminderBody', () => {
  it('names the number the reader owns', () => {
    expect(streakReminderBody(6).title).toContain('6-day');
  });

  it('does not claim a streak that does not exist yet', () => {
    expect(streakReminderBody(1).title).not.toContain('1-day');
  });
});
