import {
  igdbQuery,
  resolveFranchiseGameIds,
  fetchFranchiseCharacters,
  type IgdbClient,
} from '../../supabase/functions/_shared/igdb-api';
import { IGDB_ALLOWLIST } from '../../supabase/functions/_shared/igdb-allowlist';

const ff = IGDB_ALLOWLIST.find((e) => e.franchise === 'Final Fantasy')!;

function clientWith(fetchFn: jest.Mock): IgdbClient {
  return { clientId: 'cid', token: 'tok', fetchFn: fetchFn as unknown as typeof fetch };
}

describe('igdbQuery', () => {
  it('POSTs apicalypse with auth headers and returns the array', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 1 }] });
    const out = await igdbQuery(clientWith(fetchFn), 'characters', 'fields name;');
    expect(out).toEqual([{ id: 1 }]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.igdb.com/v4/characters');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Client-ID']).toBe('cid');
    expect(headers['Authorization']).toBe('Bearer tok');
  });

  it('throws on non-OK', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 429, text: async () => 'rate' });
    await expect(igdbQuery(clientWith(fetchFn), 'characters', 'x')).rejects.toThrow(/429/);
  });
});

describe('resolveFranchiseGameIds', () => {
  it('picks the franchise with the most games and returns its game ids', async () => {
    const fetchFn = jest
      .fn()
      // /franchises lookup
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 10, name: 'Final Fantasy', games: [1, 2, 3] },
          { id: 11, name: 'Final Fantasy Tactics', games: [9] },
        ],
      });
    const { franchiseId, gameIds } = await resolveFranchiseGameIds(clientWith(fetchFn), ff);
    expect(franchiseId).toBe(10);
    expect(gameIds).toEqual([1, 2, 3]);
  });
});

describe('fetchFranchiseCharacters', () => {
  it('returns [] for empty gameIds without calling the API', async () => {
    const fetchFn = jest.fn();
    const out = await fetchFranchiseCharacters(clientWith(fetchFn), []);
    expect(out).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('paginates until a short page is returned', async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `c${i}` }));
    const page2 = [{ id: 999, name: 'last' }];
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 });
    const out = await fetchFranchiseCharacters(clientWith(fetchFn), [1, 2]);
    expect(out.length).toBe(501);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
