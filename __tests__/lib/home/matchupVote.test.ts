// __tests__/lib/home/matchupVote.test.ts
import {
  dayStamp,
  matchupVoteKey,
  statSplit,
  statLead,
} from '../../../src/lib/home/matchupVote';

describe('dayStamp', () => {
  it('formats the local calendar day as YYYY-MM-DD with zero-padding', () => {
    expect(dayStamp(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayStamp(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('matchupVoteKey', () => {
  it('namespaces by day and pair so a reschedule never reads a stale pick', () => {
    const d = new Date(2026, 5, 17);
    expect(matchupVoteKey('a1', 'b2', d)).toBe('matchup-vote:2026-06-17:a1-b2');
  });

  it('changes when the day changes', () => {
    const a = matchupVoteKey('x', 'y', new Date(2026, 5, 17));
    const b = matchupVoteKey('x', 'y', new Date(2026, 5, 18));
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
