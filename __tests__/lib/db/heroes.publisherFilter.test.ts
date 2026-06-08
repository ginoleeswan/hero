import { filterHeroesByPublisher } from '../../../src/lib/db/heroes';
import type { HeroSearchResult } from '../../../src/lib/db/heroes';

const make = (id: string, publisher: string | null): HeroSearchResult =>
  ({
    id,
    name: id,
    publisher,
    alignment: null,
    image_md_url: null,
    image_url: null,
    portrait_url: null,
    full_name: null,
    aliases: null,
  }) as HeroSearchResult;

const heroes = [
  make('a', 'Marvel Comics'),
  make('b', 'DC Comics'),
  make('c', 'Dark Horse Comics'),
  make('d', null),
];

describe('filterHeroesByPublisher', () => {
  it('returns all heroes for "All"', () => {
    expect(filterHeroesByPublisher(heroes, 'All')).toHaveLength(4);
  });

  it('keeps only Marvel for "Marvel"', () => {
    expect(filterHeroesByPublisher(heroes, 'Marvel').map((h) => h.id)).toEqual(['a']);
  });

  it('keeps only DC for "DC"', () => {
    expect(filterHeroesByPublisher(heroes, 'DC').map((h) => h.id)).toEqual(['b']);
  });

  it('keeps everything that is neither Marvel nor DC for "Other" (incl. null publisher)', () => {
    expect(filterHeroesByPublisher(heroes, 'Other').map((h) => h.id)).toEqual(['c', 'd']);
  });
});
