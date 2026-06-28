import {
  getHeroTitles,
  getTitleById,
  getTitleHeroes,
  extractProviders,
} from '../../../src/lib/db/titles';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const BASE_TITLE_ROW = {
  id: 'tmdb:268',
  source: 'tmdb',
  media_type: 'film',
  external_id: '268',
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
  details: null,
};

describe('getHeroTitles', () => {
  it('returns flattened, rank-ordered titles for a hero including revenue', async () => {
    const rows = [{ rank: 50, titles: BASE_TITLE_ROW }];
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const titles = await getHeroTitles('69');
    expect(supabase.from).toHaveBeenCalledWith('hero_media_appearances');
    expect(titles).toHaveLength(1);
    expect(titles[0]).toMatchObject({
      id: 'tmdb:268',
      mediaType: 'film',
      source: 'tmdb',
      externalId: '268',
      title: 'Batman',
      year: 1989,
      trailerKey: 'bbb',
      revenue: 411000000,
    });
  });

  it('returns [] on error', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ order }) }) });
    expect(await getHeroTitles('1')).toEqual([]);
  });
});

describe('getTitleById', () => {
  it('returns a mapped HeroTitle for a matching row', async () => {
    const single = jest.fn().mockResolvedValue({ data: BASE_TITLE_ROW, error: null });
    const eq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const title = await getTitleById('tmdb:268');
    expect(supabase.from).toHaveBeenCalledWith('titles');
    expect(title).not.toBeNull();
    expect(title!.id).toBe('tmdb:268');
    expect(title!.externalId).toBe('268');
    expect(title!.revenue).toBe(411000000);
  });

  it('returns null on error', async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
    expect(await getTitleById('tmdb:999')).toBeNull();
  });
});

describe('getTitleHeroes', () => {
  it('returns RelatedHeroCard array from join rows', async () => {
    const heroRow = {
      id: 'h1',
      name: 'Batman',
      image_url: null,
      image_md_url: null,
      portrait_url: null,
      publisher: 'DC',
      alignment: 'good',
    };
    const rows = [{ heroes: heroRow }, { heroes: null }];
    const limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    const order = jest.fn(() => ({ limit }));
    const eq = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const heroes = await getTitleHeroes('tmdb:268');
    expect(heroes).toHaveLength(1);
    expect(heroes[0].name).toBe('Batman');
  });

  it('returns [] on error', async () => {
    const limit = jest.fn().mockResolvedValue({ data: null, error: { message: 'err' } });
    (supabase.from as jest.Mock).mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ limit }) }) }),
    });
    expect(await getTitleHeroes('tmdb:268')).toEqual([]);
  });
});

describe('extractProviders', () => {
  it('returns empty info for null input', () => {
    expect(extractProviders(null)).toEqual({ link: null, providers: [] });
  });

  it('maps logo_path to w92 URL and tags the kind', () => {
    const blob = { US: { flatrate: [{ provider_name: 'Netflix', logo_path: '/nfx.png' }] } };
    const { providers } = extractProviders(blob);
    expect(providers).toHaveLength(1);
    expect(providers[0]).toEqual({
      name: 'Netflix',
      logoUrl: 'https://image.tmdb.org/t/p/w92/nfx.png',
      kind: 'flatrate',
    });
  });

  it('surfaces the region link', () => {
    const blob = {
      US: { link: 'https://watch.example/us', flatrate: [{ provider_name: 'Netflix' }] },
    };
    expect(extractProviders(blob).link).toBe('https://watch.example/us');
  });

  it('sets logoUrl to null when logo_path is absent', () => {
    const blob = { US: { buy: [{ provider_name: 'Amazon', logo_path: null }] } };
    expect(extractProviders(blob).providers[0].logoUrl).toBeNull();
  });

  it('dedupes providers that appear in multiple categories', () => {
    const blob = {
      US: {
        flatrate: [{ provider_name: 'Disney+', logo_path: '/d.png' }],
        rent: [{ provider_name: 'Disney+', logo_path: '/d.png' }],
      },
    };
    expect(extractProviders(blob).providers).toHaveLength(1);
  });

  it('prefers US over other regions', () => {
    const blob = {
      GB: { flatrate: [{ provider_name: 'BritBox', logo_path: '/b.png' }] },
      US: { flatrate: [{ provider_name: 'Netflix', logo_path: '/n.png' }] },
    };
    const names = extractProviders(blob).providers.map((p) => p.name);
    expect(names).toContain('Netflix');
    expect(names).not.toContain('BritBox');
  });

  it('falls back to first available region when US is absent', () => {
    const blob = { GB: { flatrate: [{ provider_name: 'BritBox', logo_path: '/b.png' }] } };
    const { providers } = extractProviders(blob);
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe('BritBox');
  });
});
