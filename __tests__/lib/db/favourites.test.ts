import { getHeroFavouriteCount } from '../../../src/lib/db/favourites';

// Supabase chain mock — same pattern as heroes.test.ts.
// `mockResolveWith` must start with "mock" so babel doesn't hoist it.
// eslint-disable-next-line prefer-const
let mockResolveWith: { count: number | null; error: unknown } = { count: null, error: null };

jest.mock('../../../src/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  ['select', 'eq'].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(mockResolveWith).then(resolve);
  const mockFrom = jest.fn().mockReturnValue(chain);
  return { supabase: { from: mockFrom }, __chain: chain, __mockFrom: mockFrom };
});

const { __chain: chain, __mockFrom: mockFrom } = jest.requireMock(
  '../../../src/lib/supabase',
);

describe('getHeroFavouriteCount', () => {
  beforeEach(() => {
    mockResolveWith = { count: null, error: null };
  });

  it('returns the favourite count for a hero', async () => {
    mockResolveWith = { count: 7, error: null };
    const result = await getHeroFavouriteCount('hero-123');
    expect(result).toBe(7);
    expect(mockFrom).toHaveBeenCalledWith('user_favourites');
    expect(chain.eq).toHaveBeenCalledWith('hero_id', 'hero-123');
  });

  it('returns 0 when count is null', async () => {
    mockResolveWith = { count: null, error: null };
    const result = await getHeroFavouriteCount('hero-123');
    expect(result).toBe(0);
  });

  it('throws when Supabase returns an error', async () => {
    mockResolveWith = { count: null, error: new Error('DB error') };
    await expect(getHeroFavouriteCount('hero-123')).rejects.toThrow('DB error');
  });
});
