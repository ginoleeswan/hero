import { getTakes, getMyTakes, postTake, toggleAgree } from '../../../src/lib/db/takes';

let mockResolvers: Record<string, { data: unknown; error: unknown }> = {};
const mockRpc = jest.fn();

jest.mock('../../../src/lib/supabase', () => {
  const methods = ['select', 'eq', 'order', 'limit', 'in'];
  const makeChain = (tableName: string) => {
    const c: Record<string, unknown> = {};
    methods.forEach((m) => {
      c[m] = jest.fn().mockReturnValue(c);
    });
    c.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }).then(resolve);
    return c;
  };
  const chains: Record<string, ReturnType<typeof makeChain>> = {};
  const mockFrom = jest.fn().mockImplementation((tableName: string) => {
    if (!chains[tableName]) chains[tableName] = makeChain(tableName);
    return chains[tableName];
  });
  return {
    supabase: { from: mockFrom, rpc: (...a: unknown[]) => mockRpc(...a) },
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
  mockFrom.mockImplementation((tableName: string) => {
    if (!chains[tableName]) {
      const methods = ['select', 'eq', 'order', 'limit', 'in'];
      const c: Record<string, unknown> = {};
      methods.forEach((m) => {
        c[m] = jest.fn().mockReturnValue(c);
      });
      c.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }).then(resolve);
      chains[tableName] = c as Record<string, jest.Mock>;
    }
    return chains[tableName];
  });
});

describe('getTakes', () => {
  it('maps snake_case rows (including joined profile display name) to the Take shape', async () => {
    mockResolvers['matchup_takes'] = {
      data: [
        {
          id: 't1',
          hero_a_id: 'h1',
          hero_b_id: 'h2',
          user_id: 'u1',
          picked_id: 'h1',
          body: 'h1 wins easy',
          agree_count: 3,
          created_at: '2026-07-01T00:00:00Z',
        },
      ],
      error: null,
    };
    mockRpc.mockResolvedValue({
      data: [{ id: 'u1', display_name: 'Gino', avatar_url: null }],
      error: null,
    });

    const result = await getTakes('h2', 'h1');

    expect(chains['matchup_takes'].eq).toHaveBeenCalledWith('hero_a_id', 'h1');
    expect(chains['matchup_takes'].eq).toHaveBeenCalledWith('hero_b_id', 'h2');
    // Display names come from the SECURITY DEFINER get_public_profiles RPC,
    // not a direct user_profiles select — that table's SELECT policy is
    // self-scoped and would silently return nothing for another user's row.
    expect(mockRpc).toHaveBeenCalledWith('get_public_profiles', { p_ids: ['u1'] });
    expect(chains['user_profiles']).toBeUndefined();
    expect(result).toEqual([
      {
        id: 't1',
        heroAId: 'h1',
        heroBId: 'h2',
        userId: 'u1',
        pickedId: 'h1',
        body: 'h1 wins easy',
        agreeCount: 3,
        createdAt: '2026-07-01T00:00:00Z',
        displayName: 'Gino',
      },
    ]);
  });

  it('returns [] on error and does not filter rows client-side', async () => {
    mockResolvers['matchup_takes'] = { data: null, error: { message: 'boom' } };
    expect(await getTakes('h1', 'h2')).toEqual([]);
  });
});

describe('getMyTakes', () => {
  it('maps own take rows and attaches hero names via a heroes-by-ids lookup', async () => {
    mockResolvers['matchup_takes'] = {
      data: [
        {
          id: 't1',
          hero_a_id: 'h1',
          hero_b_id: 'h2',
          user_id: 'u1',
          picked_id: 'h1',
          body: 'h1 wins easy',
          agree_count: 3,
          created_at: '2026-07-01T00:00:00Z',
        },
      ],
      error: null,
    };
    mockResolvers['heroes'] = {
      data: [
        { id: 'h1', name: 'Batman' },
        { id: 'h2', name: 'Superman' },
      ],
      error: null,
    };

    const result = await getMyTakes('u1');

    expect(chains['matchup_takes'].eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(chains['matchup_takes'].order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(chains['matchup_takes'].limit).toHaveBeenCalledWith(100);
    expect(result).toEqual([
      {
        id: 't1',
        heroAId: 'h1',
        heroBId: 'h2',
        userId: 'u1',
        pickedId: 'h1',
        body: 'h1 wins easy',
        agreeCount: 3,
        createdAt: '2026-07-01T00:00:00Z',
        displayName: null,
        heroAName: 'Batman',
        heroBName: 'Superman',
      },
    ]);
  });

  it('returns [] on error', async () => {
    mockResolvers['matchup_takes'] = { data: null, error: { message: 'boom' } };
    expect(await getMyTakes('u1')).toEqual([]);
  });

  it('returns [] without a heroes lookup when the user has no takes', async () => {
    mockResolvers['matchup_takes'] = { data: [], error: null };
    expect(await getMyTakes('u1')).toEqual([]);
    expect(chains['heroes']).toBeUndefined();
  });
});

describe('postTake', () => {
  it('returns null and warns on RPC error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rate limited' } });

    const result = await postTake('h1', 'h2', 'h1', 'h1 all day');

    expect(result).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('post_take', {
      p_a: 'h1',
      p_b: 'h2',
      p_picked: 'h1',
      p_body: 'h1 all day',
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('toggleAgree', () => {
  it('passes p_take_id/p_voter_key and unwraps {agreed, agree_count}', async () => {
    mockRpc.mockResolvedValue({ data: { agreed: true, agree_count: 5 }, error: null });

    const result = await toggleAgree('t1', 'vk_abc12345');

    expect(mockRpc).toHaveBeenCalledWith('toggle_take_agreement', {
      p_take_id: 't1',
      p_voter_key: 'vk_abc12345',
    });
    expect(result).toEqual({ agreed: true, agreeCount: 5 });
  });
});
