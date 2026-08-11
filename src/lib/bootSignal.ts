// src/lib/bootSignal.ts — what the boot screen KNOWS.
//
// The launch used to be 1.8 seconds of decoration that told you nothing. This
// is what makes it carry information instead, without adding a single pixel of
// UI — the choreography is identical, only the LIGHT behind the mask changes:
//
//   • its colour says what day it is. Seeded from the UTC date, so everyone
//     who opens the app on the same day sees the same light and it turns over
//     at midnight UTC. Shared, therefore worth mentioning to someone.
//   • its intensity says whether the day's game is still waiting for you. Lit
//     when it is, calm once you have played. Nobody is told this; you learn it
//     the way you learn that a room is occupied from the light under the door.
//
// Both are derived, not fetched: the date is the date, and the daily's result
// is already stored locally by useDailyHero. So this works on a plane, on the
// first frame, with no request and no backend — which is the only reason it
// can be allowed to gate a splash screen at all.
//
// Kept as pure functions with the storage read passed in, so every rule here is
// testable without mocking a device.

/** The app's date convention, UTC, matching dailySeed and every daily key. */
export function todayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Where useDailyHero stores a day's progress. Must stay in step with it. */
export function dailyRecordKey(dateKey: string): string {
  return `dh_v3_${dateKey}`;
}

// The day's light. Eight lamps, one per world the catalogue covers — an ember,
// a gold, a crimson, a royal, a toxic, a violet, an ice and an ash. Enough that
// the change is felt rather than announced, few enough that each is a colour
// you could name, and none of them so far from the brand's ember that the
// screen stops being Mythique's. The mask and the navy never change; only what
// is burning behind them does.
//
// Eight rather than seven on purpose: a seven-lamp cycle indexed by date lands
// on the same colour every weekday, and a launch ritual that is "the blue one
// again, must be Tuesday" is a calendar, not a surprise.
export const EMBER_LAMPS = [
  '#E77333', // ember — the brand's own
  '#E0A63C', // gold
  '#D24B45', // crimson
  '#5C6FD6', // royal
  '#6FBF4A', // toxic
  '#9A5FD0', // violet
  '#46A8C4', // ice
  '#B9A48C', // ash
] as const;

/**
 * The lamp for a given `YYYY-MM-DD`. Deterministic and shared: the same date
 * gives the same light on every device, offline, with nothing stored.
 */
export function emberForDate(dateKey: string): string {
  const digits = Number(dateKey.replace(/-/g, ''));
  if (!Number.isFinite(digits)) return EMBER_LAMPS[0];
  return EMBER_LAMPS[digits % EMBER_LAMPS.length];
}

export type BootSignal = {
  /** Today's game has not been finished. The mask's eyes stay lit. */
  awaiting: boolean;
  /** The day's lamp colour. */
  ember: string;
};

/** The signal used before the stored record has been read, and if it fails. */
export const BOOT_SIGNAL_FALLBACK: BootSignal = { awaiting: false, ember: EMBER_LAMPS[0] };

/**
 * Read the signal from the raw stored record for `dateKey`.
 *
 * `null` means the day has not been started — waiting. A record mid-play is
 * also waiting: you came back without finishing, which is exactly when a nudge
 * is worth something. Only a finished day (won or lost) puts the light out,
 * and losing counts, because the day is spent either way and a screen that
 * kept nagging about a game you already lost would be a scold rather than an
 * invitation.
 *
 * Anything unparseable is treated as finished. This decides how bright a glow
 * is; the failure mode has to be the quiet one.
 */
export function signalFrom(raw: string | null, dateKey: string): BootSignal {
  const ember = emberForDate(dateKey);
  if (raw === null) return { awaiting: true, ember };
  try {
    const parsed = JSON.parse(raw) as { status?: unknown };
    const done = parsed?.status === 'won' || parsed?.status === 'lost';
    return { awaiting: !done, ember };
  } catch {
    return { awaiting: false, ember };
  }
}
