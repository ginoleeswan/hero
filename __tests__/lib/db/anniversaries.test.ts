import { getDebutsThisMonth } from '../../../src/lib/db/anniversaries';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

describe('getDebutsThisMonth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the RPC and computes yearsAgo against the current year', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'Superman',
          image_url: null,
          portrait_url: 'p.jpg',
          debut_cover_url: 'c.jpg',
          debut_year: 1938,
          fame_score: 100,
        },
      ],
      error: null,
    });
    const out = await getDebutsThisMonth(14);
    expect(supabase.rpc).toHaveBeenCalledWith('get_debuts_this_month', { p_limit: 14 });
    const currentYear = new Date().getFullYear();
    expect(out).toEqual([
      {
        id: '1',
        name: 'Superman',
        image_url: null,
        portrait_url: 'p.jpg',
        debut_cover_url: 'c.jpg',
        year: 1938,
        yearsAgo: currentYear - 1938,
      },
    ]);
  });

  it('degrades to [] on error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getDebutsThisMonth()).toEqual([]);
  });
});
