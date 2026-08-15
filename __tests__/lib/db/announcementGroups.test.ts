import { groupAnnouncements } from '../../../src/lib/db/events.dossier';
import type { EventAnnouncement } from '../../../src/lib/db/events.dossier';

const a = (o: Partial<EventAnnouncement>): EventAnnouncement => ({
  videoId: 'v',
  title: 'caption',
  publishedAt: '2026-08-15T04:00:00Z',
  thumbnailUrl: null,
  channel: 'Marvel Entertainment',
  official: true,
  titleId: 'tmdb:1',
  titleName: 'Avengers: Doomsday',
  posterUrl: null,
  ...o,
});

describe('groupAnnouncements', () => {
  it('folds clips about the same thing into one announcement', () => {
    // D23 produced three Doomsday clips — the trailer, a reaction and a press
    // re-cut — and the page listed them as three separate announcements.
    const g = groupAnnouncements([
      a({ videoId: '1', title: 'Special Look' }),
      a({ videoId: '2', title: 'RDJ says I am Doom' }),
      a({ videoId: '3', title: 'Official Special Look Teaser', official: false, channel: 'IGN' }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].clips).toBe(3);
    expect(g[0].titleName).toBe('Avengers: Doomsday');
  });

  it('prefers the studio over a press re-cut of the same beat', () => {
    const g = groupAnnouncements([
      a({ videoId: '1', channel: 'IGN', official: false, publishedAt: '2026-08-15T09:00:00Z' }),
      a({
        videoId: '2',
        channel: 'Marvel Entertainment',
        official: true,
        publishedAt: '2026-08-15T04:00:00Z',
      }),
    ]);
    // Official wins despite being older — the rights holder announced it.
    expect(g[0].channel).toBe('Marvel Entertainment');
    expect(g[0].official).toBe(true);
  });

  it('ranks by how many times a studio went back to the same thing', () => {
    const g = groupAnnouncements([
      a({ videoId: '1', titleId: 'tmdb:1', titleName: 'One clip' }),
      a({ videoId: '2', titleId: 'tmdb:2', titleName: 'Two clips' }),
      a({ videoId: '3', titleId: 'tmdb:2', titleName: 'Two clips' }),
    ]);
    expect(g.map((x) => x.titleName)).toEqual(['Two clips', 'One clip']);
  });

  it('falls back to the caption when the catalogue has no name', () => {
    // A headline is required; a bad one beats none.
    const g = groupAnnouncements([a({ titleName: null, title: 'Some marketing string' })]);
    expect(g[0].titleName).toBe('Some marketing string');
  });

  it('returns nothing for nothing', () => {
    expect(groupAnnouncements([])).toEqual([]);
  });
});
