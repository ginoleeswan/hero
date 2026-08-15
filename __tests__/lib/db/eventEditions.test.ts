import { mapEventHub, mapEventEdition } from '../../../src/lib/db/events.editions';

describe('mapEventHub', () => {
  it('returns null for anything that is not a hub', () => {
    expect(mapEventHub(null)).toBeNull();
    expect(mapEventHub({})).toBeNull();
    // get_event_hub returns SQL null for an unknown or rejected slug.
    expect(mapEventHub({ slug: 'd23' })).toBeNull();
  });

  it('maps the payload and defaults the counts', () => {
    const hub = mapEventHub({
      slug: 'd23',
      headline: 'D23',
      accent: '#15A1AB',
      is_live: true,
      spike_ratio: '3.37',
      editions: [
        {
          edition_slug: '2026',
          headline: 'D23',
          live_from: '2026-08-11',
          live_to: '2026-08-13',
          spike_ratio: '3.37',
          peak: 2120,
          movers: 1,
          announcements: 24,
        },
        // A row the RPC could not count is not a broken row; it is a zero.
        { edition_slug: '2024', headline: 'D23' },
      ],
    });
    expect(hub?.isLive).toBe(true);
    expect(hub?.spikeRatio).toBe(3.37);
    expect(hub?.editions).toHaveLength(2);
    expect(hub?.editions[0]).toMatchObject({ editionSlug: '2026', movers: 1, announcements: 24 });
    expect(hub?.editions[1]).toMatchObject({ movers: 0, announcements: 0 });
  });

  it('drops an edition with no slug, because it cannot be routed to', () => {
    const hub = mapEventHub({
      slug: 'd23',
      headline: 'D23',
      editions: [{ edition_slug: '', headline: 'D23' }, { headline: 'D23' }],
    });
    expect(hub?.editions).toEqual([]);
  });

  it('is not live merely because a window exists', () => {
    // `is_live` comes from get_live_events, which applies the verdict and the
    // grace window. A stored live_from is not the same claim, and treating it as
    // one would put "Happening now" on every archived year.
    const hub = mapEventHub({
      slug: 'sdcc',
      headline: 'San Diego Comic-Con',
      live_from: '2026-07-23',
      live_to: '2026-07-27',
    });
    expect(hub?.isLive).toBe(false);
  });
});

describe('mapEventEdition', () => {
  it('renames movers to surges so the edition reuses the live page body', () => {
    const d = mapEventEdition({
      event: { slug: 'd23', edition_slug: '2026', headline: 'D23', spike_ratio: '3.37' },
      movers: [{ hero_id: 'h_1', name: 'Vision', spike: '3.0' }],
      announcements: [
        {
          video_id: 'v1',
          title: 'Avengers: Doomsday | Special Look',
          channel: 'Marvel Entertainment',
          official: true,
          title_id: 'tmdb:1003596',
        },
      ],
      trailers: [],
      issues: [],
    });
    expect(d?.surges).toHaveLength(1);
    expect(d?.surges[0].name).toBe('Vision');
    expect(d?.announcements).toHaveLength(1);
  });

  it('forces ongoing false — an archived edition is never happening now', () => {
    // The masthead's eyebrow reads `ongoing`, so a frozen row that still carried
    // the live flag would claim a past year is running.
    const d = mapEventEdition({
      event: { slug: 'd23', headline: 'D23', ongoing: true },
    });
    expect(d?.event.ongoing).toBe(false);
  });

  it('returns null for an unknown edition', () => {
    expect(mapEventEdition(null)).toBeNull();
    expect(mapEventEdition({})).toBeNull();
  });
});

describe('recap — the only editorial field on an edition', () => {
  it('carries a recap onto the edition, and treats an empty string as absent', () => {
    // 129 of 142 editions predate the announcement feed and can never get one,
    // so this line is the only thing that can say what a year WAS. An empty
    // string has to collapse to null: the page renders the recap in place of the
    // method note, and '' would blank that paragraph rather than fall back.
    expect(
      mapEventEdition({
        event: {
          slug: 'game-awards',
          headline: 'The Game Awards',
          recap: 'Elden Ring won Game of the Year.',
        },
      })?.event.recap,
    ).toBe('Elden Ring won Game of the Year.');
    expect(
      mapEventEdition({ event: { slug: 'x', headline: 'X', recap: '' } })?.event.recap,
    ).toBeNull();
    // An unapplied migration returns no `recap` key at all.
    expect(mapEventEdition({ event: { slug: 'x', headline: 'X' } })?.event.recap).toBeNull();
  });

  it('carries a recap onto each hub row', () => {
    const h = mapEventHub({
      slug: 'game-awards',
      headline: 'The Game Awards',
      editions: [
        { edition_slug: '2022', recap: 'Elden Ring won Game of the Year.' },
        { edition_slug: '2021' },
      ],
    });
    expect(h?.editions.map((e) => e.recap)).toEqual(['Elden Ring won Game of the Year.', null]);
  });
});
