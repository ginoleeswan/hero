import { getTrendingHeroesWiki } from '../../../src/lib/db/trending';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

describe('getTrendingHeroesWiki', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the RPC and maps spike ratio to a percentage', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          id: '69',
          name: 'Batman',
          image_url: null,
          portrait_url: 'p.jpg',
          pageviews_week: 50000,
          pageviews_spike: 2.8,
        },
      ],
      error: null,
    });
    const out = await getTrendingHeroesWiki(12);
    expect(supabase.rpc).toHaveBeenCalledWith('get_trending_heroes_wiki', { p_limit: 12 });
    expect(out).toEqual([
      {
        id: '69',
        name: 'Batman',
        image_url: null,
        portrait_url: 'p.jpg',
        week: 50000,
        spikePct: 180,
      },
    ]);
  });

  it('degrades to [] on error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getTrendingHeroesWiki()).toEqual([]);
  });
});
