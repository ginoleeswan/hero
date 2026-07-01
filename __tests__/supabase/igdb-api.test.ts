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
  it('unions games from franchises, collections, and the name-prefix game match', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 10, name: 'Final Fantasy', games: [1, 2, 3] }],
      }) // /franchises
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 99, name: 'Final Fantasy', games: [3, 4] }],
      }) // /collections
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 5 }] }); // /games prefix
    const { franchiseId, gameIds } = await resolveFranchiseGameIds(clientWith(fetchFn), ff);
    expect(franchiseId).toBe(10); // first franchises entry with games
    expect(new Set(gameIds)).toEqual(new Set([1, 2, 3, 4, 5])); // deduped union
  });

  it('recovers games by name when franchise/collection have none (NieR case)', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // /franchises empty
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 7, name: 'Nier', games: [] }] }) // /collections, no games
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 80468 }, { id: 113345 }] }); // /games prefix
    const { franchiseId, gameIds } = await resolveFranchiseGameIds(clientWith(fetchFn), ff);
    expect(franchiseId).toBeNull();
    expect(gameIds).toEqual([80468, 113345]);
    expect(fetchFn.mock.calls[2][0] as string).toContain('/games');
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
