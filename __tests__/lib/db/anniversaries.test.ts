import { getDebutsThisMonth } from '../../../src/lib/db/anniversaries';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

describe('getDebutsThisMonth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps an issue row (cast + yearsAgo against the current year)', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          issue_id: '105403',
          series_name: 'Action Comics',
          issue_number: '1',
          cover_url: 'c.jpg',
          debut_year: 1938,
          characters: [
            { id: '1', name: 'Superman', image_url: null, portrait_url: 's.jpg' },
            { id: '2', name: 'Lois Lane', image_url: null, portrait_url: 'l.jpg' },
          ],
        },
      ],
      error: null,
    });
    const out = await getDebutsThisMonth(12);
    expect(supabase.rpc).toHaveBeenCalledWith('get_debuts_this_month', { p_limit: 12 });
    const currentYear = new Date().getFullYear();
    expect(out).toEqual([
      {
        issueId: '105403',
        seriesName: 'Action Comics',
        issueNumber: '1',
        cover_url: 'c.jpg',
        year: 1938,
        yearsAgo: currentYear - 1938,
        characters: [
          { id: '1', name: 'Superman', image_url: null, portrait_url: 's.jpg' },
          { id: '2', name: 'Lois Lane', image_url: null, portrait_url: 'l.jpg' },
        ],
      },
    ]);
  });

  it('defaults a missing cast to an empty array', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        {
          issue_id: 'x',
          series_name: 'Showcase',
          issue_number: '8',
          cover_url: null,
          debut_year: 1957,
          characters: null,
        },
      ],
      error: null,
    });
    const out = await getDebutsThisMonth();
    expect(out[0].characters).toEqual([]);
  });

  it('degrades to [] on error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getDebutsThisMonth()).toEqual([]);
  });
});
