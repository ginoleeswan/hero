import { PUBLISHED_WINDOWS, publishedWindow, statedWindow } from '../../../src/lib/events/schedule';

describe('publishedWindow — the few dates we actually know', () => {
  it('resolves an edition by its slug', () => {
    expect(publishedWindow('gamescom', '2026')).toEqual({
      from: '2026-08-26',
      to: '2026-08-30',
    });
  });

  it('falls back to the year of a date inside the event, for the live row', () => {
    // The live dossier reads watched_events, which has no edition slug at all —
    // only the detected window. The detected window is wrong about the DATES
    // (that is the point) but right about the year.
    expect(publishedWindow('gamescom', null, '2026-08-23')).toEqual({
      from: '2026-08-26',
      to: '2026-08-30',
    });
  });

  it('is null for an event, or an edition, nobody has entered', () => {
    expect(publishedWindow('sdcc', '2026')).toBeNull();
    expect(publishedWindow('gamescom', '2019')).toBeNull();
    expect(publishedWindow(null, '2026')).toBeNull();
    expect(publishedWindow('gamescom', null, null)).toBeNull();
  });

  it('refuses to guess when a year holds more than one edition', () => {
    // Comiket runs twice a year. '2026' cannot pick between them, and picking
    // wrongly would put wrong dates on the page — the exact failure this table
    // exists to remove. Simulated rather than asserted against real data, so the
    // guard is tested even before a twice-yearly event is entered.
    const twice = {
      '2026-08': { from: '2026-08-14', to: '2026-08-16' },
      '2026-12': { from: '2026-12-29', to: '2026-12-31' },
    };
    PUBLISHED_WINDOWS.__test_twice = twice;
    try {
      expect(publishedWindow('__test_twice', '2026-08')).toEqual(twice['2026-08']);
      expect(publishedWindow('__test_twice', '2026')).toBeNull();
      expect(publishedWindow('__test_twice', null, '2026-12-30')).toBeNull();
    } finally {
      delete PUBLISHED_WINDOWS.__test_twice;
    }
  });
});

describe('statedWindow — published dates win, detection is the fallback', () => {
  it('prefers the organiser over the pageview curve', () => {
    // Gamescom 2026: detected Aug 23-24 from press-day anticipation, published
    // Aug 26-30. The reader is owed the published one.
    expect(statedWindow('gamescom', '2026', { from: '2026-08-23', to: '2026-08-24' })).toEqual({
      from: '2026-08-26',
      to: '2026-08-30',
      published: true,
    });
  });

  it('passes the detected window straight through when there is no entry', () => {
    expect(statedWindow('sdcc', '2026', { from: '2026-07-23', to: '2026-07-25' })).toEqual({
      from: '2026-07-23',
      to: '2026-07-25',
      published: false,
    });
  });
});
