import { getHeroFilms, getFilmById, getFilmHeroes, extractProviders, pickFeaturedFilm } from '../../../src/lib/db/films';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const BASE_FILM_ROW = {
  tmdb_id: '268',
  title: 'Batman',
  year: 1989,
  poster_url: 'p',
  backdrop_url: 'b',
  vote_average: 7.2,
  runtime: 126,
  overview: 'o',
  trailer_key: 'bbb',
  watch_providers: null,
  cast_members: null,
  stills: null,
  revenue: 411000000,
};

describe('getHeroFilms', () => {
  it('returns flattened, rank-ordered films for a hero including revenue', async () => {
    const rows = [{ rank: 50, films: BASE_FILM_ROW }];
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const films = await getHeroFilms('69');
    expect(supabase.from).toHaveBeenCalledWith('hero_film_appearances');
    expect(films).toHaveLength(1);
    expect(films[0]).toMatchObject({ tmdbId: '268', title: 'Batman', year: 1989, trailerKey: 'bbb', revenue: 411000000 });
  });

  it('returns [] on error', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ order }) }) });
    expect(await getHeroFilms('1')).toEqual([]);
  });
});

describe('getFilmById', () => {
  it('returns mapped HeroFilm for a matching row', async () => {
    const single = jest.fn().mockResolvedValue({ data: BASE_FILM_ROW, error: null });
    const eq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const film = await getFilmById('268');
    expect(supabase.from).toHaveBeenCalledWith('films');
    expect(film).not.toBeNull();
    expect(film!.tmdbId).toBe('268');
    expect(film!.revenue).toBe(411000000);
  });

  it('returns null on error', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
    expect(await getFilmById('999')).toBeNull();
  });
});

describe('getFilmHeroes', () => {
  it('returns RelatedHeroCard array from join rows', async () => {
    const heroRow = { id: 'h1', name: 'Batman', image_url: null, image_md_url: null, portrait_url: null, publisher: 'DC', alignment: 'good' };
    const rows = [{ heroes: heroRow }, { heroes: null }];
    const limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    const order = jest.fn(() => ({ limit }));
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const heroes = await getFilmHeroes('268');
    expect(heroes).toHaveLength(1);
    expect(heroes[0].name).toBe('Batman');
  });

  it('returns [] on error', async () => {
    const limit = jest.fn().mockResolvedValue({ data: null, error: { message: 'err' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ order: () => ({ limit }) }) }) });
    expect(await getFilmHeroes('268')).toEqual([]);
  });
});

describe('extractProviders', () => {
  it('returns [] for null input', () => {
    expect(extractProviders(null)).toEqual([]);
  });

  it('maps logo_path to w92 URL', () => {
    const blob = {
      US: {
        flatrate: [{ provider_name: 'Netflix', logo_path: '/nfx.png' }],
      },
    };
    const result = extractProviders(blob);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/w92/nfx.png' });
  });

  it('sets logoUrl to null when logo_path is absent', () => {
    const blob = {
      US: {
        buy: [{ provider_name: 'Amazon', logo_path: null }],
      },
    };
    const result = extractProviders(blob);
    expect(result[0].logoUrl).toBeNull();
  });

  it('dedupes providers that appear in multiple categories', () => {
    const blob = {
      US: {
        flatrate: [{ provider_name: 'Disney+', logo_path: '/d.png' }],
        rent:     [{ provider_name: 'Disney+', logo_path: '/d.png' }],
      },
    };
    expect(extractProviders(blob)).toHaveLength(1);
  });

  it('prefers US over other regions', () => {
    const blob = {
      GB: { flatrate: [{ provider_name: 'BritBox', logo_path: '/b.png' }] },
      US: { flatrate: [{ provider_name: 'Netflix', logo_path: '/n.png' }] },
    };
    const result = extractProviders(blob);
    expect(result.map((p) => p.name)).toContain('Netflix');
    expect(result.map((p) => p.name)).not.toContain('BritBox');
  });

  it('falls back to first available region when US is absent', () => {
    const blob = {
      GB: { flatrate: [{ provider_name: 'BritBox', logo_path: '/b.png' }] },
    };
    const result = extractProviders(blob);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('BritBox');
  });
});

describe('pickFeaturedFilm', () => {
  const noBackdrop: import('../../../src/lib/db/films').HeroFilm = {
    tmdbId: '1', title: 'A', year: 2000, posterUrl: 'p', backdropUrl: null,
    voteAverage: null, runtime: null, overview: null, trailerKey: null,
    watchProviders: null, cast: null, stills: null, revenue: null,
  };
  const withBackdrop: import('../../../src/lib/db/films').HeroFilm = {
    ...noBackdrop, tmdbId: '2', title: 'B', backdropUrl: 'http://img.com/b.jpg',
  };

  it('returns null for empty array', () => {
    expect(pickFeaturedFilm([])).toBeNull();
  });

  it('prefers the first film with a backdropUrl', () => {
    expect(pickFeaturedFilm([noBackdrop, withBackdrop])).toBe(withBackdrop);
  });

  it('falls back to the first film when none have a backdrop', () => {
    expect(pickFeaturedFilm([noBackdrop])).toBe(noBackdrop);
  });
});
