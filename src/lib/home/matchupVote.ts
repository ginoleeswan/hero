// src/lib/home/matchupVote.ts — pure helpers for the daily "Who would win?" vote.
// The vote is persisted locally (AsyncStorage) so a user's pick is remembered for
// the day; the reveal shows the stat scorecard ("head to head") + AI verdict.
// Community-aggregate tallies would be a backend follow-up (a votes table + RPC).

export type MatchupSide = 'a' | 'b';

/** UTC calendar day as YYYY-MM-DD — the matchup rotates on the server's UTC
 *  calendar (daily_debates / todayIso), so the vote key must use the same one:
 *  a local-date key could file a pick under a day the pair doesn't belong to
 *  around midnight in non-UTC timezones. */
export function dayStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Storage key for a given day's matchup. Includes the pair ids so a reschedule
 *  (different pair, same day) never reads a stale pick. */
export function matchupVoteKey(heroAId: string, heroBId: string, d = new Date()): string {
  return `matchup-vote:${dayStamp(d)}:${heroAId}-${heroBId}`;
}

/**
 * The stat scorecard split as whole percentages summing to 100. Derived from how
 * many of the six powerstat categories each hero wins. A 0–0 (no stats either
 * side) reads as evenly matched.
 */
export function statSplit(winsA: number, winsB: number): { pctA: number; pctB: number } {
  const total = winsA + winsB;
  if (total <= 0) return { pctA: 50, pctB: 50 };
  const pctA = Math.round((winsA / total) * 100);
  return { pctA, pctB: 100 - pctA };
}

/** Short verdict-line on who the head to head favours. */
export function statLead(winsA: number, winsB: number, nameA: string, nameB: string): string {
  if (winsA === winsB) return 'Evenly matched on the tape';
  return `${winsA > winsB ? nameA : nameB} leads ${Math.max(winsA, winsB)}–${Math.min(winsA, winsB)} on stats`;
}
