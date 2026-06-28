import { mapTmdbDetailsToTv, type TmdbTvDetails } from '../../../src/lib/tmdb/mapTv';

const base: TmdbTvDetails = {
  id: 15804,
  name: 'Batman: The Brave and the Bold',
  first_air_date: '2008-11-14',
  overview: 'Batman teams up.',
  vote_average: 7.6,
  popularity: 42.1,
  number_of_seasons: 3,
  number_of_episodes: 65,
  episode_run_time: [23],
  networks: [{ name: 'Cartoon Network' }],
  poster_path: '/p.jpg',
  backdrop_path: '/b.jpg',
  videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'abc' }] },
  credits: { cast: [{ name: 'Diedrich Bader', character: 'Batman', profile_path: '/d.jpg' }] },
  images: { backdrops: [{ file_path: '/s1.jpg' }] },
};

describe('mapTmdbDetailsToTv', () => {
  it('maps tv name/date and tv-specific details', () => {
    const r = mapTmdbDetailsToTv(base);
    expect(r.title).toBe('Batman: The Brave and the Bold');
    expect(r.release_date).toBe('2008-11-14');
    expect(r.details).toMatchObject({
      seasons: 3,
      episodes: 65,
      episode_runtime: 23,
      networks: ['Cartoon Network'],
    });
    expect(r.popularity).toBe(42.1);
  });

  it('builds poster/backdrop/cast/stills/trailer urls', () => {
    const r = mapTmdbDetailsToTv(base);
    expect(r.poster_url).toBe('https://image.tmdb.org/t/p/w500/p.jpg');
    expect(r.trailer_key).toBe('abc');
    expect(r.cast_members).toEqual([
      {
        name: 'Diedrich Bader',
        character: 'Batman',
        profile_url: 'https://image.tmdb.org/t/p/w185/d.jpg',
      },
    ]);
    expect(r.stills).toEqual(['https://image.tmdb.org/t/p/w780/s1.jpg']);
  });

  it('nulls empty optional fields', () => {
    const r = mapTmdbDetailsToTv({ id: 1, name: 'X' });
    expect(r.trailer_key).toBeNull();
    expect(r.cast_members).toBeNull();
    expect(r.details.seasons).toBeNull();
    expect(r.details.networks).toBeNull();
  });
});
