import { getTrendingOnScreen } from '../../../src/lib/db/trending';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const row = (titleId: string, hero: string) => ({
  title_id: titleId,
  title: 'Superman',
  media_type: 'film',
  release_date: '2025-07-11',
  backdrop_url: 'b.jpg',
  poster_url: 'p.jpg',
  trailer_key: 'abc123',
  provider: null,
  hero_id: hero,
  hero_name: hero,
  hero_image_url: null,
  hero_portrait_url: null,
});

describe('getTrendingOnScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the RPC with the limit and groups rows into titles', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [row('tmdb:1', 'Superman'), row('tmdb:1', 'Lois Lane')],
      error: null,
    });
    const out = await getTrendingOnScreen(12);
    expect(supabase.rpc).toHaveBeenCalledWith('get_trending_on_screen', { p_limit: 12 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tmdb:1');
    expect(out[0].trailer_key).toBe('abc123');
    expect(out[0].characters.map((c) => c.id)).toEqual(['Superman', 'Lois Lane']);
  });

  it('degrades to [] on error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getTrendingOnScreen()).toEqual([]);
  });
});
