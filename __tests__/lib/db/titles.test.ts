import { searchTitles, rankTitles, type TitlePoolRow } from '../../../src/lib/db/titles';
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

const row = (
  title: string,
  extra: Partial<TitlePoolRow> = {},
): TitlePoolRow => ({
  id: title,
  title,
  media_type: 'film',
  year: 2010,
  poster_url: null,
  revenue: null,
  popularity: null,
  vote_average: null,
  ...extra,
});

describe('searchTitles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] for an empty query without hitting the DB', async () => {
    mockTitleQuery([]);
    expect(await searchTitles('   ')).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queries an ILIKE pool, re-ranks by prominence, maps to lean rows + slices', async () => {
    // Pool comes back revenue-ordered; an obscure trending title is in there too.
    const m = mockTitleQuery([
      row('Batman v Superman', { year: 2016, poster_url: 'p.jpg', revenue: 874000000 }),
      row('Batman Ninja vs. Yakuza League', { year: 2025, popularity: 900 }),
    ]);
    const out = await searchTitles('batman', 1);
    expect(supabase.from).toHaveBeenCalledWith('titles');
    expect(m.ilike).toHaveBeenCalledWith('title', '%batman%');
    expect(m.limit).toHaveBeenCalledWith(60);
    // blockbuster wins; result is the lean shape (no ranking fields), sliced to 1.
    expect(out).toEqual([
      { id: 'Batman v Superman', title: 'Batman v Superman', media_type: 'film', year: 2016, poster_url: 'p.jpg' },
    ]);
  });

  it('degrades to [] on error', async () => {
    mockTitleQuery(null, { message: 'boom' });
    expect(await searchTitles('x')).toEqual([]);
  });
});

describe('rankTitles', () => {
  it('ranks a high-revenue blockbuster above a trending low-revenue title', () => {
    const out = rankTitles(
      [row('Batman Ninja', { popularity: 900 }), row('The Batman', { revenue: 772000000 })],
      'batman',
    );
    expect(out[0].title).toBe('The Batman');
  });

  it('falls back to popularity/vote for titles without revenue (e.g. TV)', () => {
    const out = rankTitles(
      [
        row('The Boys Presents', { media_type: 'tv', popularity: 50 }),
        row('The Boys', { media_type: 'tv', popularity: 400 }),
      ],
      'the boys',
    );
    expect(out[0].title).toBe('The Boys');
  });

  it('uses the exact-name nudge as a tiebreak at similar prominence', () => {
    const out = rankTitles(
      [row('Batman Beyond', { revenue: 1 }), row('Batman', { revenue: 1 })],
      'batman',
    );
    expect(out[0].title).toBe('Batman'); // exact nudge wins between equally-obscure titles
  });

  it('lets a blockbuster contains-match override an obscure prefix-match', () => {
    const out = rankTitles(
      [row('Batman Ninja', { popularity: 200 }), row('The Batman', { revenue: 772000000 })],
      'batman',
    );
    expect(out[0].title).toBe('The Batman');
  });
});
