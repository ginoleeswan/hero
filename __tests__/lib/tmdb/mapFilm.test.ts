import { mapTmdbDetailsToFilm, type TmdbDetails } from '../../../src/lib/tmdb/mapFilm';

const details: TmdbDetails = {
  id: 268,
  title: 'Batman',
  release_date: '1989-06-23',
  overview: 'The Dark Knight...',
  vote_average: 7.2,
  runtime: 126,
  revenue: 411348924,
  poster_path: '/poster.jpg',
  backdrop_path: '/backdrop.jpg',
  videos: { results: [
    { site: 'YouTube', type: 'Teaser', key: 'aaa' },
    { site: 'YouTube', type: 'Trailer', key: 'bbb' },
  ] },
  'watch/providers': { results: { US: { flatrate: [{ provider_name: 'Max' }] } } },
  credits: { cast: [
    { name: 'Michael Keaton', character: 'Batman', profile_path: '/mk.jpg' },
    { name: 'Jack Nicholson', character: 'Joker', profile_path: null },
  ] },
  images: { backdrops: [{ file_path: '/s1.jpg' }, { file_path: '/s2.jpg' }] },
};

describe('mapTmdbDetailsToFilm', () => {
  it('maps core fields and builds image URLs', () => {
    const f = mapTmdbDetailsToFilm(details);
    expect(f.title).toBe('Batman');
    expect(f.release_date).toBe('1989-06-23');
    expect(f.poster_url).toBe('https://image.tmdb.org/t/p/w500/poster.jpg');
    expect(f.backdrop_url).toBe('https://image.tmdb.org/t/p/w1280/backdrop.jpg');
    expect(f.runtime).toBe(126);
    expect(f.revenue).toBe(411348924);
  });

  it('picks the YouTube Trailer key', () => {
    expect(mapTmdbDetailsToFilm(details).trailer_key).toBe('bbb');
  });

  it('keeps providers, top cast, and still URLs', () => {
    const f = mapTmdbDetailsToFilm(details);
    expect(f.watch_providers).toEqual({ US: { flatrate: [{ provider_name: 'Max' }] } });
    expect(f.cast_members).toHaveLength(2);
    expect(f.cast_members?.[0]).toEqual({ name: 'Michael Keaton', character: 'Batman', profile_url: 'https://image.tmdb.org/t/p/w185/mk.jpg' });
    expect(f.stills).toEqual([
      'https://image.tmdb.org/t/p/w780/s1.jpg',
      'https://image.tmdb.org/t/p/w780/s2.jpg',
    ]);
  });

  it('tolerates missing optional sections', () => {
    const f = mapTmdbDetailsToFilm({ id: 1, title: 'X', release_date: null });
    expect(f.trailer_key).toBeNull();
    expect(f.poster_url).toBeNull();
    expect(f.cast_members).toBeNull();
  });
});
