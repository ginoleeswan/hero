// src/lib/notifications/policy.ts — WHEN the app is allowed to ask, and what it
// is allowed to send. Pure logic, no expo-notifications import, so it is unit
// testable and safe to import from anywhere including web.
//
// iOS grants exactly one system prompt per install. Spend it badly — on launch,
// before the reader knows what the app is — and the answer is no, permanently,
// and the only recovery is a trip to Settings that nobody makes. So the ask is
// a scheduled event with preconditions, not a side effect of mounting.
//
// The precondition is a first daily-game win: the reader has just finished
// something, seen a streak begin, and the thing we want to send them is the
// continuation of exactly that. Nothing else in the app earns the prompt as
// clearly.

/** Everything the app persists about the ask. Stored under one AsyncStorage key. */
export interface NotificationPrefs {
  /** ms epoch of the last time the OS prompt was shown, or null if never. */
  askedAt: number | null;
  /** ms epoch the reader turned the feature on from settings, or null. */
  enabledAt: number | null;
  /** They said no in our own pre-prompt; we may ask again after a cool-off. */
  softDeclinedAt: number | null;
  /** Daily streak reminder, on by default once notifications are on. */
  streakReminder: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  askedAt: null,
  enabledAt: null,
  softDeclinedAt: null,
  streakReminder: true,
};

/** A soft decline is not forever — but it is a long time. */
export const SOFT_DECLINE_COOLOFF_MS = 30 * 24 * 60 * 60 * 1000;

export type OsPermission = 'granted' | 'denied' | 'undetermined';

/**
 * Should the app raise its own pre-prompt right now?
 *
 * Deliberately conservative. It returns true in one situation only: the OS has
 * never been asked, we have not already spent the ask, the reader has not
 * recently declined our softer version, and they have just won a daily.
 *
 * `denied` returns false forever — re-prompting a denial does nothing on iOS
 * except make the app look broken, because the system prompt will not appear.
 */
export function shouldOfferNotifications(input: {
  os: OsPermission;
  prefs: NotificationPrefs;
  justWonFirstDaily: boolean;
  now: number;
}): boolean {
  const { os, prefs, justWonFirstDaily, now } = input;
  if (os !== 'undetermined') return false;
  if (prefs.askedAt !== null) return false;
  if (!justWonFirstDaily) return false;
  if (prefs.softDeclinedAt !== null && now - prefs.softDeclinedAt < SOFT_DECLINE_COOLOFF_MS) {
    return false;
  }
  return true;
}

/**
 * Is the app allowed to put a notification on this device at all?
 *
 * Both gates matter: the OS grant, and our own switch. A reader who granted iOS
 * permission and then turned the feature off in settings must get nothing —
 * the OS permission is not consent to a specific message.
 */
export function notificationsActive(os: OsPermission, prefs: NotificationPrefs): boolean {
  return os === 'granted' && prefs.enabledAt !== null;
}

/** The streak reminder needs the feature on AND its own switch. */
export function streakReminderActive(os: OsPermission, prefs: NotificationPrefs): boolean {
  return notificationsActive(os, prefs) && prefs.streakReminder;
}

/**
 * The hour, in the device's own local time, that a streak reminder fires.
 *
 * Evening on purpose: the reminder is only useful while there is still time to
 * play, and a nudge at 9am about something that expires at midnight is a nag
 * rather than a service.
 */
export const STREAK_REMINDER_HOUR = 19;

/**
 * When should the next streak reminder fire, given the local time now?
 *
 * Returns null when there is nothing worth saying: no streak to lose, or the
 * reader has already played today. A reminder that fires anyway is the fastest
 * way to have notifications turned off for good.
 */
export function nextStreakReminderAt(input: {
  now: Date;
  streak: number;
  playedToday: boolean;
}): Date | null {
  const { now, streak, playedToday } = input;
  if (streak < 1 || playedToday) return null;
  const at = new Date(now);
  at.setHours(STREAK_REMINDER_HOUR, 0, 0, 0);
  // Past the hour already — the streak is at risk TODAY, so there is no point
  // scheduling for tomorrow evening; the streak will be gone by then.
  if (at.getTime() <= now.getTime()) return null;
  return at;
}

/** The reminder's copy. A number the reader owns beats a generic prod. */
export function streakReminderBody(streak: number): { title: string; body: string } {
  return {
    title: streak >= 2 ? `Your ${streak}-day streak is on the line` : 'Today’s hero is waiting',
    body:
      streak >= 2
        ? 'One guess keeps it alive. Play before midnight.'
        : 'Guess today’s hero and start a streak.',
  };
}
