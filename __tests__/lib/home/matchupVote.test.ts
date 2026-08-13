// __tests__/lib/home/matchupVote.test.ts
import { dayStamp, matchupVoteKey, statSplit, statLead } from '../../../src/lib/home/matchupVote';

import { crowdSplit, frozenResult, CROWD_FLOOR } from '../../../src/lib/home/matchupVote';

describe('dayStamp', () => {
  it('formats the UTC calendar day as YYYY-MM-DD with zero-padding', () => {
    // UTC-constructed dates: dayStamp rotates on the server's UTC calendar
    // (matches daily_debates/todayIso), NOT the device's local one.
    expect(dayStamp(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
    expect(dayStamp(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12-31');
  });

  it('uses the UTC day even when the local calendar disagrees', () => {
    // 23:30 UTC on Jan 5 is already Jan 6 in UTC+east timezones — the stamp
    // must stay on the UTC day.
    expect(dayStamp(new Date(Date.UTC(2026, 0, 5, 23, 30)))).toBe('2026-01-05');
  });
});

describe('matchupVoteKey', () => {
  it('namespaces by day and pair so a reschedule never reads a stale pick', () => {
    const d = new Date(Date.UTC(2026, 5, 17));
    expect(matchupVoteKey('a1', 'b2', d)).toBe('matchup-vote:2026-06-17:a1-b2');
  });

  it('changes when the day changes', () => {
    const a = matchupVoteKey('x', 'y', new Date(Date.UTC(2026, 5, 17)));
    const b = matchupVoteKey('x', 'y', new Date(Date.UTC(2026, 5, 18)));
    expect(a).not.toBe(b);
  });
});

describe('statSplit', () => {
  it('returns whole percentages that sum to 100', () => {
    const { pctA, pctB } = statSplit(4, 2);
    expect(pctA + pctB).toBe(100);
    expect(pctA).toBe(67);
    expect(pctB).toBe(33);
  });

  it('reads a 0–0 (no stats either side) as evenly matched', () => {
    expect(statSplit(0, 0)).toEqual({ pctA: 50, pctB: 50 });
  });

  it('handles a clean sweep', () => {
    expect(statSplit(6, 0)).toEqual({ pctA: 100, pctB: 0 });
  });
});

describe('statLead', () => {
  it('names the stat leader with the score', () => {
    expect(statLead(4, 2, 'Thor', 'Hulk')).toBe('Thor leads 4–2 on stats');
    expect(statLead(1, 5, 'Thor', 'Hulk')).toBe('Hulk leads 5–1 on stats');
  });

  it('calls an even tape evenly matched', () => {
    expect(statLead(3, 3, 'Thor', 'Hulk')).toBe('Evenly matched on the tape');
  });
});

// Four surfaces drew the crowd bar with their own copy of this rule, so fixing
// one of them fixed exactly one of them. These lock the shared version.
describe('crowdSplit', () => {
  const tally = (total: number, a: number, b: number) => ({ total, votesA: a, votesB: b });

  it('shows the all-time record until a real crowd exists', () => {
    // One vote is almost always the viewer's own; reflecting it back as a
    // full-width 100% bar is a verdict the app cannot support.
    const r = crowdSplit(tally(1, 1, 0), 4, 2);
    expect(r.usingVotes).toBe(false);
    expect(r.votes).toBe(1);
    expect(r).toMatchObject(statSplitOf(4, 2));
  });

  it('switches to today at the floor, not before it', () => {
    expect(crowdSplit(tally(CROWD_FLOOR - 1, 9, 0), 1, 1).usingVotes).toBe(false);
    expect(crowdSplit(tally(CROWD_FLOOR, 10, 0), 1, 1).usingVotes).toBe(true);
  });

  it('treats a missing tally as no votes rather than as a zero split', () => {
    const r = crowdSplit(null, 3, 3);
    expect(r.usingVotes).toBe(false);
    expect(r.votes).toBe(0);
    expect(r.pctA).toBe(50);
  });

  function statSplitOf(a: number, b: number) {
    return statSplit(a, b);
  }
});

describe('frozenResult', () => {
  it('calls a dead heat a dead heat', () => {
    // `finalVotesA >= finalVotesB` crowned whichever side sorted first, so a tie
    // rendered as "Team Hulk won 50/50".
    const r = frozenResult(5, 5, 'a');
    expect(r.tied).toBe(true);
    expect(r.yourSideWon).toBeNull();
  });

  it('nobody wins a tie, whichever side you picked', () => {
    expect(frozenResult(5, 5, 'b').yourSideWon).toBeNull();
    expect(frozenResult(5, 5, null).yourSideWon).toBeNull();
  });

  it('reports your side correctly on a real result', () => {
    expect(frozenResult(7, 3, 'a')).toMatchObject({ tied: false, aWon: true, yourSideWon: true });
    expect(frozenResult(7, 3, 'b')).toMatchObject({ aWon: true, yourSideWon: false });
    expect(frozenResult(3, 7, 'b')).toMatchObject({ aWon: false, yourSideWon: true });
  });

  it('has no opinion when you did not vote', () => {
    expect(frozenResult(7, 3, null).yourSideWon).toBeNull();
  });
});
