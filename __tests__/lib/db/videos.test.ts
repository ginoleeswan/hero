import { mapTrailerRows } from '../../../src/lib/db/videos';

const row = {
  title_id: 'tmdb:1234',
  title: 'Spider-Man: Brand New Day',
  media_type: 'film',
  release_date: '2026-07-28',
  poster_url: 'https://image.tmdb.org/t/p/w500/p.jpg',
  backdrop_url: 'https://image.tmdb.org/t/p/w1280/b.jpg',
  video_key: 'abc123',
  video_type: 'Trailer',
  video_name: 'Official Trailer',
  published_at: '2026-07-26T09:00:00.000Z',
  character_count: 7,
  max_fame: 96,
};

describe('mapTrailerRows', () => {
  it('maps a trailer event row', () => {
    const [e] = mapTrailerRows([row]);
    expect(e.titleId).toBe('tmdb:1234');
    expect(e.videoKey).toBe('abc123');
    expect(e.publishedAt).toBe('2026-07-26T09:00:00.000Z');
    expect(e.characterCount).toBe(7);
    expect(e.maxFame).toBe(96);
  });

  it('defaults a null character count to 0 rather than leaking null', () => {
    expect(mapTrailerRows([{ ...row, character_count: null }])[0].characterCount).toBe(0);
  });

  it('preserves a null max fame — absent is not zero', () => {
    expect(mapTrailerRows([{ ...row, max_fame: null }])[0].maxFame).toBeNull();
  });

  it('carries nullable art through untouched', () => {
    const [e] = mapTrailerRows([{ ...row, poster_url: null, backdrop_url: null }]);
    expect(e.posterUrl).toBeNull();
    expect(e.backdropUrl).toBeNull();
  });

  it('preserves the RPC ordering', () => {
    const rows = [
      { ...row, title_id: 'a', published_at: '2026-07-26T09:00:00.000Z' },
      { ...row, title_id: 'b', published_at: '2026-07-25T09:00:00.000Z' },
    ];
    expect(mapTrailerRows(rows).map((e) => e.titleId)).toEqual(['a', 'b']);
  });

  it('maps an empty result to an empty list', () => {
    expect(mapTrailerRows([])).toEqual([]);
  });
});
