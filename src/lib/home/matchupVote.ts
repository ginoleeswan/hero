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

/**
 * Votes needed before today's tally is shown AS today's tally.
 *
 * Below this a "split" is one or two people — most often just the viewer — and
 * drawing someone's own vote back at them as a full-width 100% bar is a verdict
 * the app has no business claiming. Under the floor every surface falls back to
 * the pair's all-time record, which is real data, plainly labelled.
 */
export const CROWD_FLOOR = 10;

export interface CrowdSplit {
  pctA: number;
  pctB: number;
  /** True when the bar is today's crowd rather than the all-time record. */
  usingVotes: boolean;
  /** Votes cast today, whether or not they are being shown as a split. */
  votes: number;
}

/**
 * The one place the floor is applied. Four surfaces drew this bar — the native
 * and web daily-matchup cards, the web showdown stage, the native showdown —
 * each with its own `tally.total > 0`, and fixing one of them fixed one of
 * them. Route every crowd bar through here.
 */
export function crowdSplit(
  tally: { total: number; votesA: number; votesB: number } | null | undefined,
  winsA: number,
  winsB: number,
): CrowdSplit {
  const votes = tally?.total ?? 0;
  const usingVotes = votes >= CROWD_FLOOR;
  const { pctA, pctB } = usingVotes
    ? statSplit(tally!.votesA, tally!.votesB)
    : statSplit(winsA, winsB);
  return { pctA, pctB, usingVotes, votes };
}

/**
 * Who took a frozen result, with a tie treated as a tie.
 *
 * `finalVotesA >= finalVotesB` crowns whichever side happened to sort first, so
 * a dead heat rendered as "Team Hulk won 50/50" — a contradiction in five
 * words, on the outcome most likely to be read twice.
 */
export function frozenResult(
  finalVotesA: number,
  finalVotesB: number,
  yourPick: MatchupSide | null,
): { tied: boolean; aWon: boolean; yourSideWon: boolean | null } {
  const tied = finalVotesA === finalVotesB;
  const aWon = finalVotesA > finalVotesB;
  return {
    tied,
    aWon,
    yourSideWon: tied || yourPick === null ? null : (yourPick === 'a') === aWon,
  };
}
