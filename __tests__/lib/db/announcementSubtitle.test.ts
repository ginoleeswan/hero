import { announcementSubtitle } from '../../../src/lib/db/events.dossier';
import type { AnnouncementGroup } from '../../../src/lib/db/events.dossier';

const g = (titleName: string, caption: string): AnnouncementGroup => ({
  titleId: 't',
  titleName,
  caption,
  channel: 'Star Wars',
  official: true,
  thumbnailUrl: null,
  posterUrl: null,
  publishedAt: null,
  clips: 1,
  castCount: 0,
  cast: [],
});

describe('announcementSubtitle', () => {
  it('drops the segment that restates the headline', () => {
    expect(
      announcementSubtitle(
        g(
          'The Mandalorian and Grogu',
          'Star Wars: The Mandalorian and Grogu | Official Podcast | Streaming September 2026',
        ),
      ),
    ).toBe('Official Podcast · Streaming September 2026');
  });

  it('keeps a real sentence untouched when there is no pipe', () => {
    const sentence = 'Watch the newly announced X-Men cast meet for the very first time backstage';
    expect(announcementSubtitle(g('X-Men', sentence))).toBe(sentence);
  });

  it('matches a restatement in either direction', () => {
    // The segment is longer than the title...
    expect(
      announcementSubtitle(
        g('Ahsoka', 'Star Wars: Ahsoka Season 2 | Anakin | Streaming January 20'),
      ),
    ).toBe('Anakin · Streaming January 20');
    // ...and shorter than it.
    expect(
      announcementSubtitle(g('Star Wars: Visions', 'Star Wars | Volume 3 | Now streaming')),
    ).toBe('Volume 3 · Now streaming');
  });

  it('returns empty when every segment was the headline again', () => {
    expect(announcementSubtitle(g('Ahsoka', 'Ahsoka | Ahsoka Season 2'))).toBe('');
  });

  it('ignores punctuation and case when comparing', () => {
    expect(announcementSubtitle(g('Avengers: Doomsday', 'AVENGERS DOOMSDAY | Special Look'))).toBe(
      'Special Look',
    );
  });
});
