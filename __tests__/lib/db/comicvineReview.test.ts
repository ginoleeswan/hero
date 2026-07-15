import {
  listComicvineNeedsReview,
  countComicvineNeedsReview,
  acceptComicvineMatch,
  markComicvineUnmatched,
} from '../../../src/lib/db/comicvineReview';

// A thenable chain: every builder method returns the chain, and awaiting it
// resolves the current `mockResult` (list awaits after .limit; count after .eq).
let mockResult: { data?: unknown[]; count?: number; error: unknown } = { data: [], error: null };
const mockRpc = jest.fn().mockResolvedValue({ error: null });

jest.mock('../../../src/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'order', 'limit'].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) => resolve(mockResult);
  return {
    supabase: {
      from: jest.fn().mockReturnValue(chain),
      rpc: (...args: unknown[]) => mockRpc(...args),
    },
  };
});

beforeEach(() => {
  mockResult = { data: [], error: null };
  mockRpc.mockClear();
});

describe('listComicvineNeedsReview', () => {
  it('maps rows and prefers image_md_url over image_url', async () => {
    mockResult = {
      data: [
        { id: 'h1', name: 'Aragorn', publisher: 'Marvel', image_md_url: 'md.jpg', image_url: 'x.jpg' },
        { id: 'h2', name: 'Baymax', publisher: 'DC Comics', image_md_url: null, image_url: 'fallback.jpg' },
      ],
      error: null,
    };
    const rows = await listComicvineNeedsReview();
    expect(rows).toEqual([
      { id: 'h1', name: 'Aragorn', publisher: 'Marvel', imageUrl: 'md.jpg' },
      { id: 'h2', name: 'Baymax', publisher: 'DC Comics', imageUrl: 'fallback.jpg' },
    ]);
  });

  it('returns [] on error', async () => {
    mockResult = { data: null as unknown as unknown[], error: { message: 'boom' } };
    await expect(listComicvineNeedsReview()).resolves.toEqual([]);
  });
});

describe('countComicvineNeedsReview', () => {
  it('returns the exact count', async () => {
    mockResult = { count: 83, error: null };
    await expect(countComicvineNeedsReview()).resolves.toBe(83);
  });
  it('returns 0 on error', async () => {
    mockResult = { count: undefined, error: { message: 'boom' } };
    await expect(countComicvineNeedsReview()).resolves.toBe(0);
  });
});

describe('admin write RPCs', () => {
  it('acceptComicvineMatch calls admin_set_comicvine_match with hero + cv id', async () => {
    await acceptComicvineMatch('h1', '6810');
    expect(mockRpc).toHaveBeenCalledWith('admin_set_comicvine_match', {
      p_hero_id: 'h1',
      p_comicvine_id: '6810',
    });
  });

  it('markComicvineUnmatched calls admin_mark_comicvine_unmatched', async () => {
    await markComicvineUnmatched('h2');
    expect(mockRpc).toHaveBeenCalledWith('admin_mark_comicvine_unmatched', { p_hero_id: 'h2' });
  });

  it('throws when the RPC errors', async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: 'not authorized' } });
    await expect(acceptComicvineMatch('h1', '1')).rejects.toEqual({ message: 'not authorized' });
  });
});
