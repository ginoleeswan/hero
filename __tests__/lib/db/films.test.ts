import { getHeroFilms } from '../../../src/lib/db/films';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

describe('getHeroFilms', () => {
  it('returns flattened, rank-ordered films for a hero', async () => {
    const rows = [
      { rank: 50, films: { tmdb_id: '268', title: 'Batman', year: 1989, poster_url: 'p', backdrop_url: 'b', vote_average: 7.2, runtime: 126, overview: 'o', trailer_key: 'bbb', watch_providers: null, cast_members: null, stills: null } },
    ];
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const films = await getHeroFilms('69');
    expect(supabase.from).toHaveBeenCalledWith('hero_film_appearances');
    expect(films).toHaveLength(1);
    expect(films[0]).toMatchObject({ tmdbId: '268', title: 'Batman', year: 1989, trailerKey: 'bbb' });
  });

  it('returns [] on error', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ order }) }) });
    expect(await getHeroFilms('1')).toEqual([]);
  });
});
