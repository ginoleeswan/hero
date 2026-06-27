import { searchTitles } from '../../../src/lib/db/titles';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

function mockTitleQuery(rows: unknown, error: unknown = null) {
  const limit = jest.fn().mockResolvedValue({ data: rows, error });
  const order = jest.fn(() => ({ limit }));
  const ilike = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ ilike }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
  return { select, ilike, order, limit };
}

describe('searchTitles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] for an empty query without hitting the DB', async () => {
    mockTitleQuery([]);
    expect(await searchTitles('   ')).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queries titles by ILIKE and maps the rows', async () => {
    const m = mockTitleQuery([
      { id: 'tmdb:1726', title: 'Iron Man', media_type: 'film', year: 2008, poster_url: 'p.jpg' },
    ]);
    const out = await searchTitles('iron man', 6);
    expect(supabase.from).toHaveBeenCalledWith('titles');
    expect(m.ilike).toHaveBeenCalledWith('title', '%iron man%');
    expect(m.limit).toHaveBeenCalledWith(6);
    expect(out[0]).toEqual({
      id: 'tmdb:1726',
      title: 'Iron Man',
      media_type: 'film',
      year: 2008,
      poster_url: 'p.jpg',
    });
  });

  it('degrades to [] on error', async () => {
    mockTitleQuery(null, { message: 'boom' });
    expect(await searchTitles('x')).toEqual([]);
  });
});
