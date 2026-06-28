import { buildTitleExtras } from '../../../src/lib/tmdb/extras';

describe('buildTitleExtras (movie)', () => {
  const movie = {
    tagline: 'It all ends here.',
    homepage: 'https://example.com',
    status: 'Released',
    budget: 250000000,
    vote_count: 12000,
    original_language: 'en',
    genres: [{ name: 'Action' }, { name: 'Adventure' }],
    credits: {
      crew: [
        { job: 'Director', name: 'Jon Watts' },
        { job: 'Screenplay', name: 'Chris McKenna' },
        { job: 'Gaffer', name: 'Nobody' },
      ],
    },
    keywords: { keywords: [{ name: 'superhero' }, { name: 'sequel' }] },
    release_dates: {
      results: [
        { iso_3166_1: 'GB', release_dates: [{ certification: '12A' }] },
        { iso_3166_1: 'US', release_dates: [{ certification: '' }, { certification: 'PG-13' }] },
      ],
    },
    external_ids: { imdb_id: 'tt123', instagram_id: 'spidey', twitter_id: null, facebook_id: null },
    recommendations: {
      results: [
        { id: 557, title: 'Spider-Man', poster_path: '/sm.jpg', release_date: '2002-05-01' },
        { id: 99, title: '', poster_path: null }, // dropped (no title)
      ],
    },
    reviews: {
      results: [
        { author: 'Roger', content: 'Great fun.', url: 'u', author_details: { rating: 8 } },
      ],
    },
    belongs_to_collection: { id: 531241, name: 'Spider-Man (MCU)', poster_path: '/c.jpg' },
  };

  const r = buildTitleExtras(movie, 'movie');

  it('pulls US certification, skipping empty entries', () => {
    expect(r.certification).toBe('PG-13');
  });
  it('extracts director and writers', () => {
    expect(r.director).toBe('Jon Watts');
    expect(r.writers).toEqual(['Chris McKenna']);
  });
  it('maps recommendations to composite ids and drops empties', () => {
    expect(r.recommendations).toEqual([
      {
        id: 'tmdb:557',
        title: 'Spider-Man',
        posterUrl: 'https://image.tmdb.org/t/p/w342/sm.jpg',
        year: 2002,
      },
    ]);
  });
  it('captures external ids, collection, genres and scalars', () => {
    expect(r.externalIds).toMatchObject({ imdb: 'tt123', instagram: 'spidey' });
    expect(r.collection).toEqual({
      id: 'tmdb-collection:531241',
      name: 'Spider-Man (MCU)',
      posterUrl: 'https://image.tmdb.org/t/p/w342/c.jpg',
    });
    expect(r.genres).toEqual(['Action', 'Adventure']);
    expect(r.budget).toBe(250000000);
    expect(r.status).toBe('Released');
  });
});

describe('buildTitleExtras (tv)', () => {
  const tv = {
    genres: [{ name: 'Animation' }],
    created_by: [{ name: 'Bruce Timm' }],
    keywords: { results: [{ name: 'dc comics' }] },
    content_ratings: { results: [{ iso_3166_1: 'US', rating: 'TV-Y7' }] },
  };
  const r = buildTitleExtras(tv, 'tv');

  it('uses content_ratings for certification and created_by for writers', () => {
    expect(r.certification).toBe('TV-Y7');
    expect(r.director).toBeNull();
    expect(r.writers).toEqual(['Bruce Timm']);
    expect(r.keywords).toEqual(['dc comics']);
  });
});
