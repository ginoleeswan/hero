import { blockUser, unblockUser, getBlockedUsers } from '../../../src/lib/db/blocks';

let mockResolvers: Record<string, { data: unknown; error: unknown }> = {};
const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockGetUser = jest.fn();
const mockRpc = jest.fn();

jest.mock('../../../src/lib/supabase', () => {
  const methods = ['select', 'eq', 'order', 'in'];
  const makeChain = (tableName: string) => {
    const c: Record<string, unknown> = {};
    methods.forEach((m) => {
      c[m] = jest.fn().mockReturnValue(c);
    });
    c.insert = (...args: unknown[]) => mockInsert(tableName, ...args);
    c.delete = (...args: unknown[]) => {
      mockDelete(tableName, ...args);
      return c;
    };
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
    supabase: {
      from: mockFrom,
      auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
      rpc: (...a: unknown[]) => mockRpc(...a),
    },
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
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe('blockUser', () => {
  it('inserts blocked_id with blocker_id from the current session (never caller-supplied) and returns true', async () => {
    mockInsert.mockResolvedValue({ error: null });

    const result = await blockUser('u2');

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('blocked_users');
    expect(mockInsert).toHaveBeenCalledWith('blocked_users', {
      blocker_id: 'u1',
      blocked_id: 'u2',
    });
  });

  it('returns false and warns when there is no signed-in user', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await blockUser('u2');

    expect(result).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('is idempotent: a unique-violation (23505) on a duplicate block returns true, not an error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockInsert.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    const result = await blockUser('u2');

    expect(result).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns false and warns on a real error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockInsert.mockResolvedValue({ error: { code: '23503', message: 'boom' } });

    const result = await blockUser('u2');

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('unblockUser', () => {
  it('deletes by blocked_id and returns true', async () => {
    mockResolvers['blocked_users'] = { data: null, error: null };

    const result = await unblockUser('u2');

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('blocked_users');
    expect(mockDelete).toHaveBeenCalledWith('blocked_users');
    expect(chains['blocked_users'].eq).toHaveBeenCalledWith('blocked_id', 'u2');
  });

  it('returns false and warns on error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockResolvers['blocked_users'] = { data: null, error: { message: 'boom' } };

    const result = await unblockUser('u2');

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('getBlockedUsers', () => {
  it('resolves names/avatars via the get_public_profiles RPC, not a user_profiles select', async () => {
    mockResolvers['blocked_users'] = {
      data: [{ blocked_id: 'u2', created_at: '2026-08-01T00:00:00Z' }],
      error: null,
    };
    mockRpc.mockResolvedValue({
      data: [{ id: 'u2', display_name: 'Villain', avatar_url: 'https://x/y.png' }],
      error: null,
    });

    const result = await getBlockedUsers();

    // user_profiles' SELECT policy is self-scoped (auth.uid() = id), so a
    // direct `.in()` select against it returns nothing for anyone but the
    // caller. The RPC is SECURITY DEFINER and is the only thing that can see
    // another user's public profile columns.
    expect(mockRpc).toHaveBeenCalledWith('get_public_profiles', { p_ids: ['u2'] });
    expect(chains['user_profiles']).toBeUndefined();
    expect(result).toEqual([
      {
        userId: 'u2',
        displayName: 'Villain',
        avatarUrl: 'https://x/y.png',
        createdAt: '2026-08-01T00:00:00Z',
      },
    ]);
  });

  it('returns [] on error rather than throwing', async () => {
    mockResolvers['blocked_users'] = { data: null, error: { message: 'boom' } };
    expect(await getBlockedUsers()).toEqual([]);
  });

  it('returns [] without a profile lookup when there are no blocked users', async () => {
    mockResolvers['blocked_users'] = { data: [], error: null };
    expect(await getBlockedUsers()).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
