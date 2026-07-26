import {
  mapVideoRows,
  parsePublishedAt,
  pickTrailerKey,
  newestEventVideo,
  EVENT_VIDEO_TYPES,
  type TitleVideo,
} from '../../../src/lib/tmdb/mapVideos';

// A TMDB video object as documented. `site`, `type` and `key` are confirmed by
// working production code; `published_at` and `official` are documented-only,
// which is why every test below also covers them being absent or malformed.
const video = (over: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  iso_639_1: 'en',
  iso_3166_1: 'US',
  name: 'Official Trailer',
  key: 'abc123',
  site: 'YouTube',
  size: 1080,
  type: 'Trailer',
  official: true,
  published_at: '2026-07-24T14:00:00.000Z',
  id: 'vid-1',
  ...over,
});

const row = (over: Partial<TitleVideo> = {}): TitleVideo => ({
  id: 'v',
  title_id: 't',
  key: 'k',
  site: 'YouTube',
  type: 'Trailer',
  name: null,
  official: true,
  published_at: '2026-07-24T14:00:00.000Z',
  size: null,
  language: null,
  ...over,
});

describe('parsePublishedAt', () => {
  it('normalises TMDB’s documented format to ISO-8601 UTC', () => {
    expect(parsePublishedAt('2016-03-05T02:03:14.000Z')).toBe('2016-03-05T02:03:14.000Z');
  });

  it('accepts a bare date', () => {
    expect(parsePublishedAt('2026-07-24')).toBe('2026-07-24T00:00:00.000Z');
  });

  it('returns null for absent or unparseable values rather than a NaN date', () => {
    for (const bad of [undefined, null, '', '   ', 'yesterday', 42, {}]) {
      expect(parsePublishedAt(bad)).toBeNull();
    }
  });

  it('rejects timestamps outside a plausible range', () => {
    // Pre-YouTube or far-future is bad data, not a publish date.
    expect(parsePublishedAt('1974-01-01T00:00:00Z')).toBeNull();
    expect(parsePublishedAt('2999-01-01T00:00:00Z')).toBeNull();
  });
});

describe('mapVideoRows', () => {
  it('maps a documented video object in full', () => {
    const { rows, skipped, undated } = mapVideoRows('tmdb:1', [video()]);
    expect(skipped).toBe(0);
    expect(undated).toBe(0);
    expect(rows[0]).toEqual({
      id: 'vid-1',
      title_id: 'tmdb:1',
      key: 'abc123',
      site: 'YouTube',
      type: 'Trailer',
      name: 'Official Trailer',
      official: true,
      published_at: '2026-07-24T14:00:00.000Z',
      size: 1080,
      language: 'en',
    });
  });

  it('survives the documented-only fields being absent', () => {
    // The failure mode we actually fear: published_at/official named differently
    // than documented. Must degrade to nulls, not throw.
    const { rows, undated } = mapVideoRows('tmdb:1', [
      { id: 'x', key: 'k', site: 'YouTube', type: 'Trailer' },
    ]);
    expect(rows[0].published_at).toBeNull();
    expect(rows[0].official).toBeNull();
    expect(undated).toBe(1);
  });

  it('counts undated rows so a wrong field name is visible in the logs', () => {
    const { undated, rows } = mapVideoRows('tmdb:1', [
      video({ id: 'a', published_at: undefined }),
      video({ id: 'b', published_at: 'nonsense' }),
      video({ id: 'c' }),
    ]);
    expect(rows).toHaveLength(3);
    expect(undated).toBe(2);
  });

  it('skips videos with no id or no key — neither is renderable', () => {
    const { rows, skipped } = mapVideoRows('tmdb:1', [
      video({ id: undefined }),
      video({ key: '' }),
      video({ id: 'keep' }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['keep']);
    expect(skipped).toBe(2);
  });

  it('collapses duplicate ids, keeping the first', () => {
    const { rows } = mapVideoRows('tmdb:1', [
      video({ id: 'dup', key: 'first' }),
      video({ id: 'dup', key: 'second' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('first');
  });

  it('preserves TMDB’s ordering', () => {
    const { rows } = mapVideoRows('tmdb:1', [
      video({ id: '1' }),
      video({ id: '2' }),
      video({ id: '3' }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('returns an empty result for anything that is not an array', () => {
    for (const bad of [undefined, null, {}, 'videos', 7]) {
      expect(mapVideoRows('tmdb:1', bad)).toEqual({ rows: [], skipped: 0, undated: 0 });
    }
  });

  it('drops non-object entries', () => {
    const { rows, skipped } = mapVideoRows('tmdb:1', [null, 'x', video({ id: 'ok' })]);
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(2);
  });
});

describe('pickTrailerKey — must not change what the app already plays', () => {
  it('prefers the first YouTube Trailer', () => {
    // Mirrors enrich-tmdb-batch:167-169 exactly.
    const rows = mapVideoRows('t', [
      video({ id: '1', type: 'Teaser', key: 'teaser' }),
      video({ id: '2', type: 'Trailer', key: 'trailer' }),
    ]).rows;
    expect(pickTrailerKey(rows)).toBe('trailer');
  });

  it('falls back to the first YouTube video of any type', () => {
    const rows = mapVideoRows('t', [
      video({ id: '1', type: 'Featurette', key: 'feat' }),
      video({ id: '2', type: 'Clip', key: 'clip' }),
    ]).rows;
    expect(pickTrailerKey(rows)).toBe('feat');
  });

  it('ignores non-YouTube sites', () => {
    const rows = mapVideoRows('t', [video({ id: '1', site: 'Vimeo', key: 'vim' })]).rows;
    expect(pickTrailerKey(rows)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(pickTrailerKey([])).toBeNull();
  });
});

describe('newestEventVideo', () => {
  it('picks the latest published trailer or teaser', () => {
    const picked = newestEventVideo([
      row({ id: 'old', published_at: '2026-07-01T00:00:00.000Z' }),
      row({ id: 'new', published_at: '2026-07-24T00:00:00.000Z' }),
      row({ id: 'mid', published_at: '2026-07-10T00:00:00.000Z' }),
    ]);
    expect(picked?.id).toBe('new');
  });

  it('counts teasers as news', () => {
    expect(EVENT_VIDEO_TYPES).toContain('Teaser');
    expect(newestEventVideo([row({ type: 'Teaser' })])?.type).toBe('Teaser');
  });

  it('ignores clips and featurettes — real videos, but not news', () => {
    expect(newestEventVideo([row({ type: 'Clip' }), row({ type: 'Featurette' })])).toBeNull();
  });

  it('ignores undated rows, which cannot be news', () => {
    expect(newestEventVideo([row({ published_at: null })])).toBeNull();
  });

  it('returns null when there is nothing event-worthy', () => {
    expect(newestEventVideo([])).toBeNull();
  });
});
