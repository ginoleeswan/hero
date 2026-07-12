import {
  getDailyDebate,
  getYesterdayResult,
  todayIso,
  yesterdayIso,
} from '../../../src/lib/db/dailyDebate';

let mockResolvers: Record<string, { data: unknown; error: unknown }> = {};

jest.mock('../../../src/lib/supabase', () => {
  const methods = ['select', 'eq'];
  const makeChain = (tableName: string) => {
    const c: Record<string, unknown> = {};
    methods.forEach((m) => {
      c[m] = jest.fn().mockReturnValue(c);
    });
    c.maybeSingle = jest.fn(() =>
      Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }),
    );
    return c;
  };
  const chains: Record<string, ReturnType<typeof makeChain>> = {};
  const mockFrom = jest.fn().mockImplementation((tableName: string) => {
    if (!chains[tableName]) chains[tableName] = makeChain(tableName);
    return chains[tableName];
  });
  return {
    supabase: { from: mockFrom },
    __chains: chains,
    __mockFrom: mockFrom,
  };
});

const { __chains: chains, __mockFrom: mockFrom } = jest.requireMock(
  '../../../src/lib/supabase',
) as {
  __chains: Record<string, Record<string, jest.Mock>>;
  __mockFrom: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockResolvers = {};
  Object.keys(chains).forEach((k) => delete chains[k]);
});

describe('todayIso / yesterdayIso', () => {
  it('formats a UTC calendar date as YYYY-MM-DD, one day apart', () => {
    const d = new Date('2026-07-12T15:00:00Z');
    expect(todayIso(d)).toBe('2026-07-12');
    expect(yesterdayIso(d)).toBe('2026-07-11');
  });

  it('rolls the month/year boundary correctly', () => {
    const d = new Date('2026-01-01T02:00:00Z');
    expect(yesterdayIso(d)).toBe('2025-12-31');
  });
});

describe('getDailyDebate', () => {
  it('maps a row to the DailyDebate shape', async () => {
    mockResolvers['daily_debate'] = {
      data: { hero_a_id: 'h1', hero_b_id: 'h2', hook_text: 'Round 1' },
      error: null,
    };

    const result = await getDailyDebate('2026-07-12');

    expect(chains['daily_debate'].eq).toHaveBeenCalledWith('debate_date', '2026-07-12');
    expect(result).toEqual({ heroAId: 'h1', heroBId: 'h2', hookText: 'Round 1' });
  });

  it('returns null when there is no row', async () => {
    mockResolvers['daily_debate'] = { data: null, error: null };
    expect(await getDailyDebate('2026-07-12')).toBeNull();
  });

  it('returns null on error', async () => {
    mockResolvers['daily_debate'] = { data: null, error: { message: 'boom' } };
    expect(await getDailyDebate('2026-07-12')).toBeNull();
  });
});

describe('getYesterdayResult', () => {
  it('returns null when there is no row for yesterday', async () => {
    mockResolvers['daily_debate'] = { data: null, error: null };
    expect(await getYesterdayResult()).toBeNull();
  });

  it('returns null when the debate has not been resolved yet (final votes still null)', async () => {
    mockResolvers['daily_debate'] = {
      data: {
        hero_a_id: 'h1',
        hero_b_id: 'h2',
        final_votes_a: null,
        final_votes_b: null,
        top_take_id: null,
      },
      error: null,
    };
    expect(await getYesterdayResult()).toBeNull();
  });

  it('maps a resolved row with a crowned top take, joining the display name', async () => {
    mockResolvers['daily_debate'] = {
      data: {
        hero_a_id: 'h1',
        hero_b_id: 'h2',
        final_votes_a: 12,
        final_votes_b: 8,
        top_take_id: 't1',
      },
      error: null,
    };
    mockResolvers['matchup_takes'] = {
      data: { body: 'h1 wins easy', user_id: 'u1' },
      error: null,
    };
    mockResolvers['user_profiles'] = {
      data: { display_name: 'Gino' },
      error: null,
    };

    const result = await getYesterdayResult();

    expect(chains['matchup_takes'].eq).toHaveBeenCalledWith('id', 't1');
    expect(chains['user_profiles'].eq).toHaveBeenCalledWith('id', 'u1');
    expect(result).toEqual({
      heroAId: 'h1',
      heroBId: 'h2',
      finalVotesA: 12,
      finalVotesB: 8,
      topTake: { body: 'h1 wins easy', displayName: 'Gino' },
    });
  });

  it('resolves with a null topTake when top_take_id is null', async () => {
    mockResolvers['daily_debate'] = {
      data: {
        hero_a_id: 'h1',
        hero_b_id: 'h2',
        final_votes_a: 5,
        final_votes_b: 5,
        top_take_id: null,
      },
      error: null,
    };

    const result = await getYesterdayResult();

    expect(result).toEqual({
      heroAId: 'h1',
      heroBId: 'h2',
      finalVotesA: 5,
      finalVotesB: 5,
      topTake: null,
    });
  });
});
