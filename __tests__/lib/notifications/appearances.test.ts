import {
  APPEARANCE_MAX_AGE_MS,
  favouriteAppearances,
  type AppearanceTitle,
} from '../../../src/lib/notifications/appearances';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

const title = (over: Partial<AppearanceTitle> = {}): AppearanceTitle => ({
  id: 't1',
  title: 'The Film',
  media_type: 'movie',
  release_date: iso(NOW - DAY),
  characters: [{ id: 'h1', name: 'Storm' }],
  ...over,
});

const run = (titles: AppearanceTitle[], favs = ['h1']) =>
  favouriteAppearances({ titles, favouriteIds: new Set(favs), now: NOW });

describe('favouriteAppearances', () => {
  it('reports a favourite in something newly out', () => {
    const [item] = run([title()]);
    expect(item.heroName).toBe('Storm');
    expect(item.label).toBe('The Film');
    expect(item.url).toBe('/title/t1');
    expect(item.id).toBe('h1:t1');
  });

  it('says nothing about a character you have not favourited', () => {
    expect(run([title()], ['someone-else'])).toEqual([]);
  });

  // Without the window, a sync that backfills the slate announces a decade of
  // films at once and the reader blames the app — correctly.
  it('ignores back catalogue', () => {
    const old = title({ release_date: iso(NOW - APPEARANCE_MAX_AGE_MS - DAY) });
    expect(run([old])).toEqual([]);
  });

  it('keeps something right at the edge of the window', () => {
    const edge = title({ release_date: iso(NOW - APPEARANCE_MAX_AGE_MS + DAY) });
    expect(run([edge])).toHaveLength(1);
  });

  // The slate carries future releases; "is in" would be a lie about those.
  it('ignores a title that is not out yet', () => {
    expect(run([title({ release_date: iso(NOW + DAY) })])).toEqual([]);
  });

  // Silence beats a guess: missing one appearance costs nothing, announcing a
  // 1998 film as new costs the feature being turned off.
  it('stays quiet when there is no usable date', () => {
    expect(run([title({ release_date: null })])).toEqual([]);
    expect(run([title({ release_date: 'not a date' })])).toEqual([]);
  });

  // Three notifications about the same person on one morning reads as a
  // malfunction, not as news.
  it('reports a hero once, keeping the newest', () => {
    const items = run([
      title({ id: 'older', title: 'Older', release_date: iso(NOW - 5 * DAY) }),
      title({ id: 'newer', title: 'Newer', release_date: iso(NOW - DAY) }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Newer');
  });

  it('still reports different heroes separately', () => {
    const items = run(
      [
        title({
          characters: [
            { id: 'h1', name: 'Storm' },
            { id: 'h2', name: 'Beast' },
          ],
        }),
      ],
      ['h1', 'h2'],
    );
    expect(items.map((i) => i.heroName).sort()).toEqual(['Beast', 'Storm']);
  });

  it('orders newest first', () => {
    const items = run(
      [
        title({ id: 'a', characters: [{ id: 'h1', name: 'A' }], release_date: iso(NOW - 4 * DAY) }),
        title({ id: 'b', characters: [{ id: 'h2', name: 'B' }], release_date: iso(NOW - DAY) }),
      ],
      ['h1', 'h2'],
    );
    expect(items.map((i) => i.heroName)).toEqual(['B', 'A']);
  });
});
