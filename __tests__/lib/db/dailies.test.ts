import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  recordDailyCompletion,
  recordDebateCompletionIfDaily,
  recordTeamBattleCompletionIfDaily,
  getMyDailyStreak,
  subscribeToDailies,
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

// AsyncStorage is mapped to its official jest mock by jest.config — cleared
// between tests so one test's local tick cannot satisfy the next one's read.
beforeEach(async () => {
  await AsyncStorage.clear();
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

  it('skips the server write when logged out, but still ticks locally', async () => {
    // The vote that produces this completion is deliberately anon-friendly, so
    // the tick has to survive without a session — otherwise the Arena's ledger
    // refuses to acknowledge a vote the app just accepted.
    mockSession = null;
    await recordDailyCompletion('puzzle');
    expect(mockRpc).not.toHaveBeenCalled();
    await expect(getMyDailyStreak()).resolves.toMatchObject({
      today: { puzzle: true, debate: false, team_battle: false },
      tracked: false,
    });
  });

  it('notifies subscribers so a completion lights its row without a refetch', async () => {
    const seen = jest.fn();
    const stop = subscribeToDailies(seen);
    await recordDailyCompletion('debate');
    expect(seen).toHaveBeenCalled();
    stop();
    await recordDailyCompletion('puzzle');
    expect(seen).toHaveBeenCalledTimes(1);
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
      tracked: true,
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
      tracked: true,
    });
  });

  // The server owns the calendar; the mirror owns the last few seconds. A tick
  // written moments ago must not be erased by a response that predates it.
  it('ORs the local tick over a server response that has not caught up', async () => {
    await recordDailyCompletion('debate');
    mockRpc.mockResolvedValueOnce({
      data: { current: 1, longest: 3, today: { puzzle: true, debate: false, team_battle: false } },
      error: null,
    });
    await expect(getMyDailyStreak()).resolves.toMatchObject({
      today: { puzzle: true, debate: true, team_battle: false },
    });
  });
});
