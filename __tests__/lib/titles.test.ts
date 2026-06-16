import {
  buildTitleId,
  parseTitleId,
  pickFeaturedTitle,
  groupTitlesByMedia,
  type HeroTitle,
} from '../../src/lib/db/titles';

function t(over: Partial<HeroTitle>): HeroTitle {
  return {
    id: 'tmdb:1',
    source: 'tmdb',
    mediaType: 'film',
    externalId: '1',
    title: 'X',
    year: null,
    posterUrl: null,
    backdropUrl: null,
    voteAverage: null,
    runtime: null,
    overview: null,
    trailerKey: null,
    watchProviders: null,
    cast: null,
    stills: null,
    revenue: null,
    details: null,
    ...over,
  };
}

describe('title id helpers', () => {
  it('builds a namespaced id', () => {
    expect(buildTitleId('tmdb', '603')).toBe('tmdb:603');
    expect(buildTitleId('igdb', '1020')).toBe('igdb:1020');
  });
  it('parses a namespaced id', () => {
    expect(parseTitleId('tmdb:603')).toEqual({ source: 'tmdb', externalId: '603' });
  });
  it('parses external ids that contain a colon', () => {
    expect(parseTitleId('igdb:a:b')).toEqual({ source: 'igdb', externalId: 'a:b' });
  });
});

describe('pickFeaturedTitle', () => {
  it('prefers the highest-rated title that has a backdrop', () => {
    const titles = [
      t({ id: 'tmdb:1', voteAverage: 9, backdropUrl: null }),
      t({ id: 'tmdb:2', voteAverage: 7, backdropUrl: 'b.jpg' }),
      t({ id: 'tmdb:3', voteAverage: 8, backdropUrl: 'c.jpg' }),
    ];
    expect(pickFeaturedTitle(titles)?.id).toBe('tmdb:3');
  });
  it('returns null for an empty list', () => {
    expect(pickFeaturedTitle([])).toBeNull();
  });
});

describe('groupTitlesByMedia', () => {
  it('buckets by media type preserving order', () => {
    const titles = [
      t({ id: 'tmdb:1', mediaType: 'film' }),
      t({ id: 'igdb:9', mediaType: 'game' }),
      t({ id: 'tmdb:2', mediaType: 'tv' }),
      t({ id: 'tmdb:3', mediaType: 'film' }),
    ];
    const g = groupTitlesByMedia(titles);
    expect(g.film.map((x) => x.id)).toEqual(['tmdb:1', 'tmdb:3']);
    expect(g.tv.map((x) => x.id)).toEqual(['tmdb:2']);
    expect(g.game.map((x) => x.id)).toEqual(['igdb:9']);
  });
});
