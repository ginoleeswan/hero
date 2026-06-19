// Daily-streak bookkeeping for the guessing game. Pure + tested; the hook just
// persists the returned state. A streak grows on consecutive solved days and
// resets on a loss or a skipped day.
export interface StreakState {
  current: number;
  max: number;
  lastDate: string | null; // YYYY-MM-DD of the last recorded result
  lastWon: boolean;
}

export const EMPTY_STREAK: StreakState = { current: 0, max: 0, lastDate: null, lastWon: false };

/** The calendar day before a YYYY-MM-DD date (UTC, so it's timezone-stable). */
export function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** Fold today's result into the streak. Idempotent per day (recording the same
 *  date twice is a no-op), so reopening a finished puzzle won't double-count. */
export function applyResult(prev: StreakState, date: string, won: boolean): StreakState {
  if (prev.lastDate === date) return prev;
  const continued = won && prev.lastWon && prev.lastDate === previousDay(date);
  const current = won ? (continued ? prev.current + 1 : 1) : 0;
  return { current, max: Math.max(prev.max, current), lastDate: date, lastWon: won };
}
