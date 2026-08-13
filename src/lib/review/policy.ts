// src/lib/review/policy.ts — WHEN the app may ask for a rating. Pure logic, no
// expo-store-review import, so it is unit testable and safe on web.
//
// The in-app review sheet is the most easily wasted surface an app has. iOS
// silently rate-limits it to three appearances per app per year, and it does
// not tell you when it swallowed one — `requestReview()` resolves either way.
// So an app that asks eagerly does not get more reviews, it gets the same three
// asks spent on whoever happened to open the app that week, including the
// reader who just failed the daily.
//
// Hence: ask at a moment the reader has visibly succeeded at something, ask
// rarely, and never ask twice in the same season.
//
// COLLISION IS THE OTHER HALF. The notification pre-prompt fires on a first
// daily win (see lib/notifications/policy.ts). Two modal asks back to back read
// as an app that wants things rather than one that gives them, so the review
// triggers are deliberately placed far from that moment — a streak of five is
// four days later at the earliest — and the hook can still hard-block an ask
// when the notification sheet is on screen.

/** Everything persisted about the ask. One AsyncStorage key. */
export interface ReviewPrefs {
  /** ms epochs of every ask we have raised, oldest first. */
  askedAt: number[];
  /** ms epoch of the first app open we ever saw, or null before it is known. */
  firstSeenAt: number | null;
}

export const DEFAULT_REVIEW_PREFS: ReviewPrefs = { askedAt: [], firstSeenAt: null };

/** What earned the ask. Mirrors the `review_prompt_requested` event. */
export type ReviewTrigger = 'daily_streak' | 'arena_finished';

const DAY = 24 * 60 * 60 * 1000;

/**
 * No ask in the first week. A reader who has been here three days does not yet
 * have an opinion worth a star rating, and spending one of three yearly slots
 * to collect a shrug is the worst available trade.
 */
export const REVIEW_GRACE_MS = 7 * DAY;

/** Two asks cannot be closer than a season apart. */
export const REVIEW_MIN_GAP_MS = 120 * DAY;

/**
 * Two per year, under the OS's own three. Staying below the system cap means
 * our ask is never the one iOS quietly discards — the asks we choose are the
 * asks that actually appear.
 */
export const REVIEW_MAX_PER_YEAR = 2;

/** The streak that earns the ask. Well clear of the notification prompt at 1. */
export const REVIEW_STREAK = 5;

/** Arena battles finished before the arena route may ask. */
export const REVIEW_ARENA_COUNT = 3;

/** Has this trigger's own precondition been met? */
export function triggerEarned(input: {
  trigger: ReviewTrigger;
  streak: number;
  arenaFinished: number;
}): boolean {
  return input.trigger === 'daily_streak'
    ? input.streak >= REVIEW_STREAK
    : input.arenaFinished >= REVIEW_ARENA_COUNT;
}

/**
 * Should the app request a review right now?
 *
 * `blocked` is the caller's veto — the notification sheet being open, a modal
 * mid-animation, the app not being frontmost. Policy cannot see any of that, so
 * it takes it as input rather than guessing.
 */
export function shouldRequestReview(input: {
  trigger: ReviewTrigger;
  prefs: ReviewPrefs;
  streak: number;
  arenaFinished: number;
  blocked: boolean;
  now: number;
}): boolean {
  const { prefs, blocked, now } = input;
  if (blocked) return false;
  if (!triggerEarned(input)) return false;

  // firstSeenAt is null only before the first write, which is itself the first
  // open — so an unknown value means "brand new", not "old enough".
  const firstSeen = prefs.firstSeenAt ?? now;
  if (now - firstSeen < REVIEW_GRACE_MS) return false;

  const last = prefs.askedAt[prefs.askedAt.length - 1];
  if (last !== undefined && now - last < REVIEW_MIN_GAP_MS) return false;

  const inLastYear = prefs.askedAt.filter((t) => now - t < 365 * DAY).length;
  if (inLastYear >= REVIEW_MAX_PER_YEAR) return false;

  return true;
}

/**
 * Fold a raised ask into prefs.
 *
 * Older-than-a-year entries are dropped as they age out: the list is only ever
 * read through a one-year window, so keeping the whole history would grow a
 * stored array forever to answer a question it cannot affect.
 */
export function recordAsk(prefs: ReviewPrefs, now: number): ReviewPrefs {
  return {
    ...prefs,
    askedAt: [...prefs.askedAt.filter((t) => now - t < 365 * DAY), now],
  };
}
