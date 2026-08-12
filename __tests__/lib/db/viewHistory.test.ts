import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordView, getRecentlyViewed } from '../../../src/lib/db/viewHistory';

// Variables accessed inside jest.mock() factory must be prefixed with "mock"
// (babel-jest hoisting restriction).

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
    c.upsert = jest
      .fn()
      .mockImplementation(() =>
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

// AsyncStorage is mapped to its official jest mock by jest.config. Cleared
// between tests so one test's local view mirror cannot answer the next one's
// read — the mirror is now part of every path through this module.
beforeEach(async () => {
  await AsyncStorage.clear();
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
      c.upsert = jest
        .fn()
        .mockImplementation(() =>
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

  // Deliberately NOT a throw any more. The local mirror can still answer, and
  // letting a failed server read take the rail down with it would lose the one
  // source that was never going to fail.
  it('degrades to the local mirror when the history query errors', async () => {
    await recordView(null, '620');
    mockResolvers['user_view_history'] = { data: null, error: { message: 'DB error' } };
    mockResolvers['heroes'] = {
      data: [{ id: '620', name: 'Spider-Man', image_url: null, portrait_url: null }],
      error: null,
    };
    await expect(getRecentlyViewed('user-1')).resolves.toEqual([
      { id: '620', name: 'Spider-Man', image_url: null, portrait_url: null },
    ]);
  });
});

// The point of the whole change: browsing has never required an account, so
// neither should remembering what you browsed.
describe('signed-out history', () => {
  it('records and returns views with no user', async () => {
    await recordView(null, '620');
    await recordView(undefined, '70');
    expect(mockFrom).not.toHaveBeenCalledWith('user_view_history');
    mockResolvers['heroes'] = {
      data: [
        { id: '70', name: 'Batman', image_url: null, portrait_url: null },
        { id: '620', name: 'Spider-Man', image_url: null, portrait_url: null },
      ],
      error: null,
    };
    const result = await getRecentlyViewed(null);
    expect(result.map((h) => h.id)).toEqual(['70', '620']);
  });

  it('moves a re-viewed hero back to the front rather than duplicating it', async () => {
    await recordView(null, '620');
    await recordView(null, '70');
    await recordView(null, '620');
    mockResolvers['heroes'] = {
      data: [
        { id: '70', name: 'Batman', image_url: null, portrait_url: null },
        { id: '620', name: 'Spider-Man', image_url: null, portrait_url: null },
      ],
      error: null,
    };
    const result = await getRecentlyViewed(null);
    expect(result.map((h) => h.id)).toEqual(['620', '70']);
  });

  it('puts local views ahead of the server list and never repeats one', async () => {
    await recordView(null, '620');
    mockResolvers['user_view_history'] = {
      data: [{ hero_id: '70' }, { hero_id: '620' }],
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
    expect(result.map((h) => h.id)).toEqual(['620', '70']);
  });
});
