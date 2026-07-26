import {
  synthesizeCampaignFromPool,
  TRAILER_HERO_MAX_AGE_HOURS,
  type TrailerPick,
  type TrendingTitle,
} from '../../../src/lib/db/trending';

const NOW = Date.parse('2026-07-26T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const title = (over: Partial<TrendingTitle> = {}): TrendingTitle => ({
  id: 'tmdb:1',
  title: 'A Title',
  media_type: 'film',
  release_date: '2026-06-01',
  backdrop_url: 'https://img/backdrop.jpg',
  poster_url: 'https://img/poster.jpg',
  provider: null,
  provider_logo: null,
  overview: 'A thing happens. Then another thing happens.',
  trailer_key: 'yt-key',
  characters: [
    { id: 'h1', name: 'Hero One', image_url: null, portrait_url: 'p.jpg', avatar_url: null },
  ],
  ...over,
});

const drop = (titleId: string, h: number, videoType = 'Trailer'): TrailerPick => ({
  titleId,
  publishedAt: hoursAgo(h),
  videoType,
});

describe('synthesizeCampaignFromPool — eligibility', () => {
  it('returns null when every pool is empty', () => {
    expect(synthesizeCampaignFromPool([[], []], [], NOW)).toBeNull();
  });

  it('skips titles with no backdrop — the hero band is a wide image', () => {
    expect(synthesizeCampaignFromPool([[title({ backdrop_url: null })]], [], NOW)).toBeNull();
  });

  it('skips titles with no catalogue characters', () => {
    expect(synthesizeCampaignFromPool([[title({ characters: [] })]], [], NOW)).toBeNull();
  });

  it('falls through to the next pool when the first has nothing usable', () => {
    const c = synthesizeCampaignFromPool(
      [[title({ backdrop_url: null })], [title({ id: 'tmdb:2', title: 'Streaming Pick' })]],
      [],
      NOW,
    );
    expect(c?.headline).toBe('Streaming Pick');
  });
});

describe('synthesizeCampaignFromPool — news beats luck', () => {
  const pool = [
    title({ id: 'tmdb:1', title: 'Old Popular Film' }),
    title({ id: 'tmdb:2', title: 'Trailer Dropped Today', trailer_key: 'fresh-key' }),
    title({ id: 'tmdb:3', title: 'Another Popular Film' }),
  ];

  it('picks the title whose trailer dropped, not a random one', () => {
    // Run repeatedly: a random pick would land on the other two most of the time.
    for (let i = 0; i < 25; i++) {
      const c = synthesizeCampaignFromPool([pool], [drop('tmdb:2', 3)], NOW);
      expect(c?.headline).toBe('Trailer Dropped Today');
    }
  });

  it('labels the hero with the news rather than the release badge', () => {
    const c = synthesizeCampaignFromPool([pool], [drop('tmdb:2', 3)], NOW);
    expect(c?.label).toBe('New Trailer');
  });

  it('distinguishes a teaser', () => {
    const c = synthesizeCampaignFromPool([pool], [drop('tmdb:2', 3, 'Teaser')], NOW);
    expect(c?.label).toBe('New Teaser');
  });

  it('carries the trailer key so the hero can offer a play affordance', () => {
    const c = synthesizeCampaignFromPool([pool], [drop('tmdb:2', 3)], NOW);
    expect(c?.trailer_key).toBe('fresh-key');
  });

  it('picks the newest drop when several titles have one', () => {
    const c = synthesizeCampaignFromPool(
      [pool],
      [drop('tmdb:1', 40), drop('tmdb:2', 2), drop('tmdb:3', 20)],
      NOW,
    );
    expect(c?.headline).toBe('Trailer Dropped Today');
  });

  it('searches every pool, not just the first usable one', () => {
    // A streaming title with this morning's trailer must beat a theatrical title
    // with none — otherwise pool order silently outranks recency.
    const c = synthesizeCampaignFromPool(
      [
        [title({ id: 'tmdb:1', title: 'In Cinemas' })],
        [title({ id: 'tmdb:9', title: 'On Netflix' })],
      ],
      [drop('tmdb:9', 1)],
      NOW,
    );
    expect(c?.headline).toBe('On Netflix');
  });
});

describe('synthesizeCampaignFromPool — falling back to popularity', () => {
  const pool = [title({ id: 'tmdb:1' }), title({ id: 'tmdb:2' }), title({ id: 'tmdb:3' })];

  it('ignores a trailer older than the window', () => {
    const c = synthesizeCampaignFromPool(
      [pool],
      [drop('tmdb:2', TRAILER_HERO_MAX_AGE_HOURS + 1)],
      NOW,
    );
    expect(c?.label).not.toBe('New Trailer');
    expect(c?.trailer_key).toBeNull();
  });

  it('ignores a trailer for a title that is not in any pool', () => {
    const c = synthesizeCampaignFromPool([pool], [drop('tmdb:999', 1)], NOW);
    expect(c?.label).not.toBe('New Trailer');
  });

  it('ignores an unparseable publish date', () => {
    const c = synthesizeCampaignFromPool(
      [pool],
      [{ titleId: 'tmdb:2', publishedAt: 'not-a-date' }],
      NOW,
    );
    expect(c?.label).not.toBe('New Trailer');
  });

  it('still rotates across renders so the hero is not pinned for a whole staleTime', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const c = synthesizeCampaignFromPool([pool], [], NOW);
      if (c) seen.add(c.id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('keeps the contextual badge as the label', () => {
    const c = synthesizeCampaignFromPool(
      [[title({ provider: 'Disney Plus', release_date: '2026-01-01' })]],
      [],
      NOW,
    );
    expect(c?.label).toBe('Disney Plus');
  });
});

describe('synthesizeCampaignFromPool — shape', () => {
  it('builds an auto-prefixed id, a one-sentence blurb, and no accent', () => {
    const c = synthesizeCampaignFromPool([[title({ id: 'tmdb:7' })]], [], NOW);
    expect(c?.id).toBe('auto:tmdb:7');
    expect(c?.title_id).toBe('tmdb:7');
    // First sentence only — not the whole synopsis.
    expect(c?.blurb).toBe('A thing happens.');
    expect(c?.accent).toBeNull();
    expect(c?.characters).toHaveLength(1);
  });
});
