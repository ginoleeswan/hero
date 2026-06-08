import { filterHeroesByAlignment } from '../../../src/lib/db/heroes';
import type { HeroSearchResult } from '../../../src/lib/db/heroes';

const make = (id: string, alignment: string | null): HeroSearchResult =>
  ({
    id,
    name: id,
    publisher: null,
    alignment,
    image_md_url: null,
    image_url: null,
    portrait_url: null,
    full_name: null,
    aliases: null,
  }) as HeroSearchResult;

const heroes = [make('a', 'good'), make('b', 'bad'), make('c', 'neutral'), make('d', null)];

describe('filterHeroesByAlignment', () => {
  it('returns all heroes for "All"', () => {
    expect(filterHeroesByAlignment(heroes, 'All')).toHaveLength(4);
  });
  it('maps "Heroes" → good', () => {
    expect(filterHeroesByAlignment(heroes, 'Heroes').map((h) => h.id)).toEqual(['a']);
  });
  it('maps "Villains" → bad', () => {
    expect(filterHeroesByAlignment(heroes, 'Villains').map((h) => h.id)).toEqual(['b']);
  });
  it('maps "Anti" → neutral', () => {
    expect(filterHeroesByAlignment(heroes, 'Anti').map((h) => h.id)).toEqual(['c']);
  });
});
