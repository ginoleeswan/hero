import { recordView, getRecentlyViewed } from '../../../src/lib/db/viewHistory';

// Variables accessed inside jest.mock() factory must be prefixed with "mock"
// (babel-jest hoisting restriction).
// eslint-disable-next-line prefer-const
let mockResolvers: Record<string, { data: unknown; error: unknown }> = {};

jest.mock('../../../src/lib/supabase', () => {
  const makeChain = (tableName: string) => {
    const methods = ['select', 'eq', 'order', 'limit', 'in'];
    const c: Record<string, unknown> = {};
    methods.forEach((m) => {
      c[m] = jest.fn().mockReturnValue(c);
    });
    c.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }).then(resolve);
    c.upsert = jest.fn().mockImplementation(() =>
      Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }),
    );
    return c;
  };

  const chains: Record<string, ReturnType<typeof makeChain>> = {};
  const mockFrom = jest.fn().mockImplementation((tableName: string) => {
    if (!chains[tableName]) chains[tableName] = makeChain(tableName);
    return chains[tableName];
  });

  return { supabase: { from: mockFrom }, __chains: chains, __mockFrom: mockFrom };
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
  Object.values(chains).forEach((c) => {
    ['select', 'eq', 'order', 'limit', 'in'].forEach((m) => {
      c[m].mockReturnValue(c);
    });
  });
  mockFrom.mockImplementation((tableName: string) => {
    if (!chains[tableName]) {
      const methods = ['select', 'eq', 'order', 'limit', 'in'];
      const c: Record<string, unknown> = {};
      methods.forEach((m) => {
        c[m] = jest.fn().mockReturnValue(c);
      });
      c.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }).then(resolve);
      c.upsert = jest.fn().mockImplementation(() =>
        Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }),
      );
      chains[tableName] = c as Record<string, jest.Mock>;
    }
    return chains[tableName];
  });
});

describe('recordView', () => {
  it('upserts into user_view_history', async () => {
    mockResolvers['user_view_history'] = { data: null, error: null };
    await recordView('user-1', 'hero-620');
    expect(mockFrom).toHaveBeenCalledWith('user_view_history');
    expect(chains['user_view_history'].upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', hero_id: 'hero-620' }),
      { onConflict: 'user_id,hero_id' },
    );
  });

  it('does not throw on upsert error (fire-and-forget contract)', async () => {
    mockResolvers['user_view_history'] = { data: null, error: { message: 'conflict' } };
    await expect(recordView('user-1', 'hero-620')).resolves.toBeUndefined();
  });
});

describe('getRecentlyViewed', () => {
  it('returns empty array when no history rows', async () => {
    mockResolvers['user_view_history'] = { data: [], error: null };
    const result = await getRecentlyViewed('user-1');
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalledWith('heroes');
  });

  it('returns heroes in view order (most recent first)', async () => {
    mockResolvers['user_view_history'] = {
      data: [{ hero_id: '620' }, { hero_id: '70' }],
      error: null,
    };
    mockResolvers['heroes'] = {
      data: [
        { id: '70', name: 'Batman', image_url: null, portrait_url: null },
        { id: '620', name: 'Spider-Man', image_url: null, portrait_url: null },
      ],
      error: null,
    };
    const result = await getRecentlyViewed('user-1');
    expect(result[0].id).toBe('620');
    expect(result[1].id).toBe('70');
  });

  it('throws when history query errors', async () => {
    mockResolvers['user_view_history'] = { data: null, error: { message: 'DB error' } };
    await expect(getRecentlyViewed('user-1')).rejects.toMatchObject({ message: 'DB error' });
  });
});
