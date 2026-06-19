// Local play stats for the daily game (guess distribution + totals) and the
// global percentile derived from the server distribution. Pure + tested; the
// hook persists what these return.

export interface GameStats {
  played: number;
  wins: number;
  /** dist[k] = games won on guess k (1-indexed); index 0 unused. */
  dist: number[];
  lastDate: string | null;
}

export const EMPTY_STATS: GameStats = { played: 0, wins: 0, dist: [], lastDate: null };

/** Fold today's result into the stats. Idempotent per day (re-recording the
 *  same date is a no-op), so reopening a finished puzzle won't double-count. */
export function recordStats(
  prev: GameStats,
  date: string,
  won: boolean,
  guessCount: number,
  maxGuesses: number,
): GameStats {
  if (prev.lastDate === date) return prev;
  const dist = prev.dist.slice();
  while (dist.length < maxGuesses + 1) dist.push(0);
  if (won && guessCount >= 1 && guessCount < dist.length) dist[guessCount] += 1;
  return {
    played: prev.played + 1,
    wins: prev.wins + (won ? 1 : 0),
    dist,
    lastDate: date,
  };
}

export function winPct(s: GameStats): number {
  return s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
}

// ── Global distribution (from the server) + percentile ──────────────────────

export interface DailyDistribution {
  total: number;
  wins: number;
  losses: number;
  dist: { g: number; c: number }[];
}

/**
 * Share of today's players you beat: everyone who lost, plus winners who needed
 * more guesses than you. Null when you lost or there aren't enough players yet.
 */
export function beatPercent(
  d: DailyDistribution | null,
  won: boolean,
  guessCount: number,
): number | null {
  if (!won || !d || d.total <= 1) return null;
  let beaten = d.losses;
  for (const { g, c } of d.dist) if (g > guessCount) beaten += c;
  return Math.round((beaten / d.total) * 100);
}
