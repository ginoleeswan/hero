import {
  recordDailyCompletion,
  recordDebateCompletionIfDaily,
  recordTeamBattleCompletionIfDaily,
  getMyDailyStreak,
} from '../../../src/lib/db/dailies';

const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });
let mockSession: object | null = { user: { id: 'u1' } };

jest.mock('../../../src/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getSession: async () => ({ data: { session: mockSession } }) },
  },
}));

const mockGetDailyDebate = jest.fn();
jest.mock('../../../src/lib/db/dailyDebate', () => ({
  todayIso: () => '2026-07-16',
  getDailyDebate: (...args: unknown[]) => mockGetDailyDebate(...args),
}));

const mockGetTodaysTeamBattle = jest.fn();
jest.mock('../../../src/lib/db/teams', () => ({
  getTodaysTeamBattle: (...args: unknown[]) => mockGetTodaysTeamBattle(...args),
}));

beforeEach(() => {
  mockRpc.mockClear();
  mockGetDailyDebate.mockReset();
  mockGetTodaysTeamBattle.mockReset();
  mockSession = { user: { id: 'u1' } };
});

describe('recordDailyCompletion', () => {
  it('records for a signed-in user', async () => {
    await recordDailyCompletion('puzzle');
    expect(mockRpc).toHaveBeenCalledWith('record_daily_completion', { p_surface: 'puzzle' });
  });

  it('no-ops when logged out', async () => {
    mockSession = null;
    await recordDailyCompletion('puzzle');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('recordDebateCompletionIfDaily', () => {
  it('records when the voted pair IS today’s debate (order-insensitive)', async () => {
    mockGetDailyDebate.mockResolvedValue({ heroAId: 'a1', heroBId: 'b1', hookText: null });
    await recordDebateCompletionIfDaily('b1', 'a1'); // reversed order
    expect(mockRpc).toHaveBeenCalledWith('record_daily_completion', { p_surface: 'debate' });
  });

  it('does NOT record for an arbitrary (non-daily) pair', async () => {
    mockGetDailyDebate.mockResolvedValue({ heroAId: 'a1', heroBId: 'b1', hookText: null });
    await recordDebateCompletionIfDaily('a1', 'someone-else');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('does nothing when there is no debate row today', async () => {
    mockGetDailyDebate.mockResolvedValue(null);
    await recordDebateCompletionIfDaily('a1', 'b1');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('recordTeamBattleCompletionIfDaily', () => {
  it('records only for today’s deterministic pair', async () => {
    mockGetTodaysTeamBattle.mockResolvedValue({ teamA: { id: 't1' }, teamB: { id: 't2' } });
    await recordTeamBattleCompletionIfDaily('t2', 't1');
    expect(mockRpc).toHaveBeenCalledWith('record_daily_completion', { p_surface: 'team_battle' });
    mockRpc.mockClear();
    await recordTeamBattleCompletionIfDaily('t1', 't9'); // a draft/deep-linked battle
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('getMyDailyStreak', () => {
  it('unwraps the RPC json', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { current: 4, longest: 5, today: { puzzle: false, debate: true, team_battle: false } },
      error: null,
    });
    await expect(getMyDailyStreak()).resolves.toEqual({
      current: 4,
      longest: 5,
      today: { puzzle: false, debate: true, team_battle: false },
    });
  });

  it('returns zeros when logged out (without calling the RPC)', async () => {
    mockSession = null;
    const s = await getMyDailyStreak();
    expect(s.current).toBe(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns zeros on error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const s = await getMyDailyStreak();
    expect(s).toEqual({
      current: 0,
      longest: 0,
      today: { puzzle: false, debate: false, team_battle: false },
    });
  });
});
